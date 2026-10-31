#!/usr/bin/env python3
"""
Sync Firebase Firestore → local Excel file

Usage:
    python sync_to_excel.py --project YOUR_PROJECT_ID --api-key YOUR_API_KEY --output muzika-tracking-muzika.xlsx

Run this periodically (or set up a scheduled task) to keep your local Excel
in sync with the web app data.

Requirements:
    - Python 3.7+
    - openpyxl (pip install openpyxl)
    - Internet connection
"""

import json
import urllib.request
import urllib.error
import argparse
import sys
from datetime import datetime

try:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
except ImportError:
    print("ERROR: openpyxl not installed.")
    print("Run: pip install openpyxl")
    sys.exit(1)


def fetch_albums(project_id, api_key):
    """Pull albums from Firestore via REST API (test mode = open access)."""
    url = (
        f"https://firestore.googleapis.com/v1/projects/{project_id}"
        f"/databases/(default)/documents/albums?key={api_key}"
    )
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"Firestore HTTP error: {e.code} {e.reason}")
        print(e.read().decode())
        sys.exit(1)
    except Exception as e:
        print(f"Request failed: {e}")
        sys.exit(1)

    albums = []
    for doc in data.get("documents", []):
        fields = doc.get("fields", {})

        def getv(key):
            v = fields.get(key, {})
            if "stringValue" in v:
                return v["stringValue"]
            if "integerValue" in v:
                return int(v["integerValue"])
            if "doubleValue" in v:
                return v["doubleValue"]
            if "timestampValue" in v:
                return v["timestampValue"][:10]  # yyyy-mm-dd
            if "booleanValue" in v:
                return "da" if v["booleanValue"] else "ne"
            return ""

        albums.append({
            "owner": getv("owner") or "Unknown",
            "artist": getv("artist"),
            "album": getv("album"),
            "year": str(getv("year")),
            "genre": getv("genre"),
            "listenedDate": getv("listenedDate"),
            "rating": str(getv("rating")),
            "impression": getv("impression"),
            "standoutTracks": getv("standoutTracks"),
            "recommend": getv("recommend"),
            "comments": getv("comments"),
        })
    return albums


def create_workbook(albums, output_path):
    """Write albums to an .xlsx with one sheet per user + a combined sheet."""
    wb = openpyxl.Workbook()
    # Remove default sheet
    if "Sheet" in wb.sheetnames:
        wb.remove(wb["Sheet"])

    header = [
        "Izvođač", "Album", "Godina", "Žanr",
        "Datum Preslušavanja", "Ocjena (1-5)",
        "Dojim Albuma", "Istaknute Pjesme",
        "Preporučam", "Komentari"
    ]

    # Collect owners
    owners = sorted({a["owner"] for a in albums})

    # Create per-owner sheets
    for owner in owners:
        ws = wb.create_sheet(title=owner[:31])  # Excel sheet name max 31 chars
        _write_sheet(ws, header, [a for a in albums if a["owner"] == owner])

    # Create combined "Sve" sheet at front
    ws_all = wb.create_sheet(title="Sve", index=0)
    _write_sheet(ws_all, header + ["Tko"], albums, include_owner=True)

    wb.save(output_path)
    print(f"Saved {len(albums)} albums to: {output_path}")
    print(f"Sheets: {', '.join(wb.sheetnames)}")


def _write_sheet(ws, header, rows, include_owner=False):
    thin = Border(
        left=Side(style="thin", color="444444"),
        right=Side(style="thin", color="444444"),
        top=Side(style="thin", color="444444"),
        bottom=Side(style="thin", color="444444"),
    )
    header_fill = PatternFill(start_color="2d2d35", end_color="2d2d35", fill_type="solid")
    header_font = Font(bold=True, color="e8e8ec", size=11)

    # Header row
    for col, h in enumerate(header, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin

    # Data rows
    for ridx, album in enumerate(rows, 2):
        vals = [
            album["artist"], album["album"], album["year"], album["genre"],
            album["listenedDate"], album["rating"],
            album["impression"], album["standoutTracks"],
            album["recommend"], album["comments"],
        ]
        if include_owner:
            vals.append(album["owner"])
        for cidx, v in enumerate(vals, 1):
            cell = ws.cell(row=ridx, column=cidx, value=v)
            cell.border = thin
            cell.alignment = Alignment(vertical="center", wrap_text=True)
            if cidx == 6 and v:  # Rating column
                try:
                    n = float(v)
                    if n >= 4.5:
                        cell.font = Font(color="2ed573", bold=True)
                    elif n >= 3:
                        cell.font = Font(color="4ecdc4")
                    else:
                        cell.font = Font(color="ff4757")
                except:
                    pass
            if cidx == 9 and v:  # Recommend column
                s = str(v).lower()
                if s.startswith("da"):
                    cell.fill = PatternFill(start_color="1a3a28", end_color="1a3a28", fill_type="solid")
                elif s.startswith("ne"):
                    cell.fill = PatternFill(start_color="3a1a1a", end_color="3a1a1a", fill_type="solid")

    # Auto width
    for col in ws.columns:
        max_len = 0
        col_letter = col[0].column_letter
        for cell in col:
            try:
                max_len = max(max_len, len(str(cell.value)))
            except:
                pass
        ws.column_dimensions[col_letter].width = min(max_len + 3, 50)

    # Freeze header
    ws.freeze_panes = "A2"


def main():
    parser = argparse.ArgumentParser(description="Sync Firestore albums to Excel")
    parser.add_argument("--project", required=True, help="Firebase Project ID")
    parser.add_argument("--api-key", required=True, help="Firebase Web API Key")
    parser.add_argument("--output", default="muzika-tracking-muzika-synced.xlsx", help="Output xlsx path")
    args = parser.parse_args()

    print(f"Fetching albums from Firestore project: {args.project} ...")
    albums = fetch_albums(args.project, args.api_key)
    if not albums:
        print("No albums found.")
        return

    print(f"Found {len(albums)} albums. Generating Excel...")
    create_workbook(albums, args.output)
    print("Done! ✨")


if __name__ == "__main__":
    main()
