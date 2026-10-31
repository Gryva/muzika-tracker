/**
 * Muzika Tracker - Google Apps Script
 * 
 * Reads from per-person tabs: HELA, KARLO, LEA, LOVRO, LUCIJA
 * Each tab has its own header format (we detect headers dynamically)
 * Writes new entries to the correct person's tab
 */

const SHEET_NAMES = ["HELA", "KARLO", "LEA", "LOVRO", "LUCIJA"];

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
    return jsonResponse({ error: "Unknown action" });
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

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
  var maxRows = sheet.getLastRow();
  if (maxRows == 0) return { headerRow: -1, cols: {} };
  
  var maxCols = sheet.getLastColumn();
  if (maxCols == 0) return { headerRow: -1, cols: {} };
  
  var data = sheet.getRange(1, 1, Math.min(maxRows, 8), maxCols).getValues();
  
  var bestRow = -1;
  var bestScore = 0;
  
  for (var r = 0; r < data.length; r++) {
    var score = 0;
    var rowLower = data[r].map(function(c) { return String(c).toLowerCase().trim(); });
    
    for (var c = 0; c < rowLower.length; c++) {
      var h = rowLower[c];
      if (/^izvo|^artist/.test(h)) score += 100;
      else if (/^album/.test(h)) score += 90;
      else if (/^god|^year/.test(h)) score += 80;
      else if (/^ocjena|^rating/.test(h)) score += 70;
      else if (/^datum/.test(h)) score += 60;
      else if (/^zanr|^žanr|^genre/.test(h)) score += 50;
      else if (/^dojam|^dojim|^impression/.test(h)) score += 40;
      else if (/^istak/.test(h)) score += 30;
      else if (/^prepor/.test(h)) score += 20;
      else if (/^koment/.test(h)) score += 10;
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }
  
  if (bestScore < 50) return { headerRow: -1, cols: {} };
  
  var headers = data[bestRow].map(function(c) { return String(c).toLowerCase().trim(); });
  
  var cols = {};
  
  for (var i = 0; i < headers.length; i++) {
    var h = headers[i];
    if (/^izvo|^artist/.test(h)) cols["artist"] = i;
    else if (/^album/.test(h)) cols["album"] = i;
    else if (/^god|^year/.test(h)) cols["year"] = i;
    else if (/^zanr|^žanr|^genre/.test(h)) cols["genre"] = i;
    else if (/^datum/.test(h)) cols["date"] = i;
    else if (/^ocjena|^rating/.test(h)) cols["rating"] = i;
    else if (/^dojam|^dojim|^impression/.test(h)) cols["impression"] = i;
    else if (/^istak/.test(h)) cols["tracks"] = i;
    else if (/^prepor/.test(h)) cols["recommend"] = i;
    else if (/^koment/.test(h)) cols["comments"] = i;
    else if (/^trajanje|^trajan|^duration/.test(h)) cols["duration"] = i;
    else if (/^vlasnik|^owner/.test(h)) cols["owner"] = i;
  }
  
  return { headerRow: bestRow, cols: cols };
}

function getAllAlbums() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var all = [];
  
  for (var si = 0; si < SHEET_NAMES.length; si++) {
    var sheet = ss.getSheetByName(SHEET_NAMES[si]);
    if (!sheet) continue;
    
    var result = detectHeaders(sheet);
    if (result.headerRow < 0) continue;
    
    var owner = SHEET_NAMES[si];
    var data = sheet.getDataRange().getValues();
    
    for (var r = result.headerRow + 1; r < data.length; r++) {
      var row = data[r];
      var artist = String(row[result.cols["artist"]] || "").trim();
      var album = String(row[result.cols["album"]] || "").trim();
      
      if (!artist && !album) continue;
      
      // Skip month dividers
      var combined = artist + album;
      if (/[☾⋆✮♥☘︎≽≼^•⩊•^]/.test(combined) && combined.length > 5 && combined.length < 30) continue;
      
      all.push({
        id: owner + "_" + r + "_" + Utilities.getUuid().substring(0, 6),
        artist: artist,
        album: album,
        year: String(row[result.cols["year"]] || "").trim(),
        genre: String(row[result.cols["genre"]] || "").trim(),
        listenedDate: String(row[result.cols["date"]] || "").trim(),
        rating: String(row[result.cols["rating"]] || "").trim(),
        impression: String(row[result.cols["impression"]] || "").trim(),
        standoutTracks: String(row[result.cols["tracks"]] || "").trim(),
        recommend: String(row[result.cols["recommend"]] || "").trim(),
        comments: String(row[result.cols["comments"]] || "").trim(),
        duration: String(row[result.cols["duration"]] || "").trim(),
        owner: owner,
        _sheetIndex: si,
        _rowNum: r
      });
    }
  }
  
  return all;
}

function getAllAlbumsJson() {
  var albums = getAllAlbums();
  var output = JSON.stringify({ albums: albums, count: albums.length, success: true });
  return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JSON);
}

function addAlbum(params) {
  var owner = params.owner || SHEET_NAMES[0];
  var sheetName = owner;
  var found = false;
  
  for (var i = 0; i < SHEET_NAMES.length; i++) {
    if (SHEET_NAMES[i].toLowerCase() === owner.toLowerCase()) {
      sheetName = SHEET_NAMES[i];
      found = true;
      break;
    }
  }
  
  var sheet = getOrCreateSheet(sheetName);
  var result = detectHeaders(sheet);
  
  if (result.headerRow < 0) {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, 10).setValues([["Izvođač", "Album", "Godina", "Žanr", "Datum Preslušavanja", "Ocjena (1-5)", "Dojim Albuma", "Istaknute Pjesme", "Preporučam (Da/Ne)", "Komentarska sekcija"]]);
    result = detectHeaders(sheet);
  }
  
  var totalCols = Math.max(sheet.getLastColumn(), 11);
  var newRow = [];
  for (var c = 1; c <= totalCols; c++) newRow.push("");
  
  var artistIdx = result.cols["artist"] !== undefined ? result.cols["artist"] + 1 : 1;
  var albumIdx = result.cols["album"] !== undefined ? result.cols["album"] + 1 : 2;
  
  sheet.appendRow([params.artist || "", params.album || "", params.year || "", params.genre || "", params.listenedDate || "", params.rating || "", params.impression || "", params.standoutTracks || "", params.recommend || "", params.comments || ""]);
  
  return jsonResponse({ success: true, owner: owner });
}

function updateAlbum(params) {
  var parts = params.id.split("_");
  var owner = parts[0];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  for (var si = 0; si < SHEET_NAMES.length; si++) {
    if (SHEET_NAMES[si].toLowerCase() !== owner.toLowerCase()) continue;
    var sheet = ss.getSheetByName(SHEET_NAMES[si]);
    if (!sheet) continue;
    
    var result = detectHeaders(sheet);
    if (result.headerRow < 0) continue;
    
    var data = sheet.getDataRange().getValues();
    var rowNum = parseInt(parts[1]) + 1;
    
    if (rowNum > 0 && rowNum <= data.length) {
      var row = data[rowNum - 1];
      if (row[0] && String(row[0]).trim()) {
        var cols = result.cols;
        if (cols["artist"] !== undefined) sheet.getRange(rowNum, cols["artist"] + 1).setValue(params.artist || "");
        if (cols["album"] !== undefined) sheet.getRange(rowNum, cols["album"] + 1).setValue(params.album || "");
        if (cols["year"] !== undefined) sheet.getRange(rowNum, cols["year"] + 1).setValue(params.year || "");
        if (cols["genre"] !== undefined) sheet.getRange(rowNum, cols["genre"] + 1).setValue(params.genre || "");
        if (cols["date"] !== undefined) sheet.getRange(rowNum, cols["date"] + 1).setValue(params.listenedDate || "");
        if (cols["rating"] !== undefined) sheet.getRange(rowNum, cols["rating"] + 1).setValue(params.rating || "");
        if (cols["impression"] !== undefined) sheet.getRange(rowNum, cols["impression"] + 1).setValue(params.impression || "");
        if (cols["tracks"] !== undefined) sheet.getRange(rowNum, cols["tracks"] + 1).setValue(params.standoutTracks || "");
        if (cols["recommend"] !== undefined) sheet.getRange(rowNum, cols["recommend"] + 1).setValue(params.recommend || "");
        if (cols["comments"] !== undefined) sheet.getRange(rowNum, cols["comments"] + 1).setValue(params.comments || "");
        return jsonResponse({ success: true });
      }
    }
  }
  
  return jsonResponse({ error: "Not found" });
}

function deleteAlbum(params) {
  var parts = params.id.split("_");
  var owner = parts[0];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  for (var si = 0; si < SHEET_NAMES.length; si++) {
    if (SHEET_NAMES[si].toLowerCase() !== owner.toLowerCase()) continue;
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
  
  return jsonResponse({ error: "Not found" });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}