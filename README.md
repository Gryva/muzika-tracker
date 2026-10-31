# 🎵 Muzika Tracker

A lightweight, real-time collaborative music album tracking app. Replaces the Excel spreadsheet with a mobile-friendly web app where everyone can add albums, see changes instantly, and customize their own view.

---

## Features

- ✅ **Real-time sync** — Everyone sees new albums instantly
- ✅ **No login** — Pick your name, start tracking
- ✅ **Mobile-first** — Designed for phones; way easier than Excel on mobile
- ✅ **Per-user customization** — Each person picks their own theme color, font, and view mode (card / compact)
- ✅ **Search + filter** — Find any album fast
- ✅ **Minimal + fast** — Single HTML file, no build step

---

## 🚀 Setup (5 minutes)

You need a free **Firebase** project for the real-time database.

### 1. Create a Firebase project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"**
3. Name it (e.g. `muzika-tracker`) → Continue → Continue → **Create project**

### 2. Enable Firestore

1. In the left sidebar, click **Build** → **Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in test mode"** (allows reads/writes for now)
4. Click **Next** → pick a region close to you (e.g. `eur3` for Europe) → **Enable**

### 3. Get your config

1. Click the **⚙️ gear icon** next to **Project Overview** → **Project settings**
2. Scroll down to **"Your apps"** → click **</> (web icon)**
3. App nickname: `muzika` → **Register app**
4. Copy the `firebaseConfig` block (it has `apiKey`, `authDomain`, `projectId`, etc.)

### 4. Paste into the app

Open `index.html` and replace the placeholder config:

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

### 5. Host it (choose one)

#### Option A: Just open the file
Double-click `index.html` — it works locally. **Everyone needs to be on the same network** for this to sync... actually no, Firebase works from anywhere. But the file needs to be served over HTTP/HTTPS for best mobile behavior.

#### Option B: GitHub Pages (free, recommended)
1. Push this repo to GitHub
2. Go to **Settings** → **Pages**
3. Source: **Deploy from a branch** → `main` / `root`
4. Your app is live at `https://yourname.github.io/muzika-tracker`

#### Option C: Netlify Drop (drag & drop)
1. Go to [https://app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag `index.html` onto the page
3. Instant live URL — share it with everyone

---

## 📱 How to use

1. **Open the link** on your phone
2. **Pick your name** (Hela, Karlo, Lea, Lovro, Lucija) or view-only guest
3. **Tap ＋ Add** to add an album
4. **Tap ⚙️** to customize your theme, font, and view mode
5. **Swipe between tabs** to see All / Hela / Karlo / etc.
6. **Toggle 👁️ All / 🙈 Mine** to focus on your own list

### Fields you can fill
| Field | Example |
|-------|---------|
| Artist | Pink Floyd |
| Album | Animals |
| Year | 1977 |
| Genre | Progressive rock |
| Date Listened | 2026-01-20 |
| Rating | 5, 4.5, 5+ |
| Impression | "creme de la creme" |
| Standout Tracks | Dogs, Pigs, Sheep |
| Recommend | ✅ Da / ❌ Ne / 🤷 Meh |
| Comments | Anything extra |

---

## 🛡️ Security note

The app starts with **Firestore in test mode** (open to all). Once you're happy with it, lock it down:

1. Firebase Console → Firestore Database → **Rules**
2. Replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /albums/{album} {
      allow read: if true;
      allow write: if request.auth == null;  // or remove this line entirely for open access
    }
  }
}
```

Or add Firebase Auth later if you want real user accounts.

---

## 🎨 Customization ideas (future)

- Import your existing Excel data (I can write a Python script)
- Add cover art auto-fetch from Spotify/Discogs API
- Monthly stats / charts
- "Listenlist" separate wishlist tab

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | The entire app (CSS + JS + HTML in one file) |
| `README.md` | This file |
| `muzika-tracking-muzika.xlsx` | Your original Excel data |

---

Built to replace the Excel with something your friends will actually use on their phones 🎧
