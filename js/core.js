/* Muzika Tracker – core: config, storage, API, offline outbox, derived data, notifications */

// ═══════════════ CONFIG ═══════════════
const DEFAULT_API = "https://script.google.com/macros/s/AKfycbzJS-Tai3YMQH5xXeEyt_p2lFANFKrBKIVHgdCzjfOwSyVuceUzUB-VSlr6sgTGoI-4/exec";
(() => { // ?api=<url> lets you point the app at a test backend; ?api=default resets
  const q = new URLSearchParams(location.search).get("api");
  if (q === "default") localStorage.removeItem("muzika_api");
  else if (q) localStorage.setItem("muzika_api", q);
})();
const API_URL = localStorage.getItem("muzika_api") || DEFAULT_API;
const POLL_MS = 10000;
const GUEST = "__guest__";

const MONTH_NAMES = ["Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj", "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac"];
const DEFAULT_MONTH_COLORS = ["#6ec6ff", "#b39dff", "#6fe3a1", "#ffd166", "#a3e635", "#ffb36b", "#ff7b7b", "#ff8fc8", "#e0a96d", "#ff8a3d", "#a0a7c8", "#7fd8e8"];
const REACTIONS = ["🔥", "❤️", "😍", "🤘", "😮", "💤"];
const THEMES = {
  coral: "#ff6b6b", ocean: "#4dabf7", mint: "#38d9a9", lemon: "#ffd43b", grape: "#b197fc", rose: "#f783ac", orange: "#ff922b"
};
const FONTS = {
  system: "'Segoe UI', system-ui, -apple-system, sans-serif",
  rounded: "'Nunito', 'Quicksand', 'Varela Round', ui-rounded, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace",
  serif: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif"
};
const BG_SETS = {
  notes:   ["♪", "♫", "♬", "♩", "𝄞", "♭", "♯"],
  stars:   ["✦", "✧", "⋆", "˚", "✩", "☾", "✶", "·"],
  kaomoji: ["(◕‿◕)", "ʕ•ᴥ•ʔ", "(｡♥‿♥｡)", "≽^•⩊•^≼", "♪(´▽｀)", "ᕕ( ᐛ )ᕗ", "(ﾉ◕ヮ◕)ﾉ", "( ˘▽˘)っ♨"],
  emoji:   ["🎧", "💿", "🎵", "🎸", "🥁", "🎹", "📻", "🎤", "🎷"],
  shapes:  ["○", "△", "□", "◇", "✕", "◯", "⬡", "◠"],
  mix:     ["♪", "♫", "✦", "⋆", "☾", "◯", "ʕ•ᴥ•ʔ", "𝄞", "✧"]
};
const DEFAULT_SETTINGS = {
  accent: THEMES.coral, font: "system", view: "card", tint: 18,
  monthColors: DEFAULT_MONTH_COLORS.slice(),
  bg: { on: true, set: "notes", density: 18, speed: 1, opacity: 1, color: "months" },
  updatedAt: 0
};

// ═══════════════ STATE ═══════════════
const state = {
  me: null,                 // user name, GUEST, or null (not chosen yet)
  snap: null,               // last server snapshot { users, albums, comments, reactions, listen, sheetUrl, serverTime }
  version: null,
  view: null,               // snapshot + pending offline ops applied
  outbox: [],
  tab: "all",
  listenFor: null,
  search: "",
  settings: structuredClone(DEFAULT_SETTINGS),
  loading: true,
  online: navigator.onLine,
  syncing: false,
  lastError: "",
  openThreads: new Set(),
  pickerFor: null,
  rendered: new Set(),      // album keys already shown (for enter animations)
  known: null,              // Set of other users' album keys the user has "seen"
  seenTs: 0,
  notifs: [],
  panelOpen: false
};

// ═══════════════ UTILS ═══════════════
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const isoDate = d => /^\d{4}-\d{2}-\d{2}/.test(String(d || "")) ? String(d).slice(0, 10) : "";
const todayIso = () => new Date().toLocaleDateString("sv-SE");
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn("localStorage full?", e); } };

/** Must match norm() in google-apps-script.js */
function norm(v) {
  let s = String(v ?? "").toLowerCase();
  try { s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (e) {}
  return s.replace(/đ/g, "d").replace(/ß/g, "ss").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
const normKey = (artist, album) => norm(artist) + "~" + norm(album);

function parseRating(r) {
  const s = String(r ?? "").trim().replace(",", ".");
  const m = /^(\d(?:\.\d+)?)\.?\s*(\+)?$/.exec(s);
  if (!m) return null;
  return { v: Math.max(0, Math.min(5, parseFloat(m[1]))), plus: !!m[2] };
}
const fmtRating = (v, plus) => v ? (v % 1 ? v.toFixed(1) : String(v)) + (plus ? "+" : "") : "";

function timeAgo(ts) {
  if (!ts) return "";
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  if (s < 86400 * 7) return Math.floor(s / 86400) + "d";
  return new Date(ts).toLocaleDateString("hr-HR", { day: "numeric", month: "short" });
}
function fmtDate(d) {
  const iso = isoDate(d);
  if (!iso) return String(d || "");
  const [y, m, dd] = iso.split("-").map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString("hr-HR", { day: "numeric", month: "short" });
}
function toast(msg, ms = 2600) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), ms);
}
const monthColor = m => (state.settings.monthColors || DEFAULT_MONTH_COLORS)[(m || new Date().getMonth() + 1) - 1] || "var(--accent)";
const isMe = name => state.me && state.me !== GUEST && name === state.me;
const canWrite = () => state.me && state.me !== GUEST;

// ═══════════════ API ═══════════════
class ApiError extends Error {}
async function parseApi(res) {
  if (!res.ok) throw new ApiError("HTTP " + res.status);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); }
  catch (e) { throw new ApiError("Backend didn't return JSON – is the Apps Script deployed with access 'Anyone'?"); }
  if (data.success === false || data.error) throw new ApiError(data.error || "API error");
  return data;
}
async function apiGet(version) {
  const url = API_URL + "?action=getAlbums" + (version ? "&v=" + encodeURIComponent(version) : "") + "&t=" + Date.now();
  return parseApi(await fetch(url, { redirect: "follow" }));
}
// text/plain keeps this a "simple" CORS request (no preflight, which Apps Script can't answer)
async function apiPost(payload) {
  return parseApi(await fetch(API_URL, {
    method: "POST", redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  }));
}
const isNetworkError = e => !(e instanceof ApiError);

// ═══════════════ LOCAL CACHE (offline backup) ═══════════════
function loadCache() {
  const c = lsGet("muzika_cache_v4", null);
  if (c && c.data) { state.snap = c.data; state.version = c.version; state.loading = false; }
  state.outbox = lsGet("muzika_outbox_v4", []);
}
function saveCache() { lsSet("muzika_cache_v4", { data: state.snap, version: state.version, savedAt: Date.now() }); }
function saveOutbox() { lsSet("muzika_outbox_v4", state.outbox); }

// ═══════════════ OUTBOX: every write goes through here ═══════════════
/** Queue a write, show it immediately, send it when online. Survives reloads. */
function queue(payload, label) {
  const op = { opId: uid(), payload, label: label || payload.action, ts: Date.now(), done: false };
  // coalesce repeated settings syncs
  if (payload.action === "updateUser" && payload.settings !== undefined) {
    state.outbox = state.outbox.filter(o => o.done || !(o.payload.action === "updateUser" && o.payload.settings !== undefined && o.payload.name === payload.name));
  }
  state.outbox.push(op);
  saveOutbox();
  rebuild();
  flush();
  return op;
}

let flushing = false;
async function flush() {
  if (flushing) return;
  flushing = true;
  let sent = 0;
  try {
    for (const op of state.outbox) {
      if (op.done) continue;
      setSync("busy");
      try {
        const res = await apiPost(op.payload);
        op.done = true; op.doneAt = Date.now(); sent++;
        state.online = true;
      } catch (e) {
        if (isNetworkError(e)) { state.online = false; break; }
        console.error("Write rejected", op, e);
        toast("⚠️ " + (op.label || "Change") + " failed: " + e.message, 5000);
        op.done = true; op.failed = true; op.doneAt = Date.now();
      }
      saveOutbox();
    }
  } finally {
    flushing = false;
    state.outbox = state.outbox.filter(o => !o.failed);
    saveOutbox();
    setSync();
    if (sent) refresh(true);
  }
}

/** Server snapshot + not-yet-confirmed writes = what the user sees. */
function applyPending(snap, outbox) {
  if (!snap) return null;
  const v = {
    ...snap,
    users: snap.users.map(u => ({ ...u })),
    albums: snap.albums.map(a => ({ ...a })),
    comments: snap.comments.slice(), reactions: snap.reactions.slice(), listen: snap.listen.slice()
  };
  for (const { payload: p } of outbox) {
    switch (p.action) {
      case "add": {
        const nk = normKey(p.artist, p.album);
        if (v.albums.some(a => a.key === p.owner + "|" + nk && a.created >= (p.ts || 0) - 60000)) break;
        v.albums.push({ ...p, id: "tmp_" + p.clientId, nk, key: p.owner + "|" + nk, row: 1e6, created: p.ts,
          month: isoDate(p.listenedDate) ? +p.listenedDate.slice(5, 7) : new Date().getMonth() + 1, pending: true });
        break;
      }
      case "update": {
        const a = v.albums.find(x => x.id === p.id || (x.owner === p.owner && x.nk === normKey(p.expectArtist, p.expectAlbum)));
        if (a) {
          Object.keys(p).forEach(k => { if (!["action", "id", "expectArtist", "expectAlbum"].includes(k)) a[k] = p[k]; });
          a.nk = normKey(a.artist, a.album); a.key = a.owner + "|" + a.nk; a.pending = true;
          if (isoDate(a.listenedDate)) a.month = +a.listenedDate.slice(5, 7);
        }
        break;
      }
      case "delete":
        v.albums = v.albums.filter(x => !(x.id === p.id || (x.owner === p.owner && x.nk === normKey(p.expectArtist, p.expectAlbum))));
        break;
      case "comment":
        if (!v.comments.some(c => c.id === p.id)) v.comments.push({ id: p.id, key: p.key, owner: p.owner, author: p.author, text: p.text, ts: p.ts, pending: true });
        break;
      case "uncomment": v.comments = v.comments.filter(c => c.id !== p.id); break;
      case "react":
        v.reactions = v.reactions.filter(r => !(r.key === p.key && r.user === p.user && r.emoji === p.emoji));
        if (p.on) v.reactions.push({ key: p.key, owner: p.owner, user: p.user, emoji: p.emoji, ts: p.ts });
        break;
      case "listenAdd":
        if (!v.listen.some(l => l.id === p.id)) v.listen.push({ ...p, nk: normKey(p.artist, p.album), pending: true });
        break;
      case "listenRemove": v.listen = v.listen.filter(l => l.id !== p.id); break;
      case "updateUser": {
        const u = v.users.find(x => x.name === p.name);
        if (u) { if (p.avatar !== undefined) u.avatar = p.avatar; if (p.color !== undefined) u.color = p.color; if (p.settings !== undefined) u.settings = p.settings; }
        break;
      }
    }
  }
  return v;
}

// ═══════════════ FETCH + POLL ═══════════════
let fetching = null;
async function refresh(force = false) {
  if (fetching) { if (!force) return fetching; await fetching.catch(() => {}); }
  const started = Date.now();
  fetching = (async () => {
    setSync("busy");
    try {
      const res = await apiGet(force ? null : state.version);
      state.online = true; state.lastError = "";
      // writes confirmed before this fetch started are now part of the snapshot
      state.outbox = state.outbox.filter(o => !(o.done && o.doneAt <= started));
      saveOutbox();
      if (res.data) {
        state.snap = res.data; state.version = res.version;
        saveCache();
        adoptServerSettings();
      }
      state.loading = false;
      rebuild();
      if (state.outbox.some(o => !o.done)) flush();
      maybeAutoCovers();
    } catch (e) {
      state.loading = false;
      if (isNetworkError(e)) state.online = false;
      state.lastError = e.message;
      console.error("Fetch failed", e);
      rebuild();
    } finally {
      setSync();
      fetching = null;
    }
  })();
  return fetching;
}

let pollTimer = null;
function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(() => { if (!document.hidden) refresh(); }, POLL_MS);
}
document.addEventListener("visibilitychange", () => {
  $("#bg").classList.toggle("paused", document.hidden);
  if (!document.hidden && state.me) refresh();
});
window.addEventListener("online", () => { state.online = true; toast("🌐 Back online – syncing…"); flush(); refresh(true); });
window.addEventListener("offline", () => { state.online = false; setSync(); });

/** Fill in missing album covers in small batches (any open app helps, server de-dupes). */
let coverRun = false;
async function maybeAutoCovers() {
  if (coverRun || !state.online || !state.snap) return;
  if (Date.now() - lsGet("muzika_cover_run", 0) < 25000) return;
  const missing = state.snap.albums.filter(a => (!a.cover && !a.lookedUp) || ((a.apple || a.deezer) && !a.spotify && !a.youtube && !a.linkedUp)).length;
  if (!missing) return;
  coverRun = true; lsSet("muzika_cover_run", Date.now());
  try {
    const r = await apiPost({ action: "autoCovers", limit: 12 });
    if (r.done) refresh(true);
    if (r.remaining) setTimeout(() => { coverRun = false; maybeAutoCovers(); }, 26000);
    else coverRun = false;
  } catch (e) { coverRun = false; }
}

function setSync(mode) {
  const el = $("#sync");
  if (!el) return;
  const pending = state.outbox.filter(o => !o.done).length;
  let cls = "", text = "";
  if (mode === "busy") { cls = "busy"; text = pending ? `Syncing ${pending}…` : ""; }
  else if (!state.online) { cls = "off"; text = pending ? `Offline · ${pending} waiting` : "Offline"; }
  else if (state.lastError) { cls = "err"; text = "Sync problem"; }
  else if (pending) { cls = "busy"; text = `${pending} waiting`; }
  el.className = "sync " + cls;
  el.title = state.lastError || (state.online ? "Synced with Google Sheets" : "Offline – changes are saved on this device");
  el.innerHTML = `<i></i>${esc(text)}`;
}

// ═══════════════ USERS & SETTINGS ═══════════════
const users = () => (state.view || state.snap)?.users || [];
const userByName = n => users().find(u => u.name === n);

function settingsKey() { return "muzika_settings_" + (state.me || "guest"); }
function loadSettings() {
  const s = lsGet(settingsKey(), null) || lsGet("muzika_settings_v2", null);
  state.settings = mergeSettings(s);
}
function mergeSettings(s) {
  const d = structuredClone(DEFAULT_SETTINGS);
  if (!s) return d;
  const out = { ...d, ...s, bg: { ...d.bg, ...(s.bg || {}) } };
  if (!Array.isArray(out.monthColors) || out.monthColors.length !== 12) out.monthColors = d.monthColors;
  if (s.theme && !s.accent) out.accent = THEMES[s.theme] || d.accent; // old settings format
  return out;
}
let settingsSyncTimer = null;
function saveSettings() {
  state.settings.updatedAt = Date.now();
  lsSet(settingsKey(), state.settings);
  applyTheme();
  if (!canWrite()) return;
  clearTimeout(settingsSyncTimer);
  settingsSyncTimer = setTimeout(() => queue({ action: "updateUser", name: state.me, settings: state.settings }, "Settings sync"), 1500);
}
/** Another device saved newer settings for me -> use them. */
function adoptServerSettings() {
  const u = canWrite() && state.snap.users.find(x => x.name === state.me);
  if (u && u.settings && (u.settings.updatedAt || 0) > (state.settings.updatedAt || 0)) {
    state.settings = mergeSettings(u.settings);
    lsSet(settingsKey(), state.settings);
    applyTheme();
  }
}

function applyTheme() {
  const s = state.settings, r = document.documentElement.style;
  r.setProperty("--accent", s.accent);
  r.setProperty("--font", FONTS[s.font] || FONTS.system);
  r.setProperty("--tint", (s.tint ?? 18) + "%");
  document.body.classList.toggle("view-compact", s.view === "compact");
  renderBg();
}

// ═══════════════ DERIVED DATA ═══════════════
const D = { byKey: new Map(), byNk: new Map(), comments: new Map(), reactions: new Map() };
function derive() {
  const v = state.view;
  D.byKey = new Map(); D.byNk = new Map(); D.comments = new Map(); D.reactions = new Map();
  if (!v) return;
  for (const a of v.albums) {
    D.byKey.set(a.key, a);
    if (!D.byNk.has(a.nk)) D.byNk.set(a.nk, new Set());
    D.byNk.get(a.nk).add(a.owner);
  }
  for (const c of v.comments) { if (!D.comments.has(c.key)) D.comments.set(c.key, []); D.comments.get(c.key).push(c); }
  D.comments.forEach(l => l.sort((a, b) => a.ts - b.ts));
  for (const r of v.reactions) { if (!D.reactions.has(r.key)) D.reactions.set(r.key, []); D.reactions.get(r.key).push(r); }
}
const alsoListened = a => [...(D.byNk.get(a.nk) || [])].filter(o => o !== a.owner);

function listenDone(l) {
  const v = state.view;
  if (!v) return null;
  const na = norm(l.artist);
  return v.albums.find(a => a.owner === l.forUser && (l.album ? a.nk === (l.nk || normKey(l.artist, l.album)) : norm(a.artist) === na)) || null;
}

// ═══════════════ NOTIFICATIONS (quiet: badge + dots, no pop-ups) ═══════════════
function loadSeen() {
  if (!canWrite()) { state.known = null; return; }
  const k = lsGet("muzika_known_" + state.me, null);
  state.known = k ? new Set(k) : null;
  state.seenTs = lsGet("muzika_seen_" + state.me, 0);
}
function initSeenIfNeeded() {
  if (!canWrite() || state.known || !state.view) return;
  // first visit on this device: start fresh, but still show the last 3 days of activity
  state.known = new Set(state.view.albums.filter(a => a.owner !== state.me && !(a.created > Date.now() - 3 * 864e5)).map(a => a.key));
  state.seenTs = Date.now() - 3 * 864e5;
  saveSeen();
}
function saveSeen() {
  if (!canWrite() || !state.known) return;
  lsSet("muzika_known_" + state.me, [...state.known]);
  lsSet("muzika_seen_" + state.me, state.seenTs);
}
const isNew = a => !!(state.known && a.owner !== state.me && !state.known.has(a.key) && !a.pending);

function computeNotifs() {
  const v = state.view, me = state.me;
  if (!v || !canWrite() || !state.known) return [];
  const out = [], seen = state.seenTs;
  const myNks = new Set(v.albums.filter(a => a.owner === me).map(a => a.nk));
  const mySuggestions = v.listen.filter(l => l.addedBy === me && l.forUser !== me);
  const iCommented = new Set(v.comments.filter(c => c.author === me).map(c => c.key));
  const title = a => `${esc(a.artist)} – ${esc(a.album)}`;

  for (const a of v.albums) {
    if (!isNew(a)) continue;
    let extra = "";
    if (myNks.has(a.nk)) extra = "✨ You listened to this too";
    const fromMe = v.listen.find(l => l.forUser === a.owner && l.addedBy === a.owner && l.note === `from ${me}` && listenDone(l) === a);
    if (fromMe) extra = "🎧 Found it in your table!";
    const sug = mySuggestions.find(l => l.forUser === a.owner && listenDone(l) === a);
    if (sug) extra = "🎯 Your suggestion!";
    out.push({ type: "album", ts: a.created || v.serverTime, user: a.owner, key: a.key, html: `<b>${esc(a.owner)}</b> added <b>${title(a)}</b>`, extra });
  }
  for (const c of v.comments) {
    if (c.author === me || c.ts <= seen) continue;
    const a = D.byKey.get(c.key);
    if (!a || (a.owner !== me && !iCommented.has(c.key))) continue;
    const short = c.text.length > 70 ? c.text.slice(0, 70) + "…" : c.text;
    out.push({ type: "comment", ts: c.ts, user: c.author, key: c.key,
      html: `<b>${esc(c.author)}</b> commented on ${a.owner === me ? "your" : esc(a.owner) + "'s"} <b>${esc(a.album)}</b>`, extra: "“" + esc(short) + "”" });
  }
  for (const r of v.reactions) {
    if (r.user === me || r.ts <= seen) continue;
    const a = D.byKey.get(r.key);
    if (!a || a.owner !== me) continue;
    out.push({ type: "reaction", ts: r.ts, user: r.user, key: r.key, html: `<b>${esc(r.user)}</b> reacted ${r.emoji} to <b>${esc(a.album)}</b>` });
  }
  for (const l of v.listen) {
    if (l.forUser !== me || l.addedBy === me || l.ts <= Math.max(seen, lsGet("muzika_lseen_" + me, 0))) continue;
    out.push({ type: "listen", ts: l.ts, user: l.addedBy, listenId: l.id,
      html: `<b>${esc(l.addedBy)}</b> thinks you should hear <b>${esc([l.artist, l.album].filter(Boolean).join(" – "))}</b>`, extra: l.note ? esc(l.note) : "" });
  }
  return out.sort((a, b) => b.ts - a.ts);
}

function markAllRead() {
  if (!state.view || !state.known) return;
  state.view.albums.forEach(a => { if (a.owner !== state.me && !a.pending) state.known.add(a.key); });
  state.seenTs = Math.max(Date.now(), state.view.serverTime || 0);
  saveSeen();
}
function markOwnerSeen(owner) {
  if (!state.view || !state.known) return;
  let changed = false;
  state.view.albums.forEach(a => { if (a.owner === owner && !a.pending && !state.known.has(a.key)) { state.known.add(a.key); changed = true; } });
  if (changed) saveSeen();
  return changed;
}
