/**
 * Google Apps Script for Muzika Tracker
 *
 * How to use:
 * 1. Create a new Google Sheet (or upload your Excel as Google Sheets)
 * 2. Make sure the first tab is named exactly: "Albums"
 * 3. Row 1 must have these headers:
 *    ID | Izvođač | Album | Godina | Žanr | Datum Preslušavanja | Ocjena (1-5) | Dojim Albuma | Istaknute Pjesme | Preporučam | Komentari | Owner | Timestamp
 * 4. Go to Extensions → Apps Script
 * 5. Delete the default code, paste ALL of this file's content
 * 6. Click Save (floppy disk icon)
 * 7. Click Deploy → New deployment
 * 8. Type: Web app
 * 9. Execute as: Me
 * 10. Who has access: Anyone
 * 11. Click Deploy → copy the Web app URL
 * 12. Paste that URL into index.html where it says YOUR_GOOGLE_SCRIPT_URL
 */

const SHEET_NAME = "Albums";

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    var headers = [
      "ID", "Izvođač", "Album", "Godina", "Žanr",
      "Datum Preslušavanja", "Ocjena (1-5)", "Dojim Albuma",
      "Istaknute Pjesme", "Preporučam", "Komentari",
      "Owner", "Timestamp"
    ];
    sheet.appendRow(headers);
    // Style header row
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold").setBackground("#1a1a1f").setFontColor("#e8e8ec");
  }
  return sheet;
}

function doGet(e) {
  var action = e.parameter.action || "getAlbums";

  if (action === "getAlbums") {
    return getAlbumsJson();
  }

  // Fallback
  return jsonResponse({ error: "Unknown GET action: " + action });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action;

    if (action === "add") {
      return addAlbum(params);
    } else if (action === "update") {
      return updateAlbum(params);
    } else if (action === "delete") {
      return deleteAlbum(params);
    } else {
      return jsonResponse({ error: "Unknown action: " + action });
    }
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function getAlbumsJson() {
  var sheet = getSheet();
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return jsonResponse({ albums: [] });
  }

  var albums = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[1] && !row[2]) continue; // skip empty
    albums.push({
      id: row[0],
      artist: row[1],
      album: row[2],
      year: row[3],
      genre: row[4],
      listenedDate: row[5],
      rating: row[6],
      impression: row[7],
      standoutTracks: row[8],
      recommend: row[9],
      comments: row[10],
      owner: row[11],
      timestamp: row[12]
    });
  }

  return jsonResponse({ albums: albums, count: albums.length });
}

function addAlbum(params) {
  var sheet = getSheet();
  var id = Utilities.getUuid();
  var now = new Date().toISOString();

  var row = [
    id,
    params.artist || "",
    params.album || "",
    params.year || "",
    params.genre || "",
    params.listenedDate || "",
    params.rating || "",
    params.impression || "",
    params.standoutTracks || "",
    params.recommend || "",
    params.comments || "",
    params.owner || "Unknown",
    now
  ];

  sheet.appendRow(row);
  return jsonResponse({ success: true, id: id });
}

function updateAlbum(params) {
  var sheet = getSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(params.id)) {
      var rowNum = i + 1;
      sheet.getRange(rowNum, 2).setValue(params.artist || "");
      sheet.getRange(rowNum, 3).setValue(params.album || "");
      sheet.getRange(rowNum, 4).setValue(params.year || "");
      sheet.getRange(rowNum, 5).setValue(params.genre || "");
      sheet.getRange(rowNum, 6).setValue(params.listenedDate || "");
      sheet.getRange(rowNum, 7).setValue(params.rating || "");
      sheet.getRange(rowNum, 8).setValue(params.impression || "");
      sheet.getRange(rowNum, 9).setValue(params.standoutTracks || "");
      sheet.getRange(rowNum, 10).setValue(params.recommend || "");
      sheet.getRange(rowNum, 11).setValue(params.comments || "");
      sheet.getRange(rowNum, 12).setValue(params.owner || "");
      sheet.getRange(rowNum, 13).setValue(new Date().toISOString());
      return jsonResponse({ success: true });
    }
  }

  return jsonResponse({ error: "Album not found: " + params.id });
}

function deleteAlbum(params) {
  var sheet = getSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(params.id)) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ success: true });
    }
  }

  return jsonResponse({ error: "Album not found: " + params.id });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type");
}
