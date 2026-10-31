# 🎵 Muzika Tracker

Replaces the Excel music tracker with a real-time web app + keeps Excel synced.

---

## What's included

| File | Purpose |
|------|---------|
| `index.html` | **The app.** One file → host anywhere. Real-time Firebase sync. |
| `sync_to_excel.py` | Pulls from Firebase → generates updated `.xlsx` locally. |
| `muzika-tracking-muzika.xlsx` | Your original data. |

---

## Quick start (what you need to do)

You have to do **2 things** (I can't log into your accounts):

1. **Firebase** — create free project → copy 6 values → paste into `index.html`
2. **GitHub** — create empty repo → run 3 commands I give you

That's it. Total time: ~5 minutes.

---

## 1. Firebase Setup (real-time database)

### Step A: Create project

1. Go to **https://console.firebase.google.com**
2. Click **"Add project"**
3. Name: `muzika-tracker` → Continue → Continue → **Create project**

### Step B: Enable Firestore

1. Left sidebar → **Build** → **Firestore Database**
2. **"Create database"**
3. Choose **"Start in test mode"**
4. Region: pick closest (e.g. `eur3` for Europe) → **Enable**

### Step C: Get your config

1. Click **⚙️ gear** next to **Project Overview** → **Project settings**
2. Scroll to **"Your apps"** → click **</>** (web icon)
3. Nickname: `muzika` → **Register app**
4. Copy this block:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "muzika-tracker-12345.firebaseapp.com",
  projectId: "muzika-tracker-12345",
  storageBucket: "muzika-tracker-12345.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123..."
};
```

### Step D: Paste into the app

Open `index.html` in VS Code (or any editor). Find this section near the top:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

Replace those 6 placeholder values with your real ones. **Save.**

### Step E: Lock down rules (optional but recommended later)

In Firebase Console → Firestore Database → **Rules**, replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /albums/{album} {
      allow read, write: if true;
    }
  }
}
```

*("if true" means anyone can read/write. Good for friends/family. Later you can add auth.)*

---

## 2. Host on GitHub (free)

### Step A: Create GitHub repo

1. Go to **https://github.com/new**
2. Repository name: `muzika-tracker`
3. Keep it **Public**
4. **DO NOT** check "Add README" — leave everything unchecked
5. Click **Create repository**

### Step B: Push this code

Copy-paste these 3 commands into your terminal (in this folder):

```bash
git remote add origin https://github.com/YOUR_USERNAME/muzika-tracker.git
git branch -M main
git push -u origin main
```

*(Replace `YOUR_USERNAME` with your actual GitHub username)*

### Step C: Enable GitHub Pages

1. On your new repo page, click **Settings**
2. Left sidebar → **Pages**
3. Source: **Deploy from a branch** → select `main` → folder `/(root)` → **Save**
4. Wait 1 minute, then visit: `https://YOUR_USERNAME.github.io/muzika-tracker`

---

## 3. Migrate existing Excel data

Option A — **Import in the app** (easiest):
1. Open the app in your browser
2. Click 📤 (Import) in the top bar
3. Select your `muzika-tracking-muzika.xlsx`
4. It auto-detects sheets and uploads everything to Firebase

Option B — **Python script** (for automation):
```bash
# Requirements: pip install openpyxl requests
# Then run:
python sync_to_excel.py --project YOUR_PROJECT_ID --api-key YOUR_API_KEY --output muzika-tracking-muzika.xlsx
```

---

## 4. Keep Excel synced

The app has a **📥 Export** button that downloads a fresh `.xlsx` with all current data anytime.

For automatic syncing, run the Python script when you want an update:

```bash
python sync_to_excel.py --project YOUR_PROJECT_ID --api-key YOUR_API_KEY --output muzika-tracking-muzika.xlsx
```

Or set up a Windows Task Scheduler / cron job to run it daily.

---

## App features

- ✅ **Real-time** — everyone sees changes instantly across all devices
- ✅ **No login** — pick your name, start tracking
- ✅ **Mobile-first** — way easier than Excel on phone
- ✅ **Per-user customization** — theme, font, view mode (card / compact)
- ✅ **Search + filter** — find anything fast
- ✅ **Export/Import** — Excel ↔ Firebase in both directions

---

## Files in repo

```
muzika-tracker/
├── index.html              # Single-file web app (CSS+JS+HTML)
├── sync_to_excel.py        # Python script: Firebase → Excel
├── muzika-tracking-muzika.xlsx   # Original data
└── README.md               # This file
```

Built to replace your Excel with something your friends will actually use on their phones 🎧
