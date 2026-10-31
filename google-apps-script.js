/**
 * Muzika Tracker - Google Apps Script
 * 
 * Reads from per-person tabs: HELA, KARLO, LEA, LOVRO, LUCIJA
 * Each tab has its own header format (we detect headers dynamically)
 * Writes new entries to the correct person's tab
 * Edits/deletes by matching the ID column
 */

const SHEET_NAMES = ["HELA", "KARLO", "LEA", "LOVRO", "LUCIJA"];

// Map each person to their main columns (0-indexed after header row detection)
// We auto-detect by matching column headers
const KNOWN_HEADERS = [
  "izvođač", "izvodac", "artist",
  "album", "naziv albuma",
  "godina", "year",
  "žanr", "zanr", "genre",
  "datum preslušavanja", "datum", "date",
  "ocjena (1-5)", "ocjena", "rating",
  "dojam albuma", "dojim albuma", "impression",
  "istaknute pjesme", "istaknute", "standout",
  "preporučam (da/ne)", "preporučam (da/ne)", "preporučam", "recommend",
  "komentarska sekcija", "komentari", "comments",
  "id",
  "trajanje", "trajanje (min)", "duration",
  "vlasnik", "owner",
  "timestamp",
  "dojam", "dojim"
];

function getOrCreateSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(["Izvođač", "Album", "Godina", "Žanr", "Datum Preslušavanja", "Ocjena (1-5)", "Dojim Albuma", "Istaknute Pjesme", "Preporučam (Da/Ne)", "Komentarska sekcija"]);
  }
  return sheet;
}

function detectHeaders(sheet) {
  // Try to find header row in first 6 rows
  var maxRows = sheet.getLastRow();
  if (maxRows == 0) return { headerRow: 0, cols: {} };
  var data = sheet.getRange(1, 1, Math.min(maxRows, 6), sheet.getLastColumn()).getValues();
  
  var bestRow = -1;
  var bestScore = 0;
  
  for (var r = 0; r < data.length; r++) {
    var score = 0;
    var rowLower = data[r].map(function(c) { return String(c).toLowerCase().trim(); });
    
    // Check for known header keywords
    if (rowLower.some(function(h) { return /^izvo|^artist/.test(h); })) score += 100;
    if (rowLower.some(function(h) { return /^album/.test(h); })) score += 90;
    if (rowLower.some(function(h) { return /^godi/.test(h); })) score += 80;
    if (rowLower.some(function(h) { return /^ocjena|^rating/.test(h); })) score += 70;
    if (rowLower.some(function(h) { return /^datum/.test(h); })) score += 60;
    if (rowLower.some(function(h) { return /^zanr|^žanr|^genre/.test(h); })) score += 50;
    if (rowLower.some(function(h) { return /^dojam|^dojim/.test(h); })) score += 40;
    if (rowLower.some(function(h) { return /^istak/.test(h); })) score += 30;
    if (rowLower.some(function(h) { return /^prepor/.test(h); })) score += 20;
    if (rowLower.some(function(h) { return /^koment/.test(h); })) score += 10;
    
    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }
  
  if (bestScore < 50) return { headerRow: -1, cols: {} }; // No header found
  
  var headerRow = bestRow;
  var headers = data[headerRow].map(function(c) { return String(c).toLowerCase().trim(); });
  
  // Map columns
  var cols = {};
  var colMap = {
    "izvođač": "artist", "izvodac": "artist", "artist": "artist",
    "album": "album", "naziv albuma": "album",
    "godina": "year", "year": "year",
    "žanr": "genre", "zanr": "genre", "genre": "genre",
    "datum preslušavanja": "date", "datum": "date", "date": "date",
    "ocjena (1-5)": "rating", "ocjena": "rating", "rating": "rating",
    "dojam albuma": "impression", "dojim albuma": "impression", "dojam": "impression", "dojim": "impression", "impression": "impression",
    "istaknute pjesme": "tracks", "istaknute": "tracks", "standout": "tracks",
    "preporučam (da/ne)": "recommend", "preporučam (da/ne)": "recommend", "preporučam": "recommend", "recommend": "recommend",
    "komentarska sekcija": "comments", "komentari": "comments", "comments": "comments",
    "id": "id",
    "trajanje": "duration", "trajanje (min)": "duration", "duration": "duration",
    "vlasnik": "owner", "owner": "owner",
    "timestamp": "timestamp"
  };
  
  for (var i = 0; i < headers.length; i++) {
    var h = headers[i];
    for (var key in colMap) {
      if (h.indexOf(key) !== -1) {
        cols[colMap[key]] = i;
        break;
      }
    }
  }
  
  return { headerRow: headerRow, cols: cols };
}

function getAllAlbums() {
  var all = [];
  
  for (var si = 0; si < SHEET_NAMES.length; si++) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAMES[si]);
    if (!sheet) continue;
    
    var result = detectHeaders(sheet);
    if (result.headerRow < 0) continue;
    
    var owner = SHEET_NAMES[si];
    var data = sheet.getDataRange().getValues();
    
    for (var r = result.headerRow + 1; r < data.length; r++) {
      var row = data[r];
      // Skip empty rows or month divider rows
      var artist = readCol(row, result.cols, "artist", "");
      var album = readCol(row, result.cols, "album", "");
      if (!artist && !album) continue;
      // Skip month headers (long emoji-heavy strings without actual content)
      if (isDividerRow(row, result.cols)) continue;
      
      all.push({
        id: owner + "_" + r,
        artist: artist,
        album: album,
        year: readCol(row, result.cols, "year", ""),
        genre: readCol(row, result.cols, "genre", ""),
        listenedDate: readCol(row, result.cols, "date", ""),
        rating: readCol(row, result.cols, "rating", ""),
        impression: readCol(row, result.cols, "impression", ""),
        standoutTracks: readCol(row, result.cols, "tracks", ""),
        recommend: readCol(row, result.cols, "recommend", ""),
        comments: readCol(row, result.cols, "comments", ""),
        duration: readCol(row, result.cols, "duration", ""),
        owner: owner,
        _sheetIndex: si,
        _rowNum: r
      });
    }
  }
  
  return all;
}

function readCol(row, cols, key, fallback) {
  var idx = cols[key];
  if (idx !== undefined && idx !== null && idx < row.length) {
    return String(row[idx]).trim();
  }
  return fallback;
}

function isDividerRow(row, cols) {
  // Check if this row looks like a month divider (text-heavy cols empty, only one long string)
  var artistI = cols["artist"];
  var albumI = cols["album"];
  if (artistI !== undefined && row[artistI] && String(row[artistI]).indexOf(".") > 0 && String(row[artistI]).length > 3) {
    // Could be a date like "12.1." - that's a valid entry
    if (!row[1] || String(row[1]).length > 15) {
      // Check if it looks like a month name with emoji
      var val = String(row[artistI] || "") + String(row[albumI] || "");
      if (val.length > 5 && val.indexOf("☾") !== -1 || val.indexOf("⋆") !== -1 || val.indexOf("✮") !== -1 || val.indexOf("♥") !== -1) {
        return true;
      }
    }
  }
  return false;
}

function doGet(e) {
  return getAllAlbumsJson();
}

function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action;

    if (action === "add") return addAlbum(params);
    if (action === "update") return updateAlbum(params);
    if (action === "delete") return deleteAlbum(params);
    return jsonResponse({ error: "Unknown action: " + action });
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function getAllAlbumsJson() {
  var albums = getAllAlbums();
  return jsonResponse({ albums: albums, count: albums.length, success: true });
}

function addAlbum(params) {
  var owner = params.owner || "Unknown";
  // Find matching sheet
  var sheetName = owner;
  var found = false;
  for (var i = 0; i < SHEET_NAMES.length; i++) {
    if (SHEET_NAMES[i].toLowerCase() === owner.toLowerCase()) {
      sheetName = SHEET_NAMES[i];
      found = true;
      break;
    }
  }
  if (!found) sheetName = SHEET_NAMES[0]; // fallback to first
  
  var sheet = getOrCreateSheet(sheetName);
  var result = detectHeaders(sheet);
  
  if (result.headerRow < 0) {
    // No header found, add one
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, 10).setValues([["Izvođač", "Album", "Godina", "Žanr", "Datum Preslušavanja", "Ocjena (1-5)", "Dojim Albuma", "Istaknute Pjesme", "Preporučam (Da/Ne)", "Komentarska sekcija"]]);
    result = detectHeaders(sheet);
  }
  
  var row = [];
  var totalCols = sheet.getLastColumn();
  if (totalCols < 10) totalCols = 10;
  
  for (var i = 0; i < totalCols; i++) {
    row.push("");
  }
  
  setCol(row, result.cols, "artist", params.artist || "");
  setCol(row, result.cols, "album", params.album || "");
  setCol(row, result.cols, "year", params.year || "");
  setCol(row, result.cols, "genre", params.genre || "");
  setCol(row, result.cols, "date", params.listenedDate || "");
  setCol(row, result.cols, "rating", params.rating || "");
  setCol(row, result.cols, "impression", params.impression || "");
  setCol(row, result.cols, "tracks", params.standoutTracks || "");
  setCol(row, result.cols, "recommend", params.recommend || "");
  setCol(row, result.cols, "comments", params.comments || "");
  setCol(row, result.cols, "duration", params.duration || "");
  
  sheet.appendRow(row);
  
  return jsonResponse({ success: true, owner: owner });
}

function updateAlbum(params) {
  // Find album by ID across all sheets
  var parts = params.id.split("_");
  var ownerGuess = parts[0];
  
  for (var si = 0; si < SHEET_NAMES.length; si++) {
    if (SHEET_NAMES[si].toLowerCase() !== ownerGuess.toLowerCase()) continue;
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAMES[si]);
    if (!sheet) continue;
    
    var result = detectHeaders(sheet);
    if (result.headerRow < 0) continue;
    
    var data = sheet.getDataRange().getValues();
    var rowNum = parseInt(parts[1]) + 1;
    
    if (rowNum > 0 && rowNum <= data.length) {
      var row = data[rowNum - 1];
      // Verify this is still a valid entry
      if (row[0] && String(row[0]).trim()) {
        for (var c = 0; c < row.length; c++) {
          var colName = getColNameByIndex(result.cols, c);
          if (colName === "artist") sheet.getRange(rowNum, c + 1).setValue(params.artist || "");
          else if (colName === "album") sheet.getRange(rowNum, c + 1).setValue(params.album || "");
          else if (colName === "year") sheet.getRange(rowNum, c + 1).setValue(params.year || "");
          else if (colName === "genre") sheet.getRange(rowNum, c + 1).setValue(params.genre || "");
          else if (colName === "date") sheet.getRange(rowNum, c + 1).setValue(params.listenedDate || "");
          else if (colName === "rating") sheet.getRange(rowNum, c + 1).setValue(params.rating || "");
          else if (colName === "impression") sheet.getRange(rowNum, c + 1).setValue(params.impression || "");
          else if (colName === "tracks") sheet.getRange(rowNum, c + 1).setValue(params.standoutTracks || "");
          else if (colName === "recommend") sheet.getRange(rowNum, c + 1).setValue(params.recommend || "");
          else if (colName === "comments") sheet.getRange(rowNum, c + 1).setValue(params.comments || "");
        }
        return jsonResponse({ success: true });
      }
    }
  }
  
  return jsonResponse({ error: "Album not found: " + params.id });
}

function deleteAlbum(params) {
  var parts = params.id.split("_");
  var ownerGuess = parts[0];
  
  for (var si = 0; si < SHEET_NAMES.length; si++) {
    if (SHEET_NAMES[si].toLowerCase() !== ownerGuess.toLowerCase()) continue;
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAMES[si]);
    if (!sheet) continue;
    
    var result = detectHeaders(sheet);
    if (result.headerRow < 0) continue;
    
    var rowNum = parseInt(parts[1]) + 1;
    if (rowNum > result.headerRow + 1 && rowNum <= sheet.getLastRow()) {
      sheet.deleteRow(rowNum);
      return jsonResponse({ success: true });
    }
  }
  
  return jsonResponse({ error: "Album not found: " + params.id });
}

function setCol(row, cols, key, value) {
  var idx = cols[key];
  if (idx !== undefined && idx < row.length) {
    row[idx] = value;
  }
}

function getColNameByIndex(cols, index) {
  for (var key in cols) {
    if (cols[key] === index) return key;
  }
  return null;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type");
}