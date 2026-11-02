/**
 * Muzika Tracker – Google Apps Script backend
 *
 * The Google Sheet is the database:
 *   • One tab per person (HELA, KARLO, …) – the albums, human-editable, any column layout.
 *     Columns are found by header name; month divider rows (e.g. "SIJEČANJ ♬") define the month.
 *   • app_* tabs hold app data (created automatically, also editable by hand):
 *       app_users      who uses the app (name, tab, avatar, colour, synced settings)
 *       app_meta       per-album extras: cover, Spotify / YouTube / Apple / Deezer links
 *                      (Spotify + YouTube found automatically via the free Odesli / song.link API)
 *       app_comments   comments on albums
 *       app_reactions  emoji reactions
 *       app_listen     listen lists ("you should hear this")
 *       app_trash      backup of every album deleted from the app
 *
 *   GET  ?action=getAlbums[&v=<version>]  -> everything, or { unchanged:true } if version matches
 *   POST JSON body sent as text/plain (avoids the CORS preflight Apps Script can't answer)
 *
 * FIRST TIME / AFTER UPDATING THIS FILE:
 *   1. Select the function "setup" in the toolbar and click Run (grants Drive + fetch permissions).
 *   2. Deploy -> Manage deployments -> ✏️ Edit -> Version: New version -> Deploy.
 */

var DEFAULT_USERS = ["Hela", "Karlo", "Lea", "Lovro", "Lucija"];
var USER_COLORS = ["#ff6b6b", "#4ecdc4", "#ffd166", "#a78bfa", "#f093fb", "#4dabf7", "#69db7c", "#ff922b", "#e599f7", "#63e6be"];
var REACTIONS = ["🔥", "❤️", "😍", "🤘", "😮", "💤"];

// header regex -> field name (first matching column wins)
var FIELDS = [
  ["artist",         /^(izvo|artist)/],
  ["album",          /^album/],
  ["year",           /^(godin|year)/],
  ["genre",          /^(žanr|zanr|genre)/],
  ["duration",       /^(trajanj|duration)/],
  ["listenedDate",   /^(datum|date)/],
  ["rating",         /^(ocjen|rating)/],
  ["impression",     /^(dojam|dojim|impression)/],
  ["standoutTracks", /^(istak|standout)/],
  ["recommend",      /^(prepor|recommend)/],
  ["comments",       /^(koment|comment)/]
];
var META_FIELDS = ["cover", "spotify", "youtube", "apple", "deezer"];

var DEFAULT_HEADERS = ["Izvođač", "Album", "Godina", "Žanr", "Trajanje", "Datum Preslušavanja",
  "Ocjena (1-5)", "Dojam Albuma", "Istaknute Pjesme", "Preporučam (Da/Ne)", "Komentarska sekcija"];

var MONTHS = ["sijecanj", "veljaca", "ozujak", "travanj", "svibanj", "lipanj",
              "srpanj", "kolovoz", "rujan", "listopad", "studeni", "prosinac"];
var MONTHS_EN = ["january", "february", "march", "april", "may", "june",
                 "july", "august", "september", "october", "november", "december"];
var MONTH_LABELS = ["SIJEČANJ", "VELJAČA", "OŽUJAK", "TRAVANJ", "SVIBANJ", "LIPANJ",
                    "SRPANJ", "KOLOVOZ", "RUJAN", "LISTOPAD", "STUDENI", "PROSINAC"];

var TABS = {
  users:     ["name", "sheet", "avatar", "color", "settings", "created"],
  meta:      ["key", "owner", "artist", "album", "cover", "coverSource", "spotify", "youtube", "apple", "deezer", "clientId", "created", "lookedUp", "linkedUp", "detailsUp"],
  comments:  ["id", "key", "owner", "author", "text", "ts"],
  reactions: ["key", "owner", "user", "emoji", "ts"],
  listen:    ["id", "forUser", "artist", "album", "addedBy", "note", "ts"],
  trash:     ["deletedAt", "owner", "row", "data"]
};

var CACHE_KEY = "muzika_v5";
var CACHE_TTL = 30;          // seconds; onEdit + every app write clear it immediately
var CHUNK = 90000;           // CacheService limit is 100KB per value

/* ═══════════════════════════ entry points ═══════════════════════════ */

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    var action = p.action || "getAlbums";
    if (action === "getAlbums" || action === "getAll") return getAllResponse(p.v);
    return json({ success: false, error: "Unknown action: " + action });
  } catch (err) {
    return json({ success: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  try {
    var p = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var action = p.action;
    if (action === "getAlbums" || action === "getAll") return getAllResponse(p.v);
    if (action === "lookup") return json({ success: true, result: lookupAlbum(p.artist, p.album, p.spotify) });

    // slow network work happens before taking the lock
    var pre = {};
    if (action === "add" && !p.cover && p.lookup !== false) pre.lookup = safeLookup(p.artist, p.album, p.spotify);
    if (action === "uploadImage") pre.url = saveImageToDrive(p.dataUrl, p.name);
    if (action === "autoCovers") pre.covers = autoCoversPrepare(p);

    var lock = LockService.getScriptLock();
    lock.waitLock(25000);
    try {
      var handlers = {
        add: addAlbum, update: updateAlbum, "delete": deleteAlbum,
        comment: addComment, uncomment: deleteComment, react: setReaction,
        listenAdd: addListen, listenRemove: removeListen,
        addUser: addUser, updateUser: updateUser,
        uploadImage: function () { return { success: true, url: pre.url }; },
        autoCovers: function () { return autoCoversWrite(pre.covers); }
      };
      var h = handlers[action];
      if (!h) return json({ success: false, error: "Unknown action: " + action });
      var result = h(p, pre);
      SpreadsheetApp.flush();
      clearCache();
      return json(result);
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json({ success: false, error: String(err && err.message || err) });
  }
}

/** Simple trigger: someone edited the Sheet by hand -> app sees it on its next poll. */
function onEdit(e) { clearCache(); }

function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu("🎵 Muzika")
      .addItem("Popuni omote albuma", "menuFetchCovers")
      .addItem("Set up / repair app tabs", "setup")
      .addToUi();
  } catch (e) {}
}

/** Run once from the editor: creates app_* tabs and asks for Drive / fetch permissions. */
function setup() {
  getUsers();
  Object.keys(TABS).forEach(getTab);
  getCoverFolder();
  fixShiftedDates();
  UrlFetchApp.fetch("https://itunes.apple.com/search?term=test&entity=album&limit=1", { muteHttpExceptions: true });
  clearCache();
  return "Setup OK";
}

function menuFetchCovers() {
  var total = 0;
  for (var i = 0; i < 5; i++) {
    var r = autoCoversWrite(autoCoversPrepare({ limit: 15 }));
    total += r.done;
    if (!r.remaining) break;
    Utilities.sleep(1500);
  }
  clearCache();
  try { SpreadsheetApp.getActive().toast("Looked up " + total + " albums", "Muzika"); } catch (e) {}
}

/* ═══════════════════════════ reading ═══════════════════════════ */

function getAllResponse(clientVersion) {
  var payload = getCachedPayload();
  if (!payload) {
    var body = JSON.stringify(buildPayload());
    payload = { version: hash(body), body: body };
    putCachedPayload(payload);
  }
  if (clientVersion && clientVersion === payload.version) {
    return json({ success: true, unchanged: true, version: payload.version });
  }
  return ContentService
    .createTextOutput('{"success":true,"version":"' + payload.version + '","data":' + payload.body + '}')
    .setMimeType(ContentService.MimeType.JSON);
}

function buildPayload() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var users = getUsers();
  var metaMap = {};
  readTab("meta").forEach(function (m) { metaMap[m.key] = m; });

  var albums = readAllAlbums(users);
  albums.forEach(function (a) {
    var m = metaMap[a.key];
    if (!m) return;
    META_FIELDS.forEach(function (f) { if (m[f]) a[f] = m[f]; });
    if (m.created) a.created = Number(m.created) || 0;
    if (m.lookedUp) a.lookedUp = true;
    if (m.linkedUp) a.linkedUp = true;
    if (m.detailsUp) a.detailsUp = true;
  });

  return {
    sheetUrl: ss.getUrl(),
    serverTime: Date.now(),
    reactionsAllowed: "any",
    users: users.map(function (u) {
      var s = null;
      try { s = u.settings ? JSON.parse(u.settings) : null; } catch (e) {}
      return { name: u.name, sheet: u.sheet, avatar: u.avatar || "", color: u.color || "", settings: s };
    }),
    albums: albums,
    comments: readTab("comments").map(function (c) {
      return { id: c.id, key: c.key, owner: c.owner, author: c.author, text: c.text, ts: Number(c.ts) || 0 };
    }),
    reactions: readTab("reactions").map(function (r) {
      return { key: r.key, owner: r.owner, user: r.user, emoji: r.emoji, ts: Number(r.ts) || 0 };
    }),
    listen: readTab("listen").map(function (l) {
      return { id: l.id, forUser: l.forUser, artist: l.artist, album: l.album, nk: normKey(l.artist, l.album),
               addedBy: l.addedBy, note: l.note, ts: Number(l.ts) || 0 };
    })
  };
}

function readAllAlbums(users) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = ss.getSpreadsheetTimeZone();
  var all = [];

  users.forEach(function (u) {
    var sheet = ss.getSheetByName(u.sheet);
    if (!sheet || sheet.getLastRow() === 0) return;
    var range = sheet.getDataRange(), data = range.getValues();
    var info = detectHeaders(data);
    if (!info) return;
    var bgs = range.getBackgrounds(); // the Sheet's colour code: purple artist = first listen, blue album = relisten

    var section = 0, prev = 0; // month from divider rows / previous album
    for (var r = info.headerRow + 1; r < data.length; r++) {
      var a = rowToAlbum(data[r], info.cols, tz);
      if (!isAlbumRow(a)) {
        var m = monthFromText(data[r].join(" "));
        if (m) section = m;
        continue;
      }
      var dm = /^\d{4}-(\d{2})-\d{2}$/.test(a.listenedDate) ? +a.listenedDate.substr(5, 2) : 0;
      a.month = dm || section || prev;
      prev = a.month;
      var mk = markFromColors(bgs[r][info.cols.artist], bgs[r][info.cols.album]);
      if (mk) a.mark = mk;
      a.owner = u.name;
      a.row = r + 1;                       // 1-based sheet row
      a.id = u.sheet + "_" + (r + 1);
      a.nk = normKey(a.artist, a.album);
      a.key = u.name + "|" + a.nk;
      all.push(a);
    }
  });
  return all;
}

function detectHeaders(data) {
  var limit = Math.min(data.length, 10);
  for (var r = 0; r < limit; r++) {
    var cols = {};
    var row = data[r];
    for (var c = 0; c < row.length; c++) {
      var h = String(row[c]).toLowerCase().trim();
      if (!h) continue;
      for (var f = 0; f < FIELDS.length; f++) {
        var field = FIELDS[f][0];
        if (cols[field] === undefined && FIELDS[f][1].test(h)) { cols[field] = c; break; }
      }
    }
    if (cols.artist !== undefined && cols.album !== undefined) return { headerRow: r, cols: cols };
  }
  return null;
}

function rowToAlbum(row, cols, tz) {
  var a = {};
  for (var f = 0; f < FIELDS.length; f++) {
    var field = FIELDS[f][0];
    var idx = cols[field];
    a[field] = idx === undefined ? "" : cellToString(row[idx], field, tz);
  }
  return a;
}

function cellToString(v, field, tz) {
  if (v === null || v === undefined || v === "") return "";
  if (Object.prototype.toString.call(v) === "[object Date]") {
    // Sheets auto-converts ratings like "4.5" into the date 4 May -> turn it back into "4.5"
    if (field === "rating") return Utilities.formatDate(v, tz, "d.M");
    if (field === "duration") return Utilities.formatDate(v, tz, "H:mm");
    return dayOf(v, tz);
  }
  return unescapeText(String(v).trim());
}

/** The calendar day of a date cell. A date saved as midnight in a different time zone shows up
 *  here as e.g. 18:00 the evening before – so anything after noon counts as the next day. */
function dayOf(v, tz) {
  var h = +Utilities.formatDate(v, tz, "H");
  var t = h > 12 ? new Date(v.getTime() + (24 - h) * 3600000) : v;
  return Utilities.formatDate(t, tz, "yyyy-MM-dd");
}

/** One-off repair (also runs from setup): rewrites shifted date cells at noon so the Sheet shows the right day too. */
function fixShiftedDates() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), tz = ss.getSpreadsheetTimeZone(), fixed = 0;
  getUsers().forEach(function (u) {
    var sheet = ss.getSheetByName(u.sheet);
    if (!sheet || sheet.getLastRow() === 0) return;
    var data = sheet.getDataRange().getValues(), info = detectHeaders(data);
    if (!info || info.cols.listenedDate === undefined) return;
    var c = info.cols.listenedDate;
    for (var r = info.headerRow + 1; r < data.length; r++) {
      var v = data[r][c];
      if (Object.prototype.toString.call(v) !== "[object Date]") continue;
      var h = +Utilities.formatDate(v, tz, "H");
      if (h === 0 || h === 12) continue;
      sheet.getRange(r + 1, c + 1).setValue(Utilities.parseDate(dayOf(v, tz) + " 12:00", tz, "yyyy-MM-dd HH:mm"));
      fixed++;
    }
  });
  clearCache();
  return fixed;
}

/** Skip empty rows and decorative month dividers like "SIJEČANJ ♬". */
function isAlbumRow(a) {
  if (!a.artist && !a.album) return false;
  if (a.artist && a.album) return true;
  return !!(a.year || a.rating || a.standoutTracks);
}

function monthFromText(t) {
  var s = norm(t);
  if (!s) return 0;
  for (var i = 0; i < 12; i++) {
    if (s.indexOf(MONTHS[i]) >= 0 || new RegExp("\\b" + MONTHS_EN[i] + "\\b").test(s)) return i + 1;
  }
  return 0;
}

/* ═══════════════════════════ users ═══════════════════════════ */

var _users = null; // per-request memo

function getUsers() {
  if (_users) return _users;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var existed = !!ss.getSheetByName("app_users");
  var sheet = getTab("users");
  var users = readTab("users").filter(function (u) { return u.name; });
  if (!existed || (!users.length && sheet.getLastRow() <= 1)) {
    DEFAULT_USERS.forEach(function (n, i) {
      var u = { name: n, sheet: n.toUpperCase(), avatar: "", color: USER_COLORS[i % USER_COLORS.length], settings: "", created: String(Date.now()) };
      appendObj("users", u);
    });
    users = readTab("users").filter(function (u) { return u.name; });
  }
  _users = users;
  return users;
}

function findUser(name) {
  var n = String(name || "").trim().toUpperCase();
  var users = getUsers();
  for (var i = 0; i < users.length; i++) {
    if (users[i].name.toUpperCase() === n || users[i].sheet.toUpperCase() === n) return users[i];
  }
  return null;
}

function requireUser(name) {
  var u = findUser(name);
  if (!u) throw new Error("Unknown user: " + name);
  return u;
}

function addUser(p) {
  var name = String(p.name || "").replace(/\s+/g, " ").trim();
  if (!name || name.length > 20) throw new Error("Name must be 1–20 characters");
  if (/[|_<>"]/.test(name) || /^app/i.test(name)) throw new Error("Please use a simpler name");
  if (findUser(name)) throw new Error("Someone called " + name + " already exists");
  checkImage(p.avatar, 60000);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = name.toUpperCase();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var tz = ss.getSpreadsheetTimeZone();
    sheet.getRange(1, 1).setValue(Utilities.formatDate(new Date(), tz, "yyyy") + ".").setFontWeight("bold");
    sheet.getRange(2, 1, 1, DEFAULT_HEADERS.length).setValues([DEFAULT_HEADERS]).setFontWeight("bold");
    sheet.setFrozenRows(2);
  } else if (!detectHeaders(sheet.getDataRange().getValues())) {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, DEFAULT_HEADERS.length).setValues([DEFAULT_HEADERS]).setFontWeight("bold");
  }
  var count = readTab("users").length;
  var u = { name: name, sheet: sheetName, avatar: p.avatar || "", color: /^#[0-9a-fA-F]{3,8}$/.test(String(p.color || "")) ? p.color : USER_COLORS[count % USER_COLORS.length], settings: "", created: String(Date.now()) };
  appendObj("users", u);
  return { success: true, user: { name: u.name, sheet: u.sheet, avatar: u.avatar, color: u.color, settings: null } };
}

function updateUser(p) {
  var u = requireUser(p.name);
  var changes = {};
  if (p.avatar !== undefined) { checkImage(p.avatar, 60000); changes.avatar = p.avatar; }
  if (p.color !== undefined) changes.color = /^#[0-9a-fA-F]{3,8}$/.test(String(p.color)) ? String(p.color) : "";
  if (p.settings !== undefined) {
    var s = typeof p.settings === "string" ? p.settings : JSON.stringify(p.settings);
    if (s.length > 40000) throw new Error("Settings too large");
    changes.settings = s;
  }
  setObj("users", u._row, changes);
  _users = null;
  return { success: true };
}

function checkImage(dataUrl, max) {
  if (!dataUrl) return;
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl)) throw new Error("Image must be a data URL");
  if (dataUrl.length > max) throw new Error("Image too large");
}

/* ═══════════════════════════ albums: writing ═══════════════════════════ */

function getSheetInfo(sheet) {
  var data = sheet.getDataRange().getValues();
  var info = detectHeaders(data);
  if (!info) throw new Error("No header row (Izvođač / Album) found in " + sheet.getName());
  info.data = data;
  return info;
}

function userSheet(u) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(u.sheet);
  if (!sheet) throw new Error("Tab " + u.sheet + " is missing");
  return sheet;
}

function addAlbum(p, pre) {
  var u = requireUser(p.owner);
  if (!String(p.artist || "").trim() || !String(p.album || "").trim()) throw new Error("Artist and album are required");

  // offline queue may resend the same add – make it idempotent
  if (p.clientId) {
    var dup = readTab("meta").filter(function (m) { return m.clientId === p.clientId; })[0];
    if (dup) return { success: true, duplicate: true, key: dup.key };
  }

  var sheet = userSheet(u);
  var info = getSheetInfo(sheet);
  var data = info.data, cols = info.cols;
  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

  // map the tab into month sections (divider rows like "LISTOPAD ♬") so the album lands in the right one
  var last = info.headerRow, usesDividers = false, sections = [], cur = null;
  for (var r = info.headerRow + 1; r < data.length; r++) {
    var a = String(data[r][cols.artist]).trim(), b = String(data[r][cols.album]).trim();
    var rowText = data[r].join(" ");
    if (!(a || b || rowText.trim())) continue;
    var asAlbum = rowToAlbum(data[r], cols, tz);
    if (!isAlbumRow(asAlbum)) {
      var m = monthFromText(rowText);
      if (m) { usesDividers = true; cur = { month: m, divider: r, last: r }; sections.push(cur); last = r; }
    } else { last = r; if (cur) cur.last = r; }
  }

  // year / genre / duration are only what the person typed – the lookup is used just for the cover + links
  var lookup = pre && pre.lookup;

  var newMonth = /^\d{4}-\d{2}-\d{2}$/.test(p.listenedDate || "") ? +p.listenedDate.substr(5, 2)
                 : +Utilities.formatDate(new Date(), tz, "M");
  var same = sections.filter(function (x) { return x.month === newMonth; })[0];
  var later = sections.filter(function (x) { return x.month > newMonth; })[0];
  var targetRow; // 1-based
  if (same) {
    // month already exists: new row right under its last album (works for earlier months too)
    targetRow = same.last + 2;
    sheet.insertRowsAfter(same.last + 1, 1);
  } else if (usesDividers && later) {
    // a forgotten earlier month that has no section yet: new divider + row before the next month
    var at = later.divider + 1;
    sheet.insertRowsBefore(at, 2);
    sheet.getRange(at, cols.artist + 1).setValue(MONTH_LABELS[newMonth - 1]).setFontWeight("bold");
    targetRow = at + 1;
  } else {
    // newest month (or a tab without dividers): append after the last row
    targetRow = last + 2;
    var needDivider = usesDividers || last === info.headerRow;
    var rowsNeeded = targetRow + (needDivider ? 1 : 0) - sheet.getMaxRows();
    if (rowsNeeded > 0) sheet.insertRowsAfter(sheet.getMaxRows(), rowsNeeded);
    if (needDivider) {
      sheet.getRange(targetRow, cols.artist + 1).setValue(MONTH_LABELS[newMonth - 1]).setFontWeight("bold");
      targetRow++;
    }
  }
  writeFields(sheet, targetRow, cols, p);
  if (p.mark) writeMark(sheet, targetRow, cols, p.mark);

  var key = u.name + "|" + normKey(p.artist, p.album);
  var meta = { owner: u.name, artist: p.artist, album: p.album, clientId: p.clientId || "", created: String(Date.now()) };
  META_FIELDS.forEach(function (f) { if (p[f] && /^https:\/\/[^\s"'<>]+$/i.test(String(p[f]))) meta[f] = String(p[f]).slice(0, 500); });
  if (p.cover) meta.coverSource = p.coverSource || "user";
  if (lookup) {
    meta.lookedUp = String(Date.now());
    if (!meta.cover && lookup.cover) { meta.cover = lookup.cover; meta.coverSource = lookup.source; }
    if (!meta.apple && lookup.apple) meta.apple = lookup.apple;
    if (!meta.deezer && lookup.deezer) meta.deezer = lookup.deezer;
    if (!meta.spotify && lookup.spotify) meta.spotify = lookup.spotify;
    if (!meta.youtube && lookup.youtube) meta.youtube = lookup.youtube;
    if (lookup.linked) meta.linkedUp = String(Date.now());
  }
  upsertMeta(key, meta);
  return { success: true, id: u.sheet + "_" + targetRow, key: key };
}

function updateAlbum(p) {
  var loc = locateRow(p);
  writeFields(loc.sheet, loc.row, loc.info.cols, p);
  if (p.mark !== undefined) writeMark(loc.sheet, loc.row, loc.info.cols, p.mark);

  var owner = loc.user.name;
  var oldKey = owner + "|" + normKey(p.expectArtist !== undefined ? p.expectArtist : loc.found.artist,
                                     p.expectAlbum !== undefined ? p.expectAlbum : loc.found.album);
  var newKey = owner + "|" + normKey(p.artist !== undefined ? p.artist : loc.found.artist,
                                     p.album !== undefined ? p.album : loc.found.album);
  if (oldKey !== newKey) rekey(oldKey, newKey);

  var meta = { owner: owner };
  if (p.artist !== undefined) meta.artist = p.artist;
  if (p.album !== undefined) meta.album = p.album;
  META_FIELDS.forEach(function (f) { if (p[f] !== undefined) meta[f] = (p[f] === "" || /^https:\/\/[^\s"'<>]+$/i.test(String(p[f]))) ? String(p[f]).slice(0, 500) : ""; });
  if (p.cover !== undefined) meta.coverSource = p.cover ? (p.coverSource || "user") : "";
  if (p.cover === "") meta.lookedUp = String(Date.now()); // user removed cover: don't auto-fetch again
  upsertMeta(newKey, meta);
  return { success: true, id: loc.user.sheet + "_" + loc.row, key: newKey };
}

function deleteAlbum(p) {
  var loc;
  try { loc = locateRow(p); }
  catch (e) { if (p.clientId) return { success: true, alreadyGone: true }; throw e; }
  var row = loc.info.data[loc.row - 1];
  appendObj("trash", { deletedAt: String(Date.now()), owner: loc.user.name, row: String(loc.row), data: JSON.stringify(row) });
  loc.sheet.deleteRow(loc.row);
  return { success: true };
}

/**
 * Find the sheet row for an id like "LOVRO_12". If the Sheet was edited meanwhile and the
 * row no longer holds the expected album, search the tab for it instead of hitting the wrong row.
 */
function locateRow(p) {
  var id = String(p.id || "");
  var cut = id.lastIndexOf("_");
  var user = requireUser(cut > 0 ? id.slice(0, cut) : p.owner);
  var sheet = userSheet(user);
  var info = getSheetInfo(sheet);
  var data = info.data, cols = info.cols;
  var row = parseInt(id.slice(cut + 1), 10);
  var expA = norm(p.expectArtist), expB = norm(p.expectAlbum);

  function matches(r0) {
    var d = data[r0];
    return d && norm(d[cols.artist]) === expA && norm(d[cols.album]) === expB;
  }
  function result(r1) {
    return { sheet: sheet, row: r1, info: info, user: user,
             found: { artist: String(data[r1 - 1][cols.artist]), album: String(data[r1 - 1][cols.album]) } };
  }

  if (row > info.headerRow + 1 && row <= data.length && (p.expectArtist === undefined || matches(row - 1))) return result(row);
  if (p.expectArtist !== undefined) {
    for (var r = info.headerRow + 1; r < data.length; r++) if (matches(r)) return result(r + 1);
  }
  throw new Error("Album not found – the Sheet changed. Refresh and try again.");
}

/* ═══════════════════════════ colour marks (the group's rules) ═══════════════════════════
 *  purple artist cell = first time hearing this artist, blue album cell = relistening.
 *  Only clearly purple / clearly blue cells count, so decorative row tints are left alone. */
var MARK_COLORS = { first: "#d9d2e9", re: "#c9daf8" };

function hueOf(hex) {
  var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return null;
  var n = parseInt(m[1], 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 0.07) return null; // white / grey
  var h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: d / (1 - Math.abs(max + min - 1) || 1) };
}
function markFromColors(artistBg, albumBg) {
  var a = hueOf(artistBg), b = hueOf(albumBg);
  if (a && a.h >= 245 && a.h <= 300) return "first";
  if (b && b.h >= 195 && b.h < 245) return "re";
  return "";
}
function writeMark(sheet, row, cols, mark) {
  var ac = sheet.getRange(row, cols.artist + 1), bc = sheet.getRange(row, cols.album + 1);
  var cur = markFromColors(ac.getBackground(), bc.getBackground());
  // clear only our own colour code, never someone's decorative tint
  if (cur === "first" && mark !== "first") ac.setBackground(null);
  if (cur === "re" && mark !== "re") bc.setBackground(null);
  if (mark === "first") ac.setBackground(MARK_COLORS.first);
  if (mark === "re") bc.setBackground(MARK_COLORS.re);
}

/** Generous caps so a pasted wall of text (or a script) can't bloat the Sheet. */
var FIELD_MAX = { artist: 200, album: 200, year: 20, genre: 80, duration: 40, rating: 20, impression: 3000, standoutTracks: 1000, recommend: 40, comments: 2000 };
function writeFields(sheet, row, cols, p) {
  Object.keys(FIELD_MAX).forEach(function (k) { if (p[k] != null && String(p[k]).length > FIELD_MAX[k]) p[k] = String(p[k]).slice(0, FIELD_MAX[k]); });
  for (var f = 0; f < FIELDS.length; f++) {
    var field = FIELDS[f][0];
    var c = cols[field];
    if (c === undefined || p[field] === undefined) continue;
    var cell = sheet.getRange(row, c + 1);
    var v = String(p[field] == null ? "" : p[field]).trim();

    if (field === "listenedDate" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      // noon in the spreadsheet's own time zone: the day can't slip, whatever zone the script runs in
      var sheetTz = sheet.getParent().getSpreadsheetTimeZone();
      cell.setNumberFormat("d.m.yyyy").setValue(Utilities.parseDate(v + " 12:00", sheetTz, "yyyy-MM-dd HH:mm"));
    } else if (field === "rating" || field === "year" || field === "duration") {
      // plain text so Sheets never turns "4.5" into a date again
      cell.setNumberFormat("@").setValue(safeText(v));
    } else {
      cell.setValue(safeText(v));
    }
  }
}

/* ═══════════════════════════ meta: covers & links ═══════════════════════════ */

function upsertMeta(key, obj) {
  var rows = readTab("meta");
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].key === key) { setObj("meta", rows[i]._row, obj); return; }
  }
  obj.key = key;
  appendObj("meta", obj);
}

function rekey(oldKey, newKey) {
  ["meta", "comments", "reactions"].forEach(function (t) {
    var sheet = getTab(t);
    var col = TABS[t].indexOf("key") + 1;
    readTab(t).forEach(function (r) {
      if (r.key === oldKey) sheet.getRange(r._row, col).setValue(newKey);
    });
  });
}

/** Network part of the cover backfill – runs without the lock. */
function autoCoversPrepare(p) {
  var limit = Math.min(Number(p && p.limit) || 10, 20);
  var metaMap = {};
  readTab("meta").forEach(function (m) { metaMap[m.key] = m; });
  var missing = readAllAlbums(getUsers()).filter(function (a) {
    var m = metaMap[a.key];
    return !m || (!m.cover && !m.lookedUp);
  });
  var batch = missing.slice(0, limit);
  if (batch.length) {
    var results = lookupMany(batch);
    addStreamingLinks(results, ODESLI_BATCH);
    return { batch: batch, results: results, remaining: missing.length - batch.length };
  }
  // all done -> backfill Spotify / YouTube links for older entries
  var albumKeys = {};
  readAllAlbums(getUsers()).forEach(function (a) { albumKeys[a.key] = a; });
  var noLinks = Object.keys(metaMap).map(function (k) { return metaMap[k]; }).filter(function (m) {
    return albumKeys[m.key] && (m.apple || m.deezer) && !m.spotify && !m.youtube && !m.linkedUp;
  });
  var lb = noLinks.slice(0, ODESLI_BATCH).map(function (m) {
    var a = albumKeys[m.key];
    return { key: a.key, owner: a.owner, artist: a.artist, album: a.album, linksOnly: true, _src: { apple: m.apple, deezer: m.deezer } };
  });
  var lr = lb.map(function (a) { return a._src; });
  addStreamingLinks(lr, ODESLI_BATCH);
  return { batch: lb, results: lr, remaining: noLinks.length - lb.length };
}

function autoCoversWrite(prep) {
  if (prep.details) return detailsWrite(prep);
  var rows = readTab("meta"), byKey = {}, fresh = [];
  rows.forEach(function (m) { byKey[m.key] = m; });
  prep.batch.forEach(function (a, i) {
    var r = prep.results[i] || {};
    var existing = byKey[a.key];
    if (a.linksOnly) {
      if (!existing) return;
      var lm = {};
      if (r.linked) lm.linkedUp = String(Date.now());
      if (r.spotify && !existing.spotify) lm.spotify = r.spotify;
      if (r.youtube && !existing.youtube) lm.youtube = r.youtube;
      if (Object.keys(lm).length) setObj("meta", existing._row, lm);
      return;
    }
    var meta = { owner: a.owner, artist: a.artist, album: a.album, lookedUp: String(Date.now()) };
    if (r.cover) { meta.cover = r.cover; meta.coverSource = r.source; }
    if (r.apple) meta.apple = r.apple;
    if (r.deezer) meta.deezer = r.deezer;
    if (r.linked) meta.linkedUp = String(Date.now());
    if (r.spotify && !(existing && existing.spotify)) meta.spotify = r.spotify;
    if (r.youtube && !(existing && existing.youtube)) meta.youtube = r.youtube;
    if (existing) { if (!existing.cover) setObj("meta", existing._row, meta); }
    else { meta.key = a.key; byKey[a.key] = meta; fresh.push(meta); }
  });
  if (fresh.length) appendObjs("meta", fresh);
  return { success: true, done: prep.batch.length, remaining: prep.remaining };
}

function itunesUrl(artist, album) {
  return "https://itunes.apple.com/search?entity=album&limit=8&term=" + encodeURIComponent(artist + " " + album);
}
function deezerUrl(artist, album) {
  return "https://api.deezer.com/search/album?limit=8&q=" + encodeURIComponent(artist + " " + album);
}

function pickItunes(text, artist, album) {
  try {
    var res = JSON.parse(text).results || [];
    var best = bestMatch(res, artist, album, function (x) { return [x.artistName, x.collectionName]; });
    if (!best) return null;
    return {
      cover: String(best.artworkUrl100 || "").replace(/100x100bb/, "600x600bb"),
      apple: String(best.collectionViewUrl || "").replace(/\?uo=\d+$/, ""),
      year: best.releaseDate ? String(best.releaseDate).substr(0, 4) : "",
      genre: best.primaryGenreName || "",
      itunesId: best.collectionId || "",
      source: "itunes"
    };
  } catch (e) { return null; }
}

function pickDeezer(text, artist, album) {
  try {
    var res = JSON.parse(text).data || [];
    var best = bestMatch(res, artist, album, function (x) { return [x.artist && x.artist.name, x.title]; });
    if (!best) return null;
    return { cover: best.cover_xl || best.cover_big || "", deezer: best.link || "", deezerId: best.id || "", source: "deezer" };
  } catch (e) { return null; }
}

/** Require the artist to match and the album title to roughly match. */
function bestMatch(list, artist, album, getter) {
  var na = norm(artist), nb = stripEdition(norm(album));
  var best = null, bestScore = 0;
  list.forEach(function (x) {
    var g = getter(x), xa = norm(g[0]), xb = stripEdition(norm(g[1]));
    if (!xa || !xb) return;
    var aScore = xa === na ? 3 : (xa.indexOf(na) >= 0 || na.indexOf(xa) >= 0) ? 2 : 0;
    var bScore = xb === nb ? 3 : (xb.indexOf(nb) >= 0 || nb.indexOf(xb) >= 0) ? 2 : 0;
    if (!aScore || !bScore) return;
    if (aScore + bScore > bestScore) { bestScore = aScore + bScore; best = x; }
  });
  return best;
}

function stripEdition(s) {
  return s.replace(/\b(deluxe|remaster(ed)?|expanded|anniversary|edition|version|bonus|tracks?|\d{4})\b/g, " ")
          .replace(/\s+/g, " ").trim();
}

function lookupMany(albums) {
  var opts = { muteHttpExceptions: true };
  var out = [];
  var resp = UrlFetchApp.fetchAll(albums.map(function (a) { return { url: itunesUrl(a.artist, a.album), muteHttpExceptions: true }; }));
  var retry = [];
  albums.forEach(function (a, i) {
    var r = resp[i].getResponseCode() === 200 ? pickItunes(resp[i].getContentText(), a.artist, a.album) : null;
    out[i] = r;
    if (!r) retry.push(i);
  });
  if (retry.length) {
    var resp2 = UrlFetchApp.fetchAll(retry.map(function (i) { return { url: deezerUrl(albums[i].artist, albums[i].album), muteHttpExceptions: true }; }));
    retry.forEach(function (i, j) {
      if (resp2[j].getResponseCode() === 200) out[i] = pickDeezer(resp2[j].getContentText(), albums[i].artist, albums[i].album);
    });
  }
  return out;
}

function lookupAlbum(artist, album, spotify) {
  artist = String(artist || "").trim(); album = String(album || "").trim();
  var result = null;
  if (artist && album) result = lookupMany([{ artist: artist, album: album }])[0];
  if (result) {
    var det = albumDetails(result);
    result.durationSec = det.sec; result.tracks = det.tracks.slice(0, 40);
    if (!result.genre && det.genre) result.genre = det.genre;
    if (!result.year && det.year) result.year = det.year;
  }
  var sp = spotifyCover(spotify);
  if (sp) { result = result || {}; result.cover = sp; result.source = "spotify"; }
  if (result && (result.apple || result.deezer || sp)) {
    if (sp) result.spotifyIn = spotify;
    addStreamingLinks([result], 1);
    delete result.spotifyIn;
    if (sp && !result.spotify) result.spotify = spotify;
  }
  return result;
}

/** Total album length in seconds + the track titles, from whichever catalogue matched. */
function albumDetails(r) {
  try {
    if (r.itunesId) {
      var res = UrlFetchApp.fetch("https://itunes.apple.com/lookup?entity=song&limit=200&id=" + r.itunesId, { muteHttpExceptions: true });
      if (res.getResponseCode() === 200) {
        var ms = 0, names = [];
        (JSON.parse(res.getContentText()).results || []).forEach(function (t) {
          if (t.wrapperType !== "track") return;
          ms += Number(t.trackTimeMillis) || 0;
          if (t.trackName) names.push(t.trackName);
        });
        if (ms) return { sec: Math.round(ms / 1000), tracks: names };
      }
    }
    if (r.deezerId) {
      var res2 = UrlFetchApp.fetch("https://api.deezer.com/album/" + r.deezerId, { muteHttpExceptions: true });
      if (res2.getResponseCode() === 200) {
        var d = JSON.parse(res2.getContentText());
        return { sec: Number(d.duration) || 0, tracks: ((d.tracks && d.tracks.data) || []).map(function (t) { return t.title; }),
                 genre: d.genres && d.genres.data && d.genres.data[0] ? d.genres.data[0].name : "",
                 year: d.release_date ? String(d.release_date).substr(0, 4) : "" };
      }
    }
  } catch (e) {}
  return { sec: 0, tracks: [] };
}

var DETAILS_BATCH = 6;
/** Empty, or only a placeholder like "-" / "?" that people type when they don't know. */
function blankish(v) { return /^[\s\-–—?\/.x]*$/i.test(String(v == null ? "" : v)); }

/** albumDetails() for many results at once (one parallel round of requests). */
function detailsMany(results) {
  var idx = [], reqs = [];
  results.forEach(function (r, i) {
    if (!r) return;
    if (r.itunesId) reqs.push({ url: "https://itunes.apple.com/lookup?entity=song&limit=200&id=" + r.itunesId, muteHttpExceptions: true });
    else if (r.deezerId) reqs.push({ url: "https://api.deezer.com/album/" + r.deezerId, muteHttpExceptions: true });
    else return;
    idx.push(i);
  });
  if (!idx.length) return;
  var resp;
  try { resp = UrlFetchApp.fetchAll(reqs); } catch (e) { return; }
  idx.forEach(function (i, j) {
    var r = results[i];
    try {
      if (resp[j].getResponseCode() !== 200) return;
      var d = JSON.parse(resp[j].getContentText());
      if (r.itunesId) {
        var ms = 0;
        (d.results || []).forEach(function (t) { if (t.wrapperType === "track") ms += Number(t.trackTimeMillis) || 0; });
        r.durationSec = Math.round(ms / 1000);
      } else {
        r.durationSec = Number(d.duration) || 0;
        if (!r.year && d.release_date) r.year = String(d.release_date).substr(0, 4);
        if (!r.genre && d.genres && d.genres.data && d.genres.data[0]) r.genre = d.genres.data[0].name;
      }
    } catch (e) {}
  });
}

/** Writes the found year / genre / duration into the owner's own tab – only into empty cells. */
function detailsWrite(prep) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), tz = ss.getSpreadsheetTimeZone();
  var users = {}; getUsers().forEach(function (u) { users[u.name] = u; });
  var metaRows = readTab("meta"), byKey = {}, fresh = [], filled = 0, sheets = {};
  metaRows.forEach(function (m) { byKey[m.key] = m; });
  prep.batch.forEach(function (a, i) {
    var r = prep.results[i] || {};
    var u = users[a.owner]; if (!u) return;
    var sh = sheets[u.name] = sheets[u.name] || (function () {
      var sheet = ss.getSheetByName(u.sheet); if (!sheet) return null;
      try { return { sheet: sheet, info: getSheetInfo(sheet) }; } catch (e) { return null; }
    })();
    if (sh && sh.info) {
      var data = sh.info.data, cols = sh.info.cols, row = -1;
      // the row may have moved since the lookup started: find it again by artist + album
      if (data[a.row - 1] && normKey(data[a.row - 1][cols.artist], data[a.row - 1][cols.album]) === a.nk) row = a.row - 1;
      else for (var k = sh.info.headerRow + 1; k < data.length; k++) {
        if (normKey(data[k][cols.artist], data[k][cols.album]) === a.nk) { row = k; break; }
      }
      if (row >= 0) {
        var put = {};
        var open = function (f) { return cols[f] !== undefined && blankish(cellToString(data[row][cols[f]], f, tz)); };
        if (open("year") && r.year) put.year = r.year;
        if (open("genre") && r.genre) put.genre = r.genre;
        if (open("duration") && r.durationSec) put.duration = fmtDuration(r.durationSec, durationSamples(data, cols, tz));
        if (Object.keys(put).length) {
          writeFields(sh.sheet, row + 1, cols, put);
          Object.keys(put).forEach(function (f) { data[row][cols[f]] = put[f]; });
          filled++;
        }
      }
    }
    var m = byKey[a.key];
    if (m) setObj("meta", m._row, { detailsUp: String(Date.now()) });
    else { m = { key: a.key, owner: a.owner, artist: a.artist, album: a.album, detailsUp: String(Date.now()) }; byKey[a.key] = m; fresh.push(m); }
  });
  if (fresh.length) appendObjs("meta", fresh);
  return { success: true, done: filled || prep.batch.length, filled: filled, remaining: prep.remaining };
}

/** The durations already in this tab, so a new one is written the same way ("43 min", "43min", "43:12", "1:02:40"). */
function durationSamples(data, cols, tz) {
  if (cols.duration === undefined) return [];
  var out = [];
  for (var r = data.length - 1; r > 0 && out.length < 30; r--) {
    var v = cellToString(data[r][cols.duration], "duration", tz);
    if (v && /\d/.test(v)) out.push(v);
  }
  return out;
}

function fmtDuration(sec, sample) {
  sec = Math.round(Number(sec) || 0);
  if (!sec) return "";
  sample = sample || [];
  var colon = sample.length && sample.filter(function (d) { return /^\d+:\d{2}(:\d{2})?$/.test(d); }).length > sample.length / 2;
  if (colon) {
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    return h ? h + ":" + pad(m) + ":" + pad(s) : m + ":" + pad(s);
  }
  var gap = sample.length && !sample.some(function (d) { return /\d\s+min/i.test(d); }) && sample.some(function (d) { return /\d+min/i.test(d); }) ? "" : " ";
  return Math.round(sec / 60) + gap + "min";
}

/**
 * Odesli (song.link) turns one streaming link into links for every platform – free, no API key.
 * Unauthenticated limit is ~10 calls/minute, so batches stay small. Adds .spotify / .youtube to results.
 */
var ODESLI_BATCH = 4;
function addStreamingLinks(results, max) {
  var idx = [];
  results.forEach(function (r, i) { if (r && (r.spotifyIn || r.apple || r.deezer) && idx.length < max) idx.push(i); });
  if (!idx.length) return;
  var reqs = idx.map(function (i) {
    var r = results[i];
    return { url: "https://api.song.link/v1-alpha.1/links?userCountry=HR&url=" + encodeURIComponent(r.spotifyIn || r.apple || r.deezer), muteHttpExceptions: true };
  });
  var resp;
  try { resp = UrlFetchApp.fetchAll(reqs); } catch (e) { return; }
  idx.forEach(function (i, j) {
    var code = resp[j].getResponseCode();
    if (code === 429) return;                // rate limited: try again on a later run
    results[i].linked = true;                // looked up (found or not) -> don't retry forever
    if (code !== 200) return;
    try {
      var L = JSON.parse(resp[j].getContentText()).linksByPlatform || {};
      if (L.spotify && L.spotify.url) results[i].spotify = L.spotify.url;
      var yt = L.youtube || L.youtubeMusic;
      if (yt && yt.url) results[i].youtube = yt.url;
    } catch (e) {}
  });
}

function safeLookup(artist, album, spotify) {
  try { return lookupAlbum(artist, album, spotify); } catch (e) { return null; }
}

/** Spotify's public oEmbed endpoint gives the cover for a pasted album link – no API key needed. */
function spotifyCover(url) {
  if (!url || !/^https:\/\/open\.spotify\.com\//.test(url)) return "";
  try {
    var r = UrlFetchApp.fetch("https://open.spotify.com/oembed?url=" + encodeURIComponent(url), { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return "";
    return JSON.parse(r.getContentText()).thumbnail_url || "";
  } catch (e) { return ""; }
}

/** Uploaded album covers go to a Drive folder, shared "anyone with the link can view". */
function saveImageToDrive(dataUrl, name) {
  checkImage(dataUrl, 1500000);
  var m = /^data:(image\/[a-z]+);base64,(.*)$/.exec(dataUrl);
  var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], String(name || "cover").replace(/[^\w.-]+/g, "_").slice(0, 60) + ".jpg");
  var file = getCoverFolder().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w600";
}

function getCoverFolder() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("coverFolderId");
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var folder = DriveApp.createFolder("Muzika Tracker – covers");
  props.setProperty("coverFolderId", folder.getId());
  return folder;
}

/* ═══════════════════════════ social ═══════════════════════════ */

function addComment(p) {
  var author = requireUser(p.author).name;
  var text = String(p.text || "").trim().slice(0, 1000);
  if (!text) throw new Error("Empty comment");
  if (!p.id || !p.key) throw new Error("Missing id/key");
  if (readTab("comments").some(function (c) { return c.id === p.id; })) return { success: true, duplicate: true };
  appendObj("comments", { id: p.id, key: p.key, owner: p.owner || "", author: author, text: text, ts: String(Number(p.ts) || Date.now()) });
  return { success: true };
}

function deleteComment(p) {
  var rows = readTab("comments");
  for (var i = rows.length - 1; i >= 0; i--) {
    if (rows[i].id === p.id) {
      if (rows[i].author.toUpperCase() !== String(p.author || "").toUpperCase()) throw new Error("You can only delete your own comments");
      getTab("comments").deleteRow(rows[i]._row);
      return { success: true };
    }
  }
  return { success: true, alreadyGone: true };
}

/** Any single emoji is a fine reaction (no text, nothing long). */
function isReactionEmoji(e) {
  e = String(e || "");
  if (!e || e.length > 16) return false;
  try { return /\p{Extended_Pictographic}/u.test(e) && !/[\p{L}<>"]/u.test(e); }
  catch (x) { return REACTIONS.indexOf(e) >= 0; }
}

function setReaction(p) {
  var user = requireUser(p.user).name;
  if (!isReactionEmoji(p.emoji)) throw new Error("Unknown reaction");
  var rows = readTab("reactions");
  var existing = rows.filter(function (r) { return r.key === p.key && r.user === user && r.emoji === p.emoji; });
  if (p.on && !existing.length) {
    appendObj("reactions", { key: p.key, owner: p.owner || "", user: user, emoji: p.emoji, ts: String(Number(p.ts) || Date.now()) });
  } else if (!p.on && existing.length) {
    existing.sort(function (a, b) { return b._row - a._row; })
      .forEach(function (r) { getTab("reactions").deleteRow(r._row); });
  }
  return { success: true };
}

function addListen(p) {
  var forUser = requireUser(p.forUser).name;
  var addedBy = requireUser(p.addedBy).name;
  if (!String(p.artist || "").trim() && !String(p.album || "").trim()) throw new Error("Artist or album required");
  if (readTab("listen").some(function (l) { return l.id === p.id; })) return { success: true, duplicate: true };
  appendObj("listen", { id: p.id, forUser: forUser, artist: String(p.artist || "").trim(), album: String(p.album || "").trim(),
                        addedBy: addedBy, note: String(p.note || "").slice(0, 300), ts: String(Number(p.ts) || Date.now()) });
  return { success: true };
}

function removeListen(p) {
  var rows = readTab("listen");
  for (var i = rows.length - 1; i >= 0; i--) {
    if (rows[i].id === p.id) { getTab("listen").deleteRow(rows[i]._row); return { success: true }; }
  }
  return { success: true, alreadyGone: true };
}

/* ═══════════════════════════ app_* tab helpers ═══════════════════════════ */

function getTab(t) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var name = "app_" + t;
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name, ss.getSheets().length);
    sheet.getRange(1, 1, 1, TABS[t].length).setValues([TABS[t]]).setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, sheet.getMaxRows(), TABS[t].length).setNumberFormat("@"); // everything as plain text
    sheet.setTabColor("#888888");
  } else if (!_headersOk[t]) {
    // tab made by an older version of this script: append any new columns
    var have = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(function (h) { return String(h).trim(); });
    TABS[t].forEach(function (col, i) {
      if (have[i] !== col && have.indexOf(col) < 0 && !have[i]) {
        if (sheet.getMaxColumns() < i + 1) sheet.insertColumnsAfter(sheet.getMaxColumns(), i + 1 - sheet.getMaxColumns());
        sheet.getRange(1, i + 1).setValue(col).setFontWeight("bold");
        sheet.getRange(1, i + 1, sheet.getMaxRows(), 1).setNumberFormat("@");
      }
    });
  }
  _headersOk[t] = true;
  return sheet;
}
var _headersOk = {};

function readTab(t) {
  var sheet = getTab(t);
  if (sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(1, 1, sheet.getLastRow(), Math.max(TABS[t].length, 1)).getValues();
  var head = data[0].map(function (h) { return String(h).trim(); });
  var out = [];
  for (var r = 1; r < data.length; r++) {
    var o = { _row: r + 1 }, any = false;
    TABS[t].forEach(function (col, i) {
      var idx = head.indexOf(col);
      var v = idx >= 0 ? data[r][idx] : "";
      o[col] = v === null || v === undefined ? "" : unescapeText(String(v));
      if (o[col]) any = true;
    });
    if (any) out.push(o);
  }
  return out;
}

function appendObj(t, obj) { appendObjs(t, [obj]); }

function appendObjs(t, objs) {
  var sheet = getTab(t);
  var rows = objs.map(function (obj) {
    return TABS[t].map(function (c) { return safeText(obj[c] === undefined || obj[c] === null ? "" : String(obj[c])); });
  });
  var r = sheet.getLastRow() + 1;
  var need = r + rows.length - 1 - sheet.getMaxRows();
  if (need > 0) sheet.insertRowsAfter(sheet.getMaxRows(), need + 50);
  sheet.getRange(r, 1, rows.length, TABS[t].length).setNumberFormat("@").setValues(rows);
  if (t === "users") _users = null;
}

function setObj(t, rowNum, obj) {
  var sheet = getTab(t);
  TABS[t].forEach(function (c, i) {
    if (obj[c] !== undefined) sheet.getRange(rowNum, i + 1).setNumberFormat("@").setValue(safeText(String(obj[c] == null ? "" : obj[c])));
  });
}

/* ═══════════════════════════ utils ═══════════════════════════ */

/** Stop user text like "=IMPORTXML(...)" from being run as a formula. */
function safeText(v) { return /^[=+\-@]/.test(v) && !/^-?\d/.test(v) ? "'" + v : v; }

function unescapeText(v) { return /^'[=+\-@]/.test(v) ? v.slice(1) : v; }

function norm(v) {
  var s = String(v == null ? "" : v).toLowerCase();
  try { s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (e) {}
  return s.replace(/đ/g, "d").replace(/ß/g, "ss").replace(/&/g, " and ")
          .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function normKey(artist, album) { return norm(artist) + "~" + norm(album); }

function hash(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, "");
}

function getCachedPayload() {
  try {
    var cache = CacheService.getScriptCache();
    var meta = cache.get(CACHE_KEY);
    if (!meta) return null;
    meta = JSON.parse(meta);
    var keys = [];
    for (var i = 0; i < meta.n; i++) keys.push(CACHE_KEY + "_" + i);
    var parts = cache.getAll(keys), body = "";
    for (var j = 0; j < keys.length; j++) {
      if (parts[keys[j]] == null) return null;
      body += parts[keys[j]];
    }
    return { version: meta.version, body: body };
  } catch (e) { return null; }
}

function putCachedPayload(payload) {
  try {
    var cache = CacheService.getScriptCache(), values = {}, n = 0;
    for (var i = 0; i < payload.body.length; i += CHUNK) values[CACHE_KEY + "_" + (n++)] = payload.body.substr(i, CHUNK);
    cache.putAll(values, CACHE_TTL);
    cache.put(CACHE_KEY, JSON.stringify({ version: payload.version, n: n }), CACHE_TTL);
  } catch (e) { /* cache is optional */ }
}

function clearCache() {
  try { CacheService.getScriptCache().remove(CACHE_KEY); } catch (e) {}
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
