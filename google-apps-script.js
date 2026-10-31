/**
 * Muzika Tracker – Google Apps Script backend
 *
 * The Google Sheet is the database. Each person has their own tab
 * (HELA, KARLO, LEA, LOVRO, LUCIJA) and every tab can have a slightly
 * different column layout – columns are found by their header names.
 *
 *   GET  ?action=getAlbums[&v=<version>]  -> { success, version, albums } or { success, unchanged }
 *   POST (body = JSON, sent as text/plain to avoid CORS preflight)
 *        { action: "add",    owner, artist, album, ... }
 *        { action: "update", id, expectArtist, expectAlbum, artist, album, ... }
 *        { action: "delete", id, expectArtist, expectAlbum }
 *
 * After changing this file: Deploy -> Manage deployments -> Edit -> Version: New version -> Deploy
 */

var SHEET_NAMES = ["HELA", "KARLO", "LEA", "LOVRO", "LUCIJA"];

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

var DEFAULT_HEADERS = ["Izvođač", "Album", "Godina", "Žanr", "Trajanje", "Datum Preslušavanja",
  "Ocjena (1-5)", "Dojam Albuma", "Istaknute Pjesme", "Preporučam (Da/Ne)", "Komentarska sekcija"];

var CACHE_KEY = "albums_v3";
var CACHE_TTL = 30;          // seconds; onEdit also clears it, so Sheet edits show up fast
var CHUNK = 90000;           // CacheService limit is 100KB per value

/* ───────────────────────── entry points ───────────────────────── */

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    var action = p.action || "getAlbums";
    if (action === "getAlbums") return getAlbumsResponse(p.v);
    return json({ success: false, error: "Unknown action: " + action });
  } catch (err) {
    return json({ success: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    var params = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var action = params.action;
    if (action === "getAlbums") return getAlbumsResponse(params.v);

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var result;
      if (action === "add") result = addAlbum(params);
      else if (action === "update") result = updateAlbum(params);
      else if (action === "delete") result = deleteAlbum(params);
      else return json({ success: false, error: "Unknown action: " + action });
      SpreadsheetApp.flush();
      clearCache();
      return json(result);
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json({ success: false, error: String(err) });
  }
}

/** Simple trigger: runs whenever someone edits the Sheet by hand -> app sees it on next poll. */
function onEdit(e) {
  clearCache();
}

/* ───────────────────────── reading ───────────────────────── */

function getAlbumsResponse(clientVersion) {
  var payload = getCachedPayload();
  if (!payload) {
    var albums = readAllAlbums();
    var body = JSON.stringify(albums);
    payload = { version: hash(body), body: body };
    putCachedPayload(payload);
  }
  if (clientVersion && clientVersion === payload.version) {
    return json({ success: true, unchanged: true, version: payload.version });
  }
  // splice pre-serialized albums in to avoid parsing/stringifying again
  return ContentService
    .createTextOutput('{"success":true,"version":"' + payload.version + '","albums":' + payload.body + '}')
    .setMimeType(ContentService.MimeType.JSON);
}

function readAllAlbums() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = ss.getSpreadsheetTimeZone();
  var all = [];

  SHEET_NAMES.forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet || sheet.getLastRow() === 0) return;
    var data = sheet.getDataRange().getValues();
    var info = detectHeaders(data);
    if (!info) return;

    for (var r = info.headerRow + 1; r < data.length; r++) {
      var a = rowToAlbum(data[r], info.cols, tz);
      if (!isAlbumRow(a)) continue;
      a.owner = name;
      a.row = r + 1;                  // 1-based sheet row
      a.id = name + "_" + (r + 1);
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
    return Utilities.formatDate(v, tz, "yyyy-MM-dd");
  }
  return String(v).trim();
}

/** Skip empty rows and decorative month dividers like "SIJEČANJ ♬". */
function isAlbumRow(a) {
  if (!a.artist && !a.album) return false;
  if (a.artist && a.album) return true;
  return !!(a.year || a.rating || a.standoutTracks);
}

/* ───────────────────────── writing ───────────────────────── */

function resolveOwnerSheet(owner) {
  var name = String(owner || "").toUpperCase().trim();
  if (SHEET_NAMES.indexOf(name) < 0) throw new Error("Unknown owner: " + owner);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, DEFAULT_HEADERS.length).setValues([DEFAULT_HEADERS]).setFontWeight("bold");
  }
  return sheet;
}

function getSheetInfo(sheet) {
  var data = sheet.getDataRange().getValues();
  var info = detectHeaders(data);
  if (!info) throw new Error("No header row (Izvođač / Album) found in " + sheet.getName());
  info.data = data;
  return info;
}

function addAlbum(p) {
  var sheet = resolveOwnerSheet(p.owner);
  var info = getSheetInfo(sheet);
  var data = info.data, cols = info.cols;

  // put the new album right after the last real album row (not after formatting/junk far below)
  var last = info.headerRow;
  for (var r = data.length - 1; r > info.headerRow; r--) {
    if (String(data[r][cols.artist]).trim() || String(data[r][cols.album]).trim()) { last = r; break; }
  }
  var targetRow = last + 2; // 1-based row after "last"
  if (targetRow > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 1);

  writeFields(sheet, targetRow, cols, p);
  return { success: true, id: sheet.getName() + "_" + targetRow };
}

function updateAlbum(p) {
  var loc = locateRow(p);
  writeFields(loc.sheet, loc.row, loc.info.cols, p);
  return { success: true, id: loc.sheet.getName() + "_" + loc.row };
}

function deleteAlbum(p) {
  var loc = locateRow(p);
  loc.sheet.deleteRow(loc.row);
  return { success: true };
}

/**
 * Find the sheet row for an id like "LOVRO_12". If the Sheet was edited meanwhile and the
 * row no longer holds the expected album, search the tab for it instead of hitting the wrong row.
 */
function locateRow(p) {
  var parts = String(p.id || "").split("_");
  var sheet = resolveOwnerSheet(parts[0]);
  var info = getSheetInfo(sheet);
  var data = info.data, cols = info.cols;
  var row = parseInt(parts[1], 10);
  var expA = norm(p.expectArtist), expB = norm(p.expectAlbum);

  function matches(r0) {
    var d = data[r0];
    return d && norm(d[cols.artist]) === expA && norm(d[cols.album]) === expB;
  }

  if (row > info.headerRow + 1 && row <= data.length && (p.expectArtist === undefined || matches(row - 1))) {
    return { sheet: sheet, row: row, info: info };
  }
  for (var r = info.headerRow + 1; r < data.length; r++) {
    if (matches(r)) return { sheet: sheet, row: r + 1, info: info };
  }
  throw new Error("Album not found – the Sheet changed. Refresh and try again.");
}

function writeFields(sheet, row, cols, p) {
  for (var f = 0; f < FIELDS.length; f++) {
    var field = FIELDS[f][0];
    var c = cols[field];
    if (c === undefined || p[field] === undefined) continue;
    var cell = sheet.getRange(row, c + 1);
    var v = String(p[field] == null ? "" : p[field]).trim();

    if (field === "listenedDate" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      var d = v.split("-");
      cell.setNumberFormat("d.m.yyyy").setValue(new Date(+d[0], +d[1] - 1, +d[2]));
    } else if (field === "rating" || field === "year" || field === "duration") {
      // store as plain text so Sheets never turns "4.5" into a date again
      cell.setNumberFormat("@").setValue(v);
    } else {
      cell.setValue(v);
    }
  }
}

/* ───────────────────────── utils ───────────────────────── */

function norm(v) { return String(v == null ? "" : v).replace(/\s+/g, " ").trim().toLowerCase(); }

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
