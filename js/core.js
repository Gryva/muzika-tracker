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
/** The bigger picker – used once the Google script accepts any emoji (reactionsAllowed: "any"). */
const REACTIONS_MORE = ["🔥", "❤️", "😍", "🤘", "😮", "💤", "😂", "🥲", "😭", "🤯", "🥵", "🥶", "😴", "🤔", "🙄", "😬",
  "👏", "🙌", "👍", "👎", "💯", "✨", "💀", "🫠", "🎸", "🥁", "🎹", "🎺", "🕺", "💃", "🌙", "🌈"];
const reactionChoices = () => state.snap?.reactionsAllowed === "any" ? REACTIONS_MORE
  : Array.isArray(state.snap?.reactionsAllowed) ? state.snap.reactionsAllowed : REACTIONS;
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
  film:    ["📼", "🎞", "✶", "◐", "▭", "◉", "⋆", "♪"],
  nature:  ["🍃", "🌿", "❀", "☘", "🌱", "✿", "🍂", "·"],
  geo:     ["▲", "■", "●", "◆", "✚", "▰", "◢", "⬣"],
  memphis: ["▲", "●", "∿", "✚", "◗", "■", "〰", "◢"],
  sketch:  ["✎", "☆", "✗", "~", "○", "↗", "✿", "♪"],
  shapes:  ["○", "△", "□", "◇", "✕", "◯", "⬡", "◠"],
  mix:     ["♪", "♫", "✦", "⋆", "☾", "◯", "ʕ•ᴥ•ʔ", "𝄞", "✧"]
};
/** Whole-app looks. Each one brings its own palette, month colours, font and card tint; users can still tweak on top. */
const STYLES = {
  default: {
    name: "Ponoć", desc: "Tamno, neonski naglasci", accent: THEMES.coral, font: FONTS.system, tint: 18,
    monthColors: DEFAULT_MONTH_COLORS, bgSet: "notes", swatch: ["#0f0f11", "#ff6b6b", "#6ec6ff"], themeColor: "#0f0f11"
  },
  film: {
    name: "Retro film", desc: "Filmsko zrno, polaroidi, izblijedjele boje", accent: "#4A7B7C", font: "Georgia, 'Times New Roman', serif", tint: 30,
    monthColors: ["#7A9CA8", "#B98B9E", "#8FA37E", "#E8B4B8", "#A8B26B", "#D9A441", "#C9734F", "#D4A574", "#8B4513", "#B5562E", "#6B7280", "#4A7B7C"],
    bgSet: "film", swatch: ["#F5E6C8", "#D4A574", "#4A7B7C", "#E8B4B8"], themeColor: "#F5E6C8"
  },
  pop: {
    name: "Neobrutal", desc: "Debeli obrubi, tvrde sjene, glasne boje", accent: "#FF5252",
    font: "'Space Grotesk', system-ui, sans-serif", tint: 100,
    fontHref: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap",
    monthColors: ["#2196F3", "#FF80AB", "#4CAF50", "#FFEB3B", "#B2FF59", "#FF9800", "#FF5252", "#18FFFF", "#FFD180", "#FF6E40", "#B388FF", "#82B1FF"],
    bgSet: "shapes", swatch: ["#FFEB3B", "#FF5252", "#2196F3", "#000000"], themeColor: "#FFFBEB"
  },
  clear: {
    name: "Jasno", desc: "Veliki tekst, jak kontrast, lako za dodir", accent: "#1E3A8A",
    font: "'Atkinson Hyperlegible', system-ui, sans-serif", tint: 0,
    fontHref: "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap",
    // every month colour passes 4.5:1 on white, so it can carry text; names are always written out too
    monthColors: ["#1E3A8A", "#0F766E", "#166534", "#4D7C0F", "#A16207", "#B45309", "#C2410C", "#B91C1C", "#9D174D", "#6D28D9", "#374151", "#1D4ED8"],
    bgSet: "off", swatch: ["#FFFFFF", "#1E3A8A", "#166534", "#F59E0B"], themeColor: "#FFFFFF"
  },
  clay: {
    name: "Glina", desc: "Mekani, debeljuškasti pasteli", accent: "#F4A6B8",
    font: "'Nunito', system-ui, sans-serif", tint: 100,
    fontHref: "https://fonts.googleapis.com/css2?family=Nunito:wght@500;700;800&display=swap",
    monthColors: ["#ADD8E6", "#FFD1DC", "#98FF98", "#E6E6FA", "#B5EAD7", "#FFE5B4", "#FDBCB4", "#C7CEEA", "#FFDAC1", "#E2F0CB", "#F8C8DC", "#CDE7F0"],
    bgSet: "shapes", swatch: ["#FDBCB4", "#ADD8E6", "#98FF98", "#E6E6FA"], themeColor: "#F0E6FA"
  },
  nature: {
    name: "Priroda", desc: "Zemljani tonovi, oblutci, valovi", accent: "#228B22",
    font: "system-ui, -apple-system, 'Segoe UI', sans-serif", display: "Georgia, 'Times New Roman', serif", tint: 22,
    monthColors: ["#87CEEB", "#6B8E23", "#228B22", "#9ACD32", "#3CB371", "#DAA520", "#CD853F", "#8B4513", "#B8860B", "#A0522D", "#556B2F", "#5F9EA0"],
    bgSet: "nature", swatch: ["#F5F5DC", "#228B22", "#8B4513", "#87CEEB"], themeColor: "#F5F5DC"
  },
  vivid: {
    name: "Živo", desc: "Neonski blokovi, geometrija, energija", accent: "#39FF14",
    font: "system-ui, -apple-system, 'Segoe UI', sans-serif", tint: 100,
    monthColors: ["#00FFFF", "#BF00FF", "#39FF14", "#FFAA00", "#FF1493", "#CCFF00", "#FF7F00", "#FF006E", "#00FFFF", "#FFAA00", "#BF00FF", "#39FF14"],
    bgSet: "geo", swatch: ["#0D0D0D", "#39FF14", "#BF00FF", "#FF1493"], themeColor: "#0D0D0D"
  },
  memphis: {
    name: "Memphis", desc: "80-e: oblici, vijuge, točkice", accent: "#FF71CE",
    font: "'Futura', 'Jost', 'League Spartan', 'Avenir Next', sans-serif", tint: 100,
    fontHref: "https://fonts.googleapis.com/css2?family=Jost:wght@500;700;900&display=swap",
    monthColors: ["#86CCCA", "#FF71CE", "#FFCE5C", "#4ECDC4", "#FF6B6B", "#6A7BB4", "#FFCE5C", "#FF71CE", "#86CCCA", "#FF6B6B", "#6A7BB4", "#4ECDC4"],
    bgSet: "memphis", swatch: ["#FF71CE", "#FFCE5C", "#86CCCA", "#6A7BB4"], themeColor: "#FFFEF7"
  },
  skeu: {
    name: "Koža i drvo", desc: "Koža, drvo, papir, mjedeni zakovci", accent: "#CD853F",
    font: "Georgia, 'Times New Roman', serif", tint: 0,
    monthColors: ["#8B4513", "#A0522D", "#CD853F", "#D2691E", "#8B4513", "#A0522D", "#CD853F", "#D2691E", "#8B4513", "#A0522D", "#CD853F", "#D2691E"],
    bgSet: "off", swatch: ["#8B4513", "#DEB887", "#FFFEF9", "#B8860B"], themeColor: "#654321"
  },
  eink: {
    name: "E-papir", desc: "Kao čitač knjiga: papir, tinta, bez animacija", accent: "#1A1A1A",
    font: "Georgia, 'Iowan Old Style', 'Times New Roman', serif", tint: 0,
    monthColors: ["#1A1A1A", "#4A4A4A", "#1A1A1A", "#4A4A4A", "#1A1A1A", "#4A4A4A", "#1A1A1A", "#4A4A4A", "#1A1A1A", "#4A4A4A", "#1A1A1A", "#4A4A4A"],
    bgSet: "off", swatch: ["#FDFBF7", "#F5F5F5", "#1A1A1A", "#FFFF00"], themeColor: "#FDFBF7"
  },
  raw: {
    name: "Skica", desc: "Rukom crtano, kraft papir, nesavršeno", accent: "#8B4513",
    font: "'Patrick Hand', 'Comic Sans MS', cursive, sans-serif", tint: 35,
    fontHref: "https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap",
    monthColors: ["#4A6A8A", "#8B4513", "#5E7A3A", "#A0522D", "#6B5B95", "#B5651D", "#8B4513", "#7A5C3E", "#9C6B3F", "#B5562E", "#5A6B7A", "#4A4A4A"],
    bgSet: "sketch", swatch: ["#FAFAF8", "#C4A77D", "#D4C4A8", "#8B4513"], themeColor: "#FAFAF8"
  },
  neu: {
    name: "Meko", desc: "Neumorfizam: izbočeno i utisnuto, tihi pasteli", accent: "#7B68EE",
    font: "system-ui, -apple-system, 'Segoe UI', sans-serif", tint: 0,
    monthColors: ["#8FB8DE", "#E3A5BE", "#9BC9A8", "#B8A9E8", "#E8C27A", "#E8A98B", "#D98C8C", "#7FB5C4", "#C4A07F", "#D49A6A", "#A3A8C8", "#8CB4D8"],
    bgSet: "off", swatch: ["#E8E8E8", "#C8E0F4", "#F5E0E8", "#7B68EE"], themeColor: "#E8E8E8"
  }
};
/** Web fonts are only fetched when someone actually picks a style that needs one. */
function loadStyleFont(st) {
  if (!st.fontHref || document.querySelector(`link[href="${st.fontHref}"]`)) return;
  const l = document.createElement("link");
  l.rel = "stylesheet"; l.href = st.fontHref;
  document.head.appendChild(l);
}
/** Rating symbols (text glyphs, forced to text style with U+FE0E so they can be half-filled). */
const RATE_SYMBOLS = ["★", "♥", "●", "◆", "✦", "♪", "✿", "☾"];
const rateSym = () => "★\uFE0E"; // the rating symbol is always a star now
const MONTH_ICONS = ["", "❄", "♥", "✿", "☂", "❀", "☀", "⛱", "✦", "🍂", "☾", "☁", "★", "♪", "📼", "📷"];
const style = () => STYLES[state.settings.style] || STYLES.default;
const DEFAULT_SETTINGS = {
  style: "default",
  accent: null,           // null = the style's own accent
  font: "auto",           // auto = the style's own font
  cards: "collapsed",     // collapsed | open
  monthScale: 1,          // size of month names, 0.7 – 1.5
  rateSymbol: "★",        // symbol used for ratings
  tint: null,             // null = the style's tint
  months: {},             // per-month tweaks: { "11": { color, tint, icon, hidden } }
  yearsFolded: {},        // { "2025": true } – years start open
  bg: { on: true, set: "notes", density: 18, speed: 1, opacity: 1, color: "months" },
  sv: 2, updatedAt: 0
};

// ═══════════════ STATE ═══════════════
const state = {
  me: null,                 // user name, GUEST, or null (not chosen yet)
  snap: null,               // last server snapshot { users, albums, comments, reactions, listen, sheetUrl, serverTime }
  version: null,
  view: null,               // snapshot + pending offline ops applied
  outbox: [],
  tab: null,
  whoOpen: false,
  listenFor: null,
  search: "",
  settings: structuredClone(DEFAULT_SETTINGS),
  loading: true,
  online: navigator.onLine,
  syncing: false,
  lastError: "",
  openThreads: new Set(),
  openCards: new Set(),
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
/** "2026-11-07" → "07.11.2026" */
const fmtDMY = iso => { const d = isoDate(iso); return d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : ""; };
/** "7.11.2026", "07/11/2026", "7-11-26" → "2026-11-07" (or "" if it isn't a real date) */
function parseDMY(v) {
  const m = /^\s*(\d{1,2})[.\/\-\s]+(\d{1,2})[.\/\-\s]+(\d{2}|\d{4})\.?\s*$/.exec(String(v || ""));
  if (!m) return "";
  const d = +m[1], mo = +m[2], y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return "";
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
/** The year an entry belongs to in the list: the year it was heard, else the owner's usual year. */
function logYear(a) {
  const d = isoDate(a.listenedDate);
  if (d) return d.slice(0, 4);
  const c = (logYear._c = logYear._c || {});
  if (!c[a.owner]) {
    const ys = {}; (state.view?.albums || []).forEach(x => { const xd = isoDate(x.listenedDate); if (x.owner === a.owner && xd) ys[xd.slice(0, 4)] = (ys[xd.slice(0, 4)] || 0) + 1; });
    c[a.owner] = Object.entries(ys).sort((p, q) => q[1] - p[1])[0]?.[0] || String(new Date().getFullYear());
  }
  return c[a.owner];
}
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn("localStorage full?", e); } };

/** True for empty cells and filler like "-", "–", "/", "?" that people type to mean "nothing" (no letter or digit in it). */
const isPlaceholder = v => { const t = String(v ?? "").trim(); return !t ||  !/[\p{L}\p{N}]/u.test(t); };
const FIELD_KEYS = ["year", "genre", "duration", "listenedDate", "rating", "impression", "standoutTracks", "recommend", "comments"];

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
  if (s < 60) return "sad";
  if (s < 3600) return Math.floor(s / 60) + " min";
  if (s < 86400) return Math.floor(s / 3600) + " h";
  if (s < 86400 * 7) return Math.floor(s / 86400) + " d";
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
const monthPref = m => state.settings.months?.[m || 0] || {};
const monthColor = m => monthPref(m).color || style().monthColors[(m || new Date().getMonth() + 1) - 1] || "var(--accent)";
const monthTint = m => (monthPref(m).tint ?? state.settings.tint ?? style().tint) + "%";
const allMonthColors = () => MONTH_NAMES.map((_, i) => monthColor(i + 1));
const isMe = name => state.me && state.me !== GUEST && name === state.me;
const canWrite = () => state.me && state.me !== GUEST;

// ═══════════════ API ═══════════════
class ApiError extends Error {}
/** The Google script wants the group password (none saved yet, or it was changed). */
class AuthError extends ApiError {}
const CODE_KEY = "muzika_code";
const groupCode = () => localStorage.getItem(CODE_KEY) || "";
async function parseApi(res) {
  if (!res.ok) throw new ApiError("HTTP " + res.status);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); }
  catch (e) { throw new ApiError("Poslužitelj nije vratio JSON – je li Apps Script objavljen s pristupom 'Anyone'?"); }
  if (data.auth || data.error === "AUTH") throw new AuthError("Potrebna je grupna lozinka");
  if (data.success === false || data.error) throw new ApiError(data.error || "API error");
  return data;
}
async function apiGet(version) {
  // POST (not GET) so the group password never ends up in a URL
  return apiPost({ action: "getAll", v: version || "" });
}
// text/plain keeps this a "simple" CORS request (no preflight, which Apps Script can't answer)
async function apiPost(payload) {
  return parseApi(await fetch(API_URL, {
    method: "POST", redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...payload, code: groupCode() })
  }));
}
const isNetworkError = e => !(e instanceof ApiError);

// ═══════════════ LOCAL CACHE (offline backup) ═══════════════
function loadCache() {
  const c = lsGet("muzika_cache_v4", null);
  if (c && c.data) { state.snap = cleanSnap(c.data); state.version = c.version; state.loading = false; }
  state.outbox = lsGet("muzika_outbox_v4", []);
}
function saveCache() { lsSet("muzika_cache_v4", { data: state.snap, version: state.version, savedAt: Date.now() }); }
// ═══════════════ incoming data guard ═══════════════
/** Anyone can type into the Google Sheet, so whatever comes from it is cleaned before the app uses it:
 *  links must be real web links, colours real colours, reactions real emoji. Text is escaped when shown. */
const safeUrl = u => /^https:\/\/[^\s"'<>]+$/i.test(String(u || "").trim()) ? String(u).trim() : "";
const safeImg = u => safeUrl(u) || (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(String(u || "")) ? u : "");
const safeColor = c => /^#[0-9a-f]{3,8}$/i.test(String(c || "").trim()) ? String(c).trim() : "";
function isEmojiOnly(e) {
  e = String(e || "");
  if (!e || e.length > 16) return false;
  try { return /\p{Extended_Pictographic}/u.test(e) && !/[\p{L}\p{N}<>"'&=\/\\]/u.test(e.replace(/[#*0-9]\uFE0F?\u20E3/g, "")); } catch (x) { return REACTIONS.includes(e); }
}
function cleanSnap(d) {
  if (!d || typeof d !== "object") return d;
  (d.users || []).forEach(u => { u.color = safeColor(u.color); u.avatar = safeImg(u.avatar); });
  (d.albums || []).forEach(a => ["spotify", "youtube", "apple", "deezer"].forEach(k => { if (a[k]) a[k] = safeUrl(a[k]); }));
  (d.albums || []).forEach(a => { if (a.cover) a.cover = safeImg(a.cover); });
  if (Array.isArray(d.reactions)) d.reactions = d.reactions.filter(r => isEmojiOnly(r.emoji));
  if (d.sheetUrl) d.sheetUrl = safeUrl(d.sheetUrl);
  return d;
}

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
const FAILED_KEY = "muzika_failed_v1";
/** Put rejected albums back in the queue (e.g. after the Google script was fixed). */
function retryFailed() {
  const list = lsGet(FAILED_KEY, []);
  if (!list.length) return 0;
  list.forEach(f => state.outbox.push({ payload: f.payload, label: f.label, ts: Date.now() }));
  lsSet(FAILED_KEY, []); saveOutbox(); rebuild?.(); flush();
  return list.length;
}
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
        if (e instanceof AuthError) { showGate(); break; } // nothing is lost: the queue waits for the password
        console.error("Write rejected", op, e);
        // albums are precious: a rejected add / edit is kept on this device so it can be retried, never just lost
        const keep = ["add", "update"].includes(op.payload?.action);
        if (keep) lsSet(FAILED_KEY, [...lsGet(FAILED_KEY, []), { payload: op.payload, label: op.label, error: String(e.message || e), at: Date.now() }].slice(-30));
        toast("⚠️ Nije uspjelo – " + (op.label || "promjena").toLowerCase() + ": " + e.message + (keep ? " – sačuvano na uređaju (Postavke → Sinkronizacija)" : ""), 6000);
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
        v.albums.push({ ...p, mark: p.mark || "", id: "tmp_" + p.clientId, nk, key: p.owner + "|" + nk, row: 1e6, created: p.ts,
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
  // Sheet placeholders like "-", "/", "?" mean "nothing here": drop such rows, blank such fields
  v.albums = v.albums.filter(a => !isPlaceholder(a.artist) && !isPlaceholder(a.album));
  v.albums.forEach(a => FIELD_KEYS.forEach(k => { if (isPlaceholder(a[k])) a[k] = ""; }));
  v.listen = v.listen.filter(l => !isPlaceholder(l.artist));
  v.listen.forEach(l => { if (isPlaceholder(l.album)) l.album = ""; });
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
        state.snap = cleanSnap(res.data); state.version = res.version;
        saveCache();
        adoptServerSettings();
      }
      state.loading = false;
      rebuild();
      if (state.outbox.some(o => !o.done)) flush();
      maybeAutoCovers();
    } catch (e) {
      state.loading = false;
      if (e instanceof AuthError) { showGate(); return; }
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
window.addEventListener("online", () => { state.online = true; toast("🌐 Opet si na mreži – sinkroniziram…"); flush(); refresh(true); });
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
  if (mode === "busy") { cls = "busy"; text = pending ? `Šaljem ${pending}…` : ""; }
  else if (!state.online) { cls = "off"; text = pending ? `Izvan mreže · čeka ${pending}` : "Izvan mreže"; }
  else if (state.lastError) { cls = "err"; text = "Problem sa sinkronizacijom"; }
  else if (pending) { cls = "busy"; text = `Čeka ${pending}`; }
  el.className = "sync " + cls;
  el.title = state.lastError || (state.online ? "Usklađeno s Google tablicom" : "Izvan mreže – promjene su spremljene na uređaju");
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
  const out = { ...d, ...s, bg: { ...d.bg, ...(s.bg || {}) }, months: { ...(s.months || {}) } };
  if (!s.sv) { // settings from before styles existed
    if (s.theme && !s.accent) out.accent = THEMES[s.theme] || null;
    if (out.accent === THEMES.coral) out.accent = null;
    if (out.font === "system") out.font = "auto";
    if (out.tint === 18) out.tint = null;
    out.cards = "collapsed";
    if (Array.isArray(s.monthColors)) s.monthColors.forEach((c, i) => {
      if (c && c.toLowerCase() !== DEFAULT_MONTH_COLORS[i].toLowerCase()) out.months[i + 1] = { ...(out.months[i + 1] || {}), color: c };
    });
    delete out.monthColors; delete out.view; delete out.theme;
    out.sv = 2;
  }
  if (!STYLES[out.style]) out.style = "default";
  return out;
}
let settingsSyncTimer = null;
function saveSettings() {
  state.settings.updatedAt = Date.now();
  lsSet(settingsKey(), state.settings);
  applyTheme();
  if (!canWrite()) return;
  clearTimeout(settingsSyncTimer);
  settingsSyncTimer = setTimeout(() => queue({ action: "updateUser", name: state.me, settings: state.settings }, "Sinkronizacija postavki"), 1500);
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
  const st = style();
  document.documentElement.dataset.style = STYLES[s.style] ? s.style : "default";
  loadStyleFont(st);
  r.setProperty("--accent", s.accent || st.accent);
  r.setProperty("--font", s.font === "auto" ? st.font : FONTS[s.font] || st.font);
  r.setProperty("--tint", (s.tint ?? st.tint) + "%");
  r.setProperty("--month-scale", s.monthScale || 1);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", st.themeColor);
  renderBg();
}

// ═══════════════ DERIVED DATA ═══════════════
const D = { byKey: new Map(), byNk: new Map(), comments: new Map(), reactions: new Map() };
function derive() {
  const v = state.view;
  D.byKey = new Map(); D.byNk = new Map(); D.comments = new Map(); D.reactions = new Map();
  logYear._c = {};
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
    if (myNks.has(a.nk)) extra = "✨ I ti si ovo slušao/la";
    const fromMe = v.listen.find(l => l.forUser === a.owner && l.addedBy === a.owner && (l.note === `od ${me}` || l.note === `from ${me}`) && listenDone(l) === a);
    if (fromMe) extra = "🎧 Našao/la u tvojoj tablici!";
    const sug = mySuggestions.find(l => l.forUser === a.owner && listenDone(l) === a);
    if (sug) extra = "🎯 Tvoj prijedlog!";
    out.push({ type: "album", ts: a.created || v.serverTime, user: a.owner, key: a.key, html: `<b>${esc(a.owner)}</b> je dodao/la <b>${title(a)}</b>`, extra });
  }
  for (const c of v.comments) {
    if (c.author === me || c.ts <= seen) continue;
    const a = D.byKey.get(c.key);
    if (!a || (a.owner !== me && !iCommented.has(c.key))) continue;
    const short = c.text.length > 70 ? c.text.slice(0, 70) + "…" : c.text;
    out.push({ type: "comment", ts: c.ts, user: c.author, key: c.key,
      html: `<b>${esc(c.author)}</b> komentira ${a.owner === me ? "tvoj album" : "album (" + esc(a.owner) + ")"} <b>${esc(a.album)}</b>`, extra: "“" + esc(short) + "”" });
  }
  for (const r of v.reactions) {
    if (r.user === me || r.ts <= seen) continue;
    const a = D.byKey.get(r.key);
    if (!a || a.owner !== me) continue;
    out.push({ type: "reaction", ts: r.ts, user: r.user, key: r.key, html: `<b>${esc(r.user)}</b> reagira ${esc(r.emoji)} na <b>${esc(a.album)}</b>` });
  }
  for (const l of v.listen) {
    if (l.forUser !== me || l.addedBy === me || l.ts <= Math.max(seen, lsGet("muzika_lseen_" + me, 0))) continue;
    out.push({ type: "listen", ts: l.ts, user: l.addedBy, listenId: l.id,
      html: `<b>${esc(l.addedBy)}</b> misli da trebaš čuti <b>${esc([l.artist, l.album].filter(Boolean).join(" – "))}</b>`, extra: l.note ? esc(l.note) : "" });
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
