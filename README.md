# 🎵 Muzika Tracker

Replaces the Excel music tracker with a real-time web app that uses **your Google Sheet** as the backend.

## How it works

- Your Google Sheet is the **single source of truth** (no separate database)
- The web app shows the same data in a **mobile-friendly UI**
- When anyone adds/edits in the **app**, it writes directly to the **Sheet**
- When anyone edits the **Sheet** directly, the **app** sees it in ~5 seconds
- Everyone can still download the `.xlsx` anytime — the Sheet IS the Excel

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | The entire web app (single file). Host on GitHub Pages or open locally. |
| `google-apps-script.js` | **Apps Script code** you paste into your Google Sheet. This turns the sheet into an API. |
| `muzika-tracking-muzika.xlsx` | Your original data. |

---

## Setup (10 minutes total)

### Step 1: Create the Google Sheet

**Option A — Upload your existing Excel:**
1. Go to [Google Sheets](https://sheets.google.com)
2. Click **+ Blank**
3. File → Import → Upload → select `muzika-tracking-muzika.xlsx`
4. It will create tabs for each person. Good.

**Option B — Start fresh (simpler):**
1. Create a new blank Google Sheet
2. Rename the first tab to **exactly**: `Albums`
3. Paste this header row in cell **A1**:

```
ID | Izvođač | Album | Godina | Žanr | Datum Preslušavanja | Ocjena (1-5) | Dojim Albuma | Istaknute Pjesme | Preporučam | Komentari | Owner | Timestamp
```

*(You can copy-paste it as one row with `|` as separators, then use Data → Split text to columns)*

**If you used Option A (uploaded Excel):**
- Create a new tab called `Albums`
- Paste the header row above
- Copy all data from the existing person-tabs into this one combined tab
- Add the `Owner` column (write the person's name in every row)
- Leave `ID` and `Timestamp` columns empty for now — the app fills them automatically

---

### Step 2: Add the Apps Script (the API)

1. In your Google Sheet, click **Extensions** → **Apps Script**
2. Delete the default `myFunction()` code
3. Open `google-apps-script.js` from this repo → **copy everything**
4. Paste it into the Apps Script editor
5. Click **Save** (floppy disk icon, or Ctrl+S)
6. Click **Deploy** (top right) → **New deployment**
7. Click the **gear icon** ⚙️ → choose **Web app**
8. Fill in:
   - **Description**: `muzika-api`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
9. Click **Deploy** → **Authorize access**
10. Google will show a scary screen → click through (this is normal)
11. Copy the **Web app URL** (looks like `https://script.google.com/macros/s/.../exec`)

---

### Step 3: Plug the URL into the app

Open `index.html` in VS Code (or any text editor).

Find this line near the top:

```javascript
const API_URL = "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec";
```

Replace the entire URL with the one you copied from Apps Script. Save.

---

### Step 4: Host on GitHub Pages

**Create GitHub repo:**
1. https://github.com/new
2. Name: `muzika-tracker` → **Public**
3. Leave everything unchecked → **Create** 

**Push the code:**

```bash
git remote add origin https://github.com/YOUR_USERNAME/muzika-tracker.git
git branch -M main
git push -u origin main
```

*(Replace `YOUR_USERNAME` with your real GitHub username)*

**Enable Pages:**
1. On your repo page → **Settings** → **Pages**
2. Source: **Deploy from a branch** → `main` → `/(root)` → **Save**
3. Wait 1 minute, then visit:

```
https://YOUR_USERNAME.github.io/muzika-tracker
```

---

## Using the app

1. **Open the app** on your phone
2. **Pick your name** (Hela, Karlo, Lea, Lovro, Lucija)
3. **Tap ＋ Add** → fill the form → it appears in your Sheet instantly
4. **Open the Sheet** on your computer → same data, updated live
5. **Tap 📥** to download a fresh `.xlsx` with all albums anytime

---

## What everyone gets

- ✅ **One Google Sheet** = the single truth
- ✅ **Add albums from phone** — easier than Excel
- ✅ **Edit on desktop** — the Sheet works like always
- ✅ **Per-user styling** — everyone picks their own theme/view in the app
- ✅ **Search/filter** — find any album fast
- ✅ **Export** — download `.xlsx` anytime
- ✅ **No Firebase, no accounts, no extra cost**

---

## Troubleshooting

**"Check API_URL in the code" appears:**
- You forgot Step 3 — paste your Apps Script URL into `index.html`

**Changes from the app don't show in the Sheet:**
- Check that the `Albums` tab name is spelled exactly that way
- Check that row 1 has the headers
- Re-open the app (refresh)

**CORS error in browser console:**
- In Apps Script, re-deploy with `Anyone` access (not `Only myself`)

**Need to re-deploy after changing the script:**
- Every time you edit the Apps Script code, click **Deploy** → **Manage deployments** → **Edit** (pencil) → **New version** → **Deploy**

---

Built to replace your Excel with something your friends will actually use on their phones 🎧
