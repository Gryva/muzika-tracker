/* Muzika Tracker – login/onboarding, add/edit form, rating widget, settings, floating background, boot */

// ═══════════════ images ═══════════════
/** Resize (and optionally square-crop) a picked image to a small JPEG data URL. */
function resizeImage(file, max, square) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width: w, height: h } = img, sx = 0, sy = 0, sw = w, sh = h;
      if (square) { const s = Math.min(w, h); sx = (w - s) / 2; sy = (h - s) / 2; sw = sh = s; w = h = s; }
      const scale = Math.min(1, max / Math.max(w, h));
      const c = document.createElement("canvas");
      c.width = Math.round(w * scale); c.height = Math.round(h * scale);
      c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => reject(new Error("Ne mogu pročitati tu sliku"));
    img.src = URL.createObjectURL(file);
  });
}
function pickFile() {
  return new Promise(res => {
    const i = document.createElement("input");
    i.type = "file"; i.accept = "image/*";
    i.onchange = () => res(i.files[0] || null);
    i.click();
  });
}

// ═══════════════ login / onboarding ═══════════════
// ═══════════════ welcome: what this is + the group's rules ═══════════════
const WELCOME_KEY = "muzika_welcomed";
function welcomeHtml() {
  if (lang() === "en") return `<div class="welcome">
    <div class="welcome-hi" aria-hidden="true">👋</div>
    <h1 class="login-title">Willkommen!</h1>
    <p class="welcome-lead">Our shared album spreadsheet – just prettier and in your pocket. Everything you log here shows up in the Google Sheet right away, and the other way round.</p>
    <ul class="rules">
      <li><span class="r-ic" aria-hidden="true">🗂️</span><span>Everyone has <b>their own table</b> and only writes in it. New here? Pick “I'm new” and you'll get your own tab.</span></li>
      <li><span class="r-ic" aria-hidden="true">🙅</span><span><b>We don't delete other people's albums.</b> But comments and reactions on them – absolutely! 💬</span></li>
      <li><span class="r-ic"><span class="mark-dot mark-first big" aria-hidden="true"></span></span><span><b>Purple</b> = an artist you're hearing <b>for the first time</b>. E.g. you've never heard anything by Živo Blato and you listen to an album.</span></li>
      <li><span class="r-ic"><span class="mark-dot mark-re big" aria-hidden="true"></span></span><span><b>Blue</b> = an album you're listening to <b>again</b>. E.g. you decide to relisten to Konac Konca.</span></li>
      <li><span class="r-ic" aria-hidden="true">🔗</span><span>Sharing the link with good people is very welcome!</span></li>
    </ul>
    <p class="welcome-sign">Have fun and see you in the tables!<br><small>– moderator, <b>Osto</b></small></p>
    <div class="welcome-foot">
      <button type="button" class="sheet-link share-app" data-act="share-app">🔗 Share Muzika with friends <span aria-hidden="true">↗</span></button>
      <p class="made-by">App made by <b>Griva</b> 😉</p>
    </div>
  </div>`;
  return `<div class="welcome">
    <div class="welcome-hi" aria-hidden="true">👋</div>
    <h1 class="login-title">Willkommen!</h1>
    <p class="welcome-lead">Naša zajednička tablica albuma – samo ljepša i u džepu. Sve što ovdje upišeš odmah se pojavi i u Google tablici, i obrnuto.</p>
    <ul class="rules">
      <li><span class="r-ic" aria-hidden="true">🗂️</span><span>Svatko ima <b>svoju tablicu</b> i piše samo u nju. Novi ste? Odaberite „Novi/a sam” i dobit ćete svoju karticu.</span></li>
      <li><span class="r-ic" aria-hidden="true">🙅</span><span><b>Ne brišemo tuđe albume.</b> Ali komentari i reakcije na tuđe albume – itekako! 💬</span></li>
      <li><span class="r-ic"><span class="mark-dot mark-first big" aria-hidden="true"></span></span><span><b>Ljubičasto</b> = izvođač kojeg slušaš <b>prvi put</b>. Npr. nikad nisi čuo/la ništa od Živog Blata i poslušaš album.</span></li>
      <li><span class="r-ic"><span class="mark-dot mark-re big" aria-hidden="true"></span></span><span><b>Plavo</b> = album koji slušaš <b>ponovno</b>. Npr. odlučiš se na relistening Konca Konca.</span></li>
      <li><span class="r-ic" aria-hidden="true">🔗</span><span>Šeranje linka dobrim ljudima je dobro došlo!</span></li>
    </ul>
    <p class="welcome-sign">Zabavite se i vidimo se u tablicama!<br><small>– moderator, <b>Osto</b></small></p>
    <div class="welcome-foot">
      <button type="button" class="sheet-link share-app" data-act="share-app">🔗 Podijeli Muziku s prijateljima <span aria-hidden="true">↗</span></button>
      <p class="made-by">Aplikaciju napravio <b>Griva</b> 😉</p>
    </div>
  </div>`;
}
/** Share the app: the link always opens on "Tko sluša?" so nobody lands in someone else's table. */
async function shareApp() {
  const url = location.origin + location.pathname + "?tko";
  try { if (navigator.share) { await navigator.share({ title: "Muzika", text: L("Upiši što slušaš 🎧", "Log what you're listening to 🎧"), url }); return; } } catch (e) { if (e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(url); toast("Link kopiran 📋"); } catch (e) { prompt(L("Kopiraj link:", "Copy the link:"), url); }
}

/** The welcome text as a full page – from the app name or Settings → Pravila i upute. */
function openRulesPage() {
  if ($(".rules-page")) return;
  const r = document.createElement("div");
  r.className = "overlay rules-page";
  r.innerHTML = `<div class="sheet"><div class="sheet-header"><button type="button" class="btn btn-ghost btn-icon page-back" data-close aria-label="Natrag"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="sheet-title">O aplikaciji</div></div><div class="sheet-body">${welcomeHtml()}</div></div>`;
  document.body.appendChild(r);
  const closeR = asPage(r);
  $$("[data-close]", r).forEach(b => b.addEventListener("click", closeR));
}

function renderWelcome(onDone) {
  $(".login")?.remove();
  const el = document.createElement("div");
  el.className = "login welcome-screen";
  el.innerHTML = `<div class="login-box">${welcomeHtml()}<button class="btn btn-primary welcome-go" id="w-go">Kreni 🎧</button></div>`;
  document.body.appendChild(el);
  $("#w-go", el).addEventListener("click", () => {
    try { localStorage.setItem(WELCOME_KEY, "1"); } catch (e) {}
    el.classList.add("closing");
    setTimeout(() => {
      el.remove();
      onDone();
    }, 200);
  });
}
/** One-time language choice right after the greeting. Picking reloads so every screen is in that language. */
function renderLangPick() {
  const el = document.createElement("div");
  el.className = "login lang-screen";
  el.innerHTML = `<div class="login-box lang-box" role="dialog" aria-labelledby="lang-title">
    <div class="gate-lock" aria-hidden="true">🌍</div>
    <h1 class="login-title" id="lang-title">Jezik · Language</h1>
    <p class="login-sub">Odaberi jezik aplikacije · Choose the app language<br><small>Možeš ga promijeniti u Postavkama · You can change it in Settings</small></p>
    <div class="lang-pick">
      <button type="button" class="user-btn lang-btn" data-lang="hr" lang="hr"><span class="lang-flag" aria-hidden="true">🇭🇷</span>Hrvatski</button>
      <button type="button" class="user-btn lang-btn" data-lang="en" lang="en"><span class="lang-flag" aria-hidden="true">🇬🇧</span>English</button>
    </div>
  </div>`;
  document.body.appendChild(el);
  $$(".lang-btn", el).forEach(b => b.addEventListener("click", () => setLang(b.dataset.lang)));
}
function setLang(l) {
  try { localStorage.setItem(LANG_KEY, l === "en" ? "en" : "hr"); } catch (e) {}
  location.reload();
}

function renderLogin(joining = false) {
  if ($(".lang-screen, .gate")) return; // language first, then the group password
  if (!joining && !localStorage.getItem(WELCOME_KEY) && state.snap) { if (!$(".welcome-screen")) renderWelcome(() => renderLogin()); return; }
  $(".login")?.remove();
  if (!state.me) renderFab(); // no one logged in -> no bottom bar behind the picker
  const el = document.createElement("div");
  el.className = "login";
  const list = users();
  if (!state.snap) {
    el.innerHTML = `<div class="login-box"><div class="login-title">Muzika</div><div class="login-sub">${state.loading ? "Učitavam…" : "Ne mogu doći do tablice – " + esc(state.lastError)}</div>${state.loading ? `<div class="spinner"></div>` : `<button class="btn btn-primary" id="retry">Pokušaj ponovno</button>`}</div>`;
    document.body.appendChild(el);
    $("#retry", el)?.addEventListener("click", () => { state.loading = true; renderLogin(); refresh(true).then(() => renderLogin()); });
    return;
  }
  if (!joining) {
    el.innerHTML = `<div class="login-box">
      <div class="login-title">Muzika</div>
      <div class="login-sub">Tko sluša? <small>(zapamtit ćemo te na ovom uređaju)</small></div>
      <div class="user-grid">
        ${list.map(u => `<button class="user-btn" data-user="${esc(u.name)}">${avatar(u.name, 52)}${esc(u.name)}</button>`).join("")}
        <button class="user-btn new" id="join"><span class="av" style="--sz:52px">＋</span>Novi/a sam</button>
      </div>
      <button class="link-btn" id="guest">👀 Samo gledam</button>
    </div>`;
    document.body.appendChild(el);
    $$(".user-btn[data-user]", el).forEach(b => b.addEventListener("click", () => login(b.dataset.user)));
    $("#join", el).addEventListener("click", () => renderLogin(true));
    $("#guest", el).addEventListener("click", () => login(GUEST));
    return;
  }
  // new member form
  let avatarData = "", color = USER_COLORS_UI[list.length % USER_COLORS_UI.length];
  el.innerHTML = `<form class="login-box">
    <div class="login-title">Dobrodošao/la! 👋</div>
    <div class="login-sub">Upiši ime – dobit ćeš svoju karticu u tablici.</div>
    <div class="avatar-pick"><span class="av" id="j-av" style="--uc:${color}" title="Dodaj fotku (nije obavezno)">📷</span><small class="hint">Fotka nije obavezna – dodirni za dodavanje</small></div>
    <div class="fg"><input class="fi" id="j-name" placeholder="Tvoje ime" aria-label="Tvoje ime" maxlength="20" required autocomplete="off" style="text-align:center;font-size:17px"></div>
    <div class="fg"><div class="swatches" style="justify-content:center">${USER_COLORS_UI.map(c => `<span class="sw ${c === color ? "on" : ""}" data-c="${c}" style="background:${c}"></span>`).join("")}</div></div>
    <div class="hint warn hide" id="j-err"></div>
    <div style="display:flex;gap:10px;justify-content:center;margin-top:14px">
      <button type="button" class="btn btn-ghost" id="j-back">Natrag</button>
      <button class="btn btn-primary" id="j-go">Pridruži se 🎉</button>
    </div>
  </form>`;
  document.body.appendChild(el);
  const av = $("#j-av", el), nameI = $("#j-name", el);
  const paint = () => {
    av.style.setProperty("--uc", color);
    av.innerHTML = avatarData ? `<img src="${avatarData}" alt="">` : (nameI.value.trim()[0]?.toUpperCase() || "📷");
  };
  nameI.addEventListener("input", paint);
  nameI.focus();
  av.addEventListener("click", async () => {
    const f = await pickFile(); if (!f) return;
    try { avatarData = await resizeImage(f, 160, true); paint(); } catch (e) { toast(e.message); }
  });
  $$(".sw", el).forEach(s => s.addEventListener("click", () => { color = s.dataset.c; $$(".sw", el).forEach(x => x.classList.toggle("on", x === s)); paint(); }));
  $("#j-back", el).addEventListener("click", () => renderLogin());
  el.querySelector("form").addEventListener("submit", async e => {
    e.preventDefault();
    const name = nameI.value.replace(/\s+/g, " ").trim();
    const err = $("#j-err", el), go = $("#j-go", el);
    if (!name) return;
    go.disabled = true; go.textContent = "Stvaram…"; err.classList.add("hide");
    try {
      await apiPost({ action: "addUser", name, avatar: avatarData, color });
      await refresh(true);
      login(name);
      toast(`Dobrodošao/la, ${name}! 🎉`);
    } catch (ex) {
      err.textContent = isNetworkError(ex) ? "Za pridruživanje moraš biti na mreži." : ex.message;
      err.classList.remove("hide"); go.disabled = false; go.textContent = "Pridruži se 🎉";
    }
  });
}
const USER_COLORS_UI = ["#ff6b6b", "#4ecdc4", "#ffd166", "#a78bfa", "#f093fb", "#4dabf7", "#69db7c", "#ff922b", "#e599f7", "#63e6be"];

function login(name) {
  state.me = name;
  localStorage.setItem("muzika_user", name);
  $(".login")?.remove();
  loadSettings(); applyTheme(); loadSeen();
  state.tab = name === GUEST ? null : name; state.rendered = new Set(); state.whoOpen = false; state.scrollToEnd = true;
  if (state.snap) adoptServerSettings();
  rebuild();
  // first login on this device: offer the look (style, cards, background), starting from what they already have – skippable
  if (canWrite() && !localStorage.getItem(LOOK_KEY + name)) setTimeout(openLookSetup, 350);
}

// ═══════════════ onboarding: pick your look (live) ═══════════════
const LOOK_KEY = "muzika_look_done_";
/** A new style starts from its own colours and background (same rule as in Settings). */
function applyStyleChoice(s, k) {
  s.style = k;
  s.accent = null; s.tint = null;
  Object.values(s.months).forEach(mp => { delete mp.color; delete mp.tint; });
  if (style().bgSet === "off") s.bg.on = false;
  else if (Object.values(STYLES).some(x => x.bgSet === s.bg.set) || !s.bg.on) { s.bg.set = style().bgSet; s.bg.on = true; }
}
/** Bottom sheet over the real list, so every choice shows on your own albums right away. */
function openLookSetup() {
  if ($(".look-setup") || !state.me) return;
  const s = state.settings, me = state.me;
  const ov = document.createElement("div");
  ov.className = "look-setup";
  const bgRow = () => `<button data-v="off" class="${!s.bg.on ? "on" : ""}">Isključeno</button>` +
    Object.keys(BG_SETS).map(k => `<button data-v="${k}" class="${s.bg.on && s.bg.set === k ? "on" : ""}">${BG_SETS[k].slice(0, 3).join(" ")}</button>`).join("");
  ov.innerHTML = `<section class="sheet look-sheet" role="dialog" aria-labelledby="look-title">
    <div class="look-head">
      <div><h2 class="sheet-title" id="look-title">Odaberi svoj izgled</h2><p class="look-sub">Mijenja se odmah – pogledaj gore. Sve možeš promijeniti i kasnije u Postavkama.</p></div>
      <button type="button" class="btn btn-ghost btn-sm" id="look-skip">Preskoči</button>
    </div>
    <div class="look-body">
      <div class="look-sec"><div class="fl">Stil</div>
        <div class="look-styles" id="look-style">${Object.entries(STYLES).map(([k, st]) => `
          <button type="button" class="style-card ${s.style === k ? "on" : ""}" data-v="${k}" aria-pressed="${s.style === k}">
            <span class="style-swatch">${st.swatch.map(c => `<i style="background:${c}"></i>`).join("")}</span>
            <b style="font-family:${st.display || st.font}">${esc(st.name)}</b><small>${esc(st.desc)}</small>
          </button>`).join("")}</div></div>
      <div class="look-sec"><div class="fl">Kartice albuma</div>
        <div class="seg wide" id="look-cards">${[["collapsed", "Zatvorene"], ["open", "Uvijek otvorene"]].map(([k, l]) => `<button type="button" data-v="${k}" class="${s.cards === k ? "on" : ""}">${l}</button>`).join("")}</div></div>
      <div class="look-sec"><div class="fl">Pozadina koja lebdi</div>
        <div class="choice look-bg" id="look-bg">${bgRow()}</div></div>
    </div>
    <div class="form-actions"><button type="button" class="btn btn-primary" id="look-done">Gotovo 🎧</button></div>
  </section>`;
  document.body.appendChild(ov);
  document.body.classList.add("look-open");
  const rerender = () => { saveSettings(); state.rendered = new Set(state.view?.albums.map(a => a.key)); renderMain(); };
  const done = msg => {
    try { localStorage.setItem(LOOK_KEY + me, "1"); } catch (e) {}
    ov.classList.add("closing"); document.body.classList.remove("look-open");
    setTimeout(() => ov.remove(), 220);
    if (msg) toast(msg);
  };
  const wireBg = () => $$("#look-bg button", ov).forEach(b => b.addEventListener("click", () => {
    if (b.dataset.v === "off") s.bg.on = false; else { s.bg.on = true; s.bg.set = b.dataset.v; }
    $$("#look-bg button", ov).forEach(x => x.classList.toggle("on", x === b)); saveSettings();
  }));
  $$("#look-style .style-card", ov).forEach(b => b.addEventListener("click", () => {
    applyStyleChoice(s, b.dataset.v);
    $$("#look-style .style-card", ov).forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
    $("#look-bg", ov).innerHTML = bgRow(); wireBg();
    rerender();
  }));
  $$("#look-cards button", ov).forEach(b => b.addEventListener("click", () => {
    s.cards = b.dataset.v; state.openCards = new Set();
    $$("#look-cards button", ov).forEach(x => x.classList.toggle("on", x === b)); rerender();
  }));
  wireBg();
  $("#look-skip", ov).addEventListener("click", () => done());
  $("#look-done", ov).addEventListener("click", () => done("Izgledaš super 😎"));
  ov.addEventListener("keydown", e => { if (e.key === "Escape") done(); });
  setTimeout(() => $("#look-style .style-card.on", ov)?.scrollIntoView({ block: "nearest", inline: "center" }), 60);
}

// ═══════════════ rating widget ═══════════════
function ratingWidget(container, initial, onChange) {
  const p = parseRating(initial);
  let v = p ? p.v : 0, plus = p ? p.plus : false, raw = initial || "";
  container.innerHTML = `<div class="rate">
    <div class="rate-track" role="slider" aria-label="Ocjena" tabindex="0">${[0, 1, 2, 3, 4].map(() => `<b>${rateSym()}</b>`).join("")}</div>
    <div class="rate-side">
      <span class="rate-val"></span>
      <button type="button" class="rate-plus" title="Plus – bolje nego što broj kaže" aria-label="Plus">+</button>
      <input class="fi rate-raw" placeholder="svoja" title="Ili upiši bilo što (npr. 4.5, 5+)" aria-label="Upiši ocjenu">
      <button type="button" class="mini" data-clear title="Očisti" aria-label="Očisti ocjenu">✕</button>
    </div></div>`;
  const track = $(".rate-track", container), stars = $$("b", track);
  const val = $(".rate-val", container), plusB = $(".rate-plus", container), rawI = $(".rate-raw", container);
  const paint = (fromRaw) => {
    stars.forEach((s, i) => s.style.setProperty("--f", Math.round(Math.max(0, Math.min(1, v - i)) * 100) + "%"));
    val.textContent = v ? fmtRating(v, plus) : "–";
    plusB.classList.toggle("on", plus);
    if (!fromRaw) rawI.value = v ? fmtRating(v, plus) : raw && !parseRating(raw) ? raw : "";
    onChange(rawI.value.trim());
  };
  const setFromX = (x) => {
    const r = track.getBoundingClientRect();
    const nv = Math.max(0.5, Math.min(5, Math.ceil(((x - r.left) / r.width) * 10) / 2));
    if (nv !== v) { v = nv; paint(); const s = stars[Math.ceil(v) - 1]; s.classList.add("hit"); setTimeout(() => s.classList.remove("hit"), 150); }
  };
  let dragging = false;
  track.addEventListener("pointerdown", e => { dragging = true; track.setPointerCapture(e.pointerId); setFromX(e.clientX); });
  track.addEventListener("pointermove", e => { if (dragging) setFromX(e.clientX); });
  track.addEventListener("pointerup", () => dragging = false);
  track.addEventListener("keydown", e => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { v = Math.min(5, v + 0.5); paint(); e.preventDefault(); }
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { v = Math.max(0, v - 0.5); paint(); e.preventDefault(); }
  });
  plusB.addEventListener("click", () => { plus = !plus; if (!v) v = 5; paint(); });
  $("[data-clear]", container).addEventListener("click", () => { v = 0; plus = false; raw = ""; paint(); });
  rawI.addEventListener("input", () => { raw = rawI.value; const q = parseRating(raw); if (q) { v = q.v; plus = q.plus; } paint(true); });
  paint();
}


// ═══════════════ full-screen pages (album form, settings) ═══════════════
/** Turns an overlay into a full-screen page. The phone's Back button closes it too.
 *  Returns close(): goes back one history step, which slides the page away. */
function asPage(ov) {
  ov.classList.add("page");
  document.body.classList.add("page-open");
  let closed = false;
  const finish = () => {
    closed = true; ov.classList.add("closing");
    setTimeout(() => { ov.remove(); if (!$(".overlay.page")) document.body.classList.remove("page-open"); }, 220);
  };
  try { history.pushState({ muzikaPage: true }, ""); } catch (e) {}
  const onPop = () => { if (!closed) finish(); };
  window.addEventListener("popstate", onPop, { once: true });
  ov._closePage = () => { if (closed) return; if (history.state?.muzikaPage) history.back(); else { window.removeEventListener("popstate", onPop); finish(); } };
  return ov._closePage;
}

// ═══════════════ add / edit album ═══════════════
/** Calm, two-step form: the essentials first, everything else folded under "More details".
 *  Every field is typed by the person – whatever they leave empty stays empty. */
function openEditor(a = null, prefill = {}) {
  if (!canWrite()) return;
  const editing = !!a;
  const src = a || prefill;
  const f = { rating: a?.rating || "", recommend: a?.recommend || "" };
  const ov = document.createElement("div");
  ov.className = "overlay editor";
  // bad → middle → good → really good ("DA" in capitals, like the group writes it)
  const recOpts = ["Ne", "Meh", "Da", "DA"];
  const recLabel = o => o === "DA" ? "🔥 DA" : o === "Da" ? "✅ Da" : o === "Ne" ? "❌ Ne" : o === "Meh" ? "🤷 Meh" : esc(o);
  if (f.recommend && !recOpts.includes(f.recommend)) recOpts.push(f.recommend);
  ov.innerHTML = `<form class="sheet" autocomplete="off" aria-label="${editing ? "Uredi album" : "Novi album"}">
    <div class="sheet-header"><button type="button" class="btn btn-ghost btn-icon page-back" data-close aria-label="Natrag"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="sheet-title">${editing ? "Uredi album" : "Novi album"}</div>
      <span class="page-who" title="Tablica u koju upisuješ">${avatar(a?.owner || state.me, 24)}<span>${esc(a?.owner || state.me)}</span></span></div>
    <div class="sheet-body">
      <div class="step" style="--s:0">
        <div class="fg"><label class="fl" for="f-artist">Izvođač</label><input class="fi fi-big" id="f-artist" value="${esc(src.artist || "")}" placeholder="npr. Pink Floyd" required></div>
        <div class="fg"><label class="fl" for="f-album">Album</label><input class="fi fi-big" id="f-album" value="${esc(src.album || "")}" placeholder="npr. Animals" required></div>
        <div class="hint hide" id="f-also"></div>
        <div class="marks" id="f-mark" role="radiogroup" aria-label="Oznaka">
          <button type="button" role="radio" data-v="first" class="mark-chip mark-first"><i aria-hidden="true"></i>Prvi put slušam izvođača</button>
          <button type="button" role="radio" data-v="re" class="mark-chip mark-re"><i aria-hidden="true"></i>Ponovno slušanje</button>
        </div>
      </div>
      <div class="step" style="--s:1">
        <div class="row3">
          <div class="fg"><label class="fl" for="f-year">Godina</label><input class="fi" id="f-year" value="${esc(a?.year || "")}" placeholder="1977" inputmode="numeric"></div>
          <div class="fg"><label class="fl" for="f-genre">Žanr</label><input class="fi" id="f-genre" value="${esc(a?.genre || "")}" placeholder="rock"></div>
          <div class="fg"><label class="fl" for="f-duration">Trajanje</label><input class="fi" id="f-duration" value="${esc(a?.duration || "")}" placeholder="45 min"></div>
        </div>
        <div class="fg fg-date"><label class="fl" for="f-date">Datum slušanja</label>
          <div class="date-field"><input class="fi" id="f-date" inputmode="numeric" autocomplete="off" placeholder="dd.mm.gggg" maxlength="10" value="${esc(fmtDMY(editing ? isoDate(a.listenedDate) : todayIso()))}">
            <button type="button" class="date-btn" id="f-date-btn" aria-label="Odaberi datum u kalendaru">📅</button>
            <input type="date" class="date-native" id="f-date-native" tabindex="-1" aria-hidden="true" value="${editing ? isoDate(a.listenedDate) : todayIso()}"></div>
          <div class="hint" id="f-date-hint" aria-live="polite"></div></div>
      </div>
      <div class="step" style="--s:2">
        <div class="fg"><label class="fl">Ocjena</label><div id="f-rating"></div></div>
      </div>
      <div class="step" style="--s:3">
        <div class="fg"><label class="fl" for="f-impression">Dojam albuma</label><textarea class="ft" id="f-impression" rows="1" placeholder="Kakav ti je bio?">${esc(a?.impression || "")}</textarea></div>
      </div>
      <div class="step" style="--s:4">
        <div class="fg"><label class="fl" for="f-tracks">Istaknute pjesme <small>– odvoji zarezom ili +, a „album!” znači cijeli album</small></label><input class="fi" id="f-tracks" value="${esc(a?.standoutTracks || "")}" placeholder="Dogs, Pigs, Sheep"></div>
      </div>
      <div class="step" style="--s:5">
        <div class="fg"><label class="fl">Preporučaš?</label><div class="choice" id="f-rec">${recOpts.map(o => `<button type="button" data-v="${esc(o)}" class="${f.recommend === o ? "on" : ""}">${recLabel(o)}</button>`).join("")}</div></div>
      </div>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-close>Odustani</button>
      <button class="btn btn-primary" id="f-save">${editing ? "Spremi" : "Dodaj album"}</button>
    </div>
  </form>`;
  document.body.appendChild(ov);
  const close = asPage(ov);
  $$("[data-close]", ov).forEach(b => b.addEventListener("click", close));

  ratingWidget($("#f-rating", ov), f.rating, v => f.rating = v);
  $$("#f-rec button", ov).forEach(b => b.addEventListener("click", () => {
    f.recommend = f.recommend === b.dataset.v ? "" : b.dataset.v;
    $$("#f-rec button", ov).forEach(x => x.classList.toggle("on", x.dataset.v === f.recommend));
  }));

  const artistI = $("#f-artist", ov), albumI = $("#f-album", ov);

  // "others listened to this too" + duplicate warning
  // the group's colour code: 🟣 first time hearing this artist, 🔵 relistening an album
  f.mark = a?.mark || ""; let markTouched = editing;
  const paintMark = () => $$("#f-mark button", ov).forEach(b => { const on = b.dataset.v === f.mark; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
  $$("#f-mark button", ov).forEach(b => b.addEventListener("click", () => { markTouched = true; f.mark = f.mark === b.dataset.v ? "" : b.dataset.v; paintMark(); }));
  paintMark();
  const checkAlso = () => {
    const nk = normKey(artistI.value, albumI.value), el = $("#f-also", ov);
    const owners = [...(D.byNk.get(nk) || [])].filter(o => !a || o !== a.owner);
    const dupe = !editing && owners.includes(state.me);
    const others = owners.filter(o => o !== state.me);
    el.className = "hint " + (dupe ? "ok" : "ok") + (!albumI.value || (!others.length && !dupe) ? " hide" : "");
    el.innerHTML = dupe ? "🔵 Ovaj album već imaš – označeno kao ponovno slušanje." : others.length ? `✨ Slušali su ga i: ${others.map(esc).join(", ")}!` : "";
    // suggest the mark until the user picks one themselves
    if (!markTouched && artistI.value.trim()) {
      const na = norm(artistI.value), mine = (state.view?.albums || []).filter(x => x.owner === state.me);
      f.mark = dupe ? "re" : !mine.some(x => norm(x.artist) === na) ? "first" : "";
      paintMark();
    }
  };

  // date: typed day.month.year (European), or picked from the calendar; shows which month it lands in
  const dateI = $("#f-date", ov), dateN = $("#f-date-native", ov), dateHint = $("#f-date-hint", ov);
  const owner = a?.owner || state.me;
  const monthTarget = () => {
    const iso = parseDMY(dateI.value);
    if (!iso) return dateI.value.trim() ? { bad: true } : null;
    const m = +iso.slice(5, 7), y = iso.slice(0, 4);
    const exists = (state.view?.albums || []).some(x => x.owner === owner && x.month === m && logYear(x) === y && (!a || x.key !== a.key));
    return { m, y, exists };
  };
  const paintDate = () => {
    const t = monthTarget();
    dateHint.className = "hint" + (t?.bad ? " warn" : "");
    dateHint.textContent = t?.bad ? "Upiši datum kao dd.mm.gggg, npr. 7.11.2026" : "";
    dateHint.hidden = !t?.bad;
  };
  dateI.addEventListener("input", e => {
    // 07112026 → 07.11.2026 while typing digits only
    const v = dateI.value;
    if (/^\d{8}$/.test(v)) dateI.value = `${v.slice(0, 2)}.${v.slice(2, 4)}.${v.slice(4)}`;
    const iso = parseDMY(dateI.value); if (iso) dateN.value = iso;
    paintDate();
  });
  dateI.addEventListener("blur", () => { const iso = parseDMY(dateI.value); if (iso) dateI.value = fmtDMY(iso); });
  $("#f-date-btn", ov).addEventListener("click", () => { try { dateN.showPicker(); } catch (e) { dateN.focus(); dateN.click(); } });
  dateN.addEventListener("change", () => { if (dateN.value) { dateI.value = fmtDMY(dateN.value); paintDate(); } });
  paintDate();

  artistI.addEventListener("input", checkAlso);
  albumI.addEventListener("input", checkAlso);
  if (prefill.artist || editing) checkAlso();

  ov.querySelector("form").addEventListener("submit", e => {
    e.preventDefault();
    const val = id => $(id, ov).value.trim();
    const data = {
      artist: val("#f-artist"), album: val("#f-album"), year: val("#f-year"), genre: val("#f-genre"),
      duration: val("#f-duration"), listenedDate: parseDMY(dateI.value) || "", rating: f.rating,
      impression: val("#f-impression"), standoutTracks: val("#f-tracks"), recommend: f.recommend,
      mark: f.mark || ""
    };
    if (!data.artist || !data.album) return toast("Izvođač i album su obavezni");
    if (dateI.value.trim() && !data.listenedDate) { dateI.focus(); return toast("Datum upiši kao dd.mm.gggg"); }
    if (editing) {
      if (String(a.id).startsWith("tmp_")) {
        const op = state.outbox.find(o => !o.done && o.payload.action === "add" && "tmp_" + o.payload.clientId === a.id);
        if (op) { Object.assign(op.payload, data); saveOutbox(); rebuild(); close(); return; }
        return toast("Još se sinkronizira – pokušaj za tren");
      }
      queue({ action: "update", id: a.id, owner: a.owner, expectArtist: a.artist, expectAlbum: a.album, ...data }, "Uređivanje");
      toast("Spremljeno ✏️");
    } else {
      Object.assign(data, { owner: state.me, clientId: uid(), ts: Date.now() });
      queue({ action: "add", ...data }, "Dodavanje albuma");
      state.scrollToEnd = true;
      const others = [...(D.byNk.get(normKey(data.artist, data.album)) || [])].filter(o => o !== state.me);
      toast(others.length ? `Dodano 🎉 ✨ Slušali su ga i: ${others.join(", ")}` : "Dodano 🎉", 3500);
    }
    close();
  });
  // no automatic keyboard: you see the whole form first and tap where you want to start
}

// ═══════════════ group password gate ═══════════════
/** Full-screen lock: shown whenever the Google script answers "AUTH". Typed once per device. */
function showGate(wrong = false) {
  if ($(".gate")) { if (wrong) gateWrong(); return; }
  if ($(".lang-screen")) { state.gateWanted = true; return; } // the language is picked first
  state.gateWanted = false;
  const el = document.createElement("div");
  el.className = "login gate";
  el.innerHTML = `<form class="login-box gate-box" autocomplete="on" aria-labelledby="gate-title">
    <div class="gate-lock" aria-hidden="true">🔒</div>
    <h1 class="login-title" id="gate-title">Muzika je zaključana</h1>
    <p class="login-sub">Upiši grupnu lozinku – pitaj nekoga iz ekipe. Treba samo jednom na ovom uređaju.</p>
    <input type="text" name="username" value="muzika" autocomplete="username" hidden>
    <div class="gate-field">
      <input class="fi" id="gate-code" type="password" autocomplete="current-password" placeholder="Grupna lozinka" aria-label="Grupna lozinka" required minlength="1">
      <button type="button" class="btn btn-ghost btn-icon" id="gate-eye" aria-label="Prikaži lozinku" aria-pressed="false">👁</button>
    </div>
    <div class="hint warn" id="gate-err" aria-live="polite"></div>
    <button class="btn btn-primary gate-go" id="gate-go">Otključaj</button>
  </form>`;
  document.body.appendChild(el);
  const inp = $("#gate-code", el), err = $("#gate-err", el), go = $("#gate-go", el);
  $("#gate-eye", el).addEventListener("click", e => {
    const show = inp.type === "password"; inp.type = show ? "text" : "password";
    e.currentTarget.setAttribute("aria-pressed", show); e.currentTarget.setAttribute("aria-label", show ? "Sakrij lozinku" : "Prikaži lozinku");
  });
  $("form", el).addEventListener("submit", async e => {
    e.preventDefault();
    const code = inp.value.trim();
    if (!code) return;
    go.disabled = true; go.textContent = "Provjeravam…"; err.textContent = "";
    const prev = groupCode();
    localStorage.setItem(CODE_KEY, code);
    try {
      await apiPost({ action: "getAll", v: "" });
      el.remove();
      toast("Otključano 🔓");
      await refresh(true);
      flush();
      if (!localStorage.getItem(WELCOME_KEY)) { if (state.me) renderWelcome(() => {}); else renderLogin(); }
    } catch (x) {
      if (prev) localStorage.setItem(CODE_KEY, prev); else localStorage.removeItem(CODE_KEY);
      go.disabled = false; go.textContent = "Otključaj";
      if (x instanceof AuthError) { err.textContent = "Pogrešna lozinka – pokušaj ponovno."; gateWrong(); }
      else err.textContent = isNetworkError(x) ? "Nema interneta – pokušaj kad budeš na mreži." : "Nešto nije u redu: " + (x.message || x);
    }
  });
  setTimeout(() => inp.focus(), 50);
}
function gateWrong() {
  const box = $(".gate-box"); if (!box) return;
  box.classList.remove("shake"); void box.offsetWidth; box.classList.add("shake");
  $("#gate-code")?.select();
}

// ═══════════════ settings ═══════════════
function openSettings(section) {
  const s = state.settings;
  const me = canWrite() ? userByName(state.me) : null;
  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML = `<div class="sheet">
    <div class="sheet-header"><button type="button" class="btn btn-ghost btn-icon page-back" data-close aria-label="Natrag"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="sheet-title">Postavke</div></div>
    <div class="sheet-body">
      ${me ? `<section class="set-card profile-card" id="sec-profile" aria-label="Profil">
        <button class="pc-av" id="s-av" type="button" title="Promijeni fotku" aria-label="Promijeni fotku">${avatar(me.name, 60)}<span class="pc-cam" aria-hidden="true">📷</span></button>
        <div class="pc-main">
          <div class="pc-name">${esc(me.name)}</div>
          <div class="pc-actions">
            <button class="pc-btn" id="s-color-toggle" type="button" aria-expanded="false" aria-controls="s-ucolor"><i class="pc-dot" style="background:${esc(me.color || "#888")}"></i>Boja</button>
            ${me.avatar ? `<button class="pc-btn danger" id="s-nophoto" type="button">Makni fotku</button>` : ""}
          </div>
        </div>
        <div class="color-pop" id="s-ucolor" hidden></div>
      </section>` : ""}

      <div class="set-heading">Muzika</div>
      <nav class="set-card set-list-card" aria-label="Muzika">
        <button class="set-item" id="s-rules" type="button"><span class="si-ic" aria-hidden="true">📜</span><span class="si-label">Pravila i upute</span><span class="si-go" aria-hidden="true">›</span></button>
        ${state.snap?.sheetUrl ? `<a class="set-item" href="${esc(state.snap.sheetUrl)}" target="_blank" rel="noopener"><span class="si-ic" aria-hidden="true">📊</span><span class="si-label">Otvori Google tablicu</span><span class="si-go" aria-hidden="true">↗</span></a>` : ""}
        <button class="set-item" id="s-share" type="button"><span class="si-ic" aria-hidden="true">🔗</span><span class="si-label">Pošalji link prijatelju</span><span class="si-go" aria-hidden="true">↗</span></button>
      </nav>

      <div class="set-heading">Izgled</div>
      <div class="set-card">
      <details class="group" ${section === "style" ? "open" : ""}><summary><span class="si-ic" aria-hidden="true">🎞️</span><span class="si-label">Stil</span><small class="group-val" id="gv-style">${esc(style().name)}</small></summary>
      <div class="styles" id="s-style">${Object.entries(STYLES).map(([k, st]) => `
        <button class="style-card ${s.style === k ? "on" : ""}" data-v="${k}" aria-pressed="${s.style === k}">
          <span class="style-swatch">${st.swatch.map(c => `<i style="background:${c}"></i>`).join("")}</span>
          <b style="font-family:${st.display || st.font}">${esc(st.name)}</b><small>${esc(st.desc)}</small>
        </button>`).join("")}</div>
      </details>

      <details class="group"><summary><span class="si-ic" aria-hidden="true">🔤</span><span class="si-label">Prikaz</span><small class="group-val" id="gv-view">${s.cards === "open" ? "otvorene kartice" : "zatvorene kartice"}</small></summary>
      <div class="set-list">
        <div class="set-row">
          <div class="set-label">Kartice albuma</div>
          <div class="seg wide" id="s-cards">${[["collapsed", "Zatvorene"], ["open", "Uvijek otvorene"]].map(([k, l]) => `<button data-v="${k}" class="${s.cards === k ? "on" : ""}">${l}</button>`).join("")}</div>
        </div>
      </div>
      </details>
      <details class="group"><summary><span class="si-ic" aria-hidden="true">🌍</span><span class="si-label">Jezik · Language</span><small class="group-val">${lang() === "en" ? "English" : "Hrvatski"}</small></summary>
      <div class="set-list">
        <div class="set-row">
          <div class="seg wide" id="s-lang">${[["hr", "🇭🇷 Hrvatski"], ["en", "🇬🇧 English"]].map(([k, l]) => `<button data-v="${k}" lang="${k}" class="${lang() === k ? "on" : ""}">${l}</button>`).join("")}</div>
        </div>
      </div>
      </details>

      <details class="group"><summary><span class="si-ic" aria-hidden="true">✨</span><span class="si-label">Pozadina koja lebdi</span><small class="group-val" id="gv-bg">${s.bg.on ? "uključena" : "isključena"}</small></summary>
      <div class="choice" id="s-bgset">
        <button data-v="off" class="${!s.bg.on ? "on" : ""}">Isključeno</button>
        ${Object.keys(BG_SETS).map(k => `<button data-v="${k}" class="${s.bg.on && s.bg.set === k ? "on" : ""}">${BG_SETS[k].slice(0, 3).join(" ")}</button>`).join("")}
      </div>
      <div class="row2" style="margin-top:12px">
        <div class="fg"><label class="fl" for="s-density">Količina</label><input type="range" class="range" id="s-density" min="4" max="50" value="${s.bg.density}"></div>
        <div class="fg"><label class="fl" for="s-speed">Brzina</label><input type="range" class="range" id="s-speed" min="0.3" max="2.5" step="0.1" value="${s.bg.speed}"></div>
      </div>
      <div class="fg"><label class="fl" for="s-opacity">Vidljivost</label><input type="range" class="range" id="s-opacity" min="0.3" max="3" step="0.1" value="${s.bg.opacity}"></div>

      </details>

      </div>

      <div class="set-heading">Podaci</div>
      <div class="set-card">
      <details class="group"><summary><span class="si-ic" aria-hidden="true">🛟</span><span class="si-label">Sinkronizacija</span><small class="group-val">${state.outbox.some(o => !o.done) ? "⏳ čeka" : "✓ spremljeno"}</small></summary>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
        <button class="btn btn-ghost btn-sm" id="s-backup">💾 Preuzmi kopiju</button>
        <button class="btn btn-ghost btn-sm" id="s-sync">🔄 Sinkroniziraj sad</button>
        ${lsGet(FAILED_KEY, []).length ? `<button class="btn btn-ghost btn-sm" id="s-retry">⚠️ Ponovno pošalji (${lsGet(FAILED_KEY, []).length})</button>` : ""}
      </div>
      ${lsGet(FAILED_KEY, []).length ? `<div class="hint warn">Tablica je odbila ${lsGet(FAILED_KEY, []).length === 1 ? "jednu promjenu" : lsGet(FAILED_KEY, []).length + " promjene"}: ${lsGet(FAILED_KEY, []).slice(-3).map(f => esc((f.payload.artist || "") + " – " + (f.payload.album || ""))).join(", ")}. Sačuvano na ovom uređaju.</div>` : ""}
      <div class="hint">${state.outbox.filter(o => !o.done).length ? `⏳ Promjena na čekanju: ${state.outbox.filter(o => !o.done).length} – spremljene su na uređaju.` : "✓ Sve je sinkronizirano."} Aplikacija čuva kopiju svih podataka na uređaju, pa radi i bez interneta.</div>
      </details>
      </div>

      <button class="link-btn switch-user" id="s-switch">Nisi ${me ? esc(me.name) : "ti"}? Promijeni korisnika</button>
    </div></div>`;
  document.body.appendChild(ov);
  const close = asPage(ov);
  $$("[data-close]", ov).forEach(b => b.addEventListener("click", close));
  if (section === "profile") setTimeout(() => $("#sec-profile", ov)?.scrollIntoView(), 0);

  const choice = (sel, fn) => $$(sel + " button", ov).forEach(b => b.addEventListener("click", () => {
    $$(sel + " button", ov).forEach(x => x.classList.toggle("on", x === b)); fn(b.dataset.v);
  }));
  const rerender = () => { saveSettings(); state.rendered = new Set(state.view?.albums.map(a => a.key)); renderMain(); };

  $$("#s-style .style-card", ov).forEach(b => b.addEventListener("click", () => {
    applyStyleChoice(s, b.dataset.v); // a new look starts from its own colours (icons / folded months stay)
    $$("#s-style .style-card", ov).forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
    $("#gv-style", ov).textContent = style().name;
    rerender();
  }));
  choice("#s-bgset", v => { setTimeout(() => { $("#gv-bg", ov).textContent = s.bg.on ? "uključena" : "isključena"; }, 0); if (v === "off") s.bg.on = false; else { s.bg.on = true; s.bg.set = v; } saveSettings(); });
  ["density", "speed", "opacity"].forEach(k => $("#s-" + k, ov).addEventListener("change", e => { s.bg[k] = +e.target.value; s.bg.on = true; saveSettings(); }));
    $$("#s-lang button", ov).forEach(b => b.addEventListener("click", () => { if (b.dataset.v !== lang()) setLang(b.dataset.v); }));
    choice("#s-cards", v => { $("#gv-view", ov).textContent = v === "open" ? "otvorene kartice" : "zatvorene kartice"; s.cards = v; state.openCards = new Set(); rerender(); });

  $("#s-backup", ov).addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), data: state.view, pending: state.outbox }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = `muzika-backup-${todayIso()}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  });
  $("#s-rules", ov).addEventListener("click", () => openRulesPage());
  $("#s-share", ov).addEventListener("click", shareApp);
  $("#s-sync", ov).addEventListener("click", () => { flush(); refresh(true); toast("Sinkroniziram…"); });
  $("#s-retry", ov)?.addEventListener("click", e => { const n = retryFailed(); e.target.remove(); toast(`Šaljem ponovno: ${n}`); });
  $("#s-switch", ov).addEventListener("click", () => { close(); state.me = null; localStorage.removeItem("muzika_user"); renderLogin(); });

  if (me) {
    const setPhoto = async () => {
      const f = await pickFile(); if (!f) return;
      try {
        const data = await resizeImage(f, 160, true);
        queue({ action: "updateUser", name: me.name, avatar: data }, "Fotka profila");
        close(); toast("Izgledaš super 😎");
      } catch (e) { toast(e.message); }
    };
    $("#s-av", ov).addEventListener("click", setPhoto);
    $("#s-color-toggle", ov).addEventListener("click", e => {
      const pop = $("#s-ucolor", ov), open = pop.hidden;
      pop.hidden = !open; e.currentTarget.setAttribute("aria-expanded", open);
    });
    $("#s-nophoto", ov)?.addEventListener("click", () => { queue({ action: "updateUser", name: me.name, avatar: "" }, "Fotka profila"); close(); });
    let ucT;
    colorPicker($("#s-ucolor", ov), { value: me.color, tones: PALETTE_TONES.slice(0, 2), onPick: c => {
      $(".pc-dot", ov).style.background = c;
      clearTimeout(ucT); ucT = setTimeout(() => queue({ action: "updateUser", name: me.name, color: c }, "Boja profila"), 500);
    } });
  }
}

// ═══════════════ colour palette + own colour picker (same in every style) ═══════════════
const PALETTE_HUES = [0, 18, 35, 50, 85, 135, 165, 190, 210, 235, 270, 320];
const PALETTE_TONES = [[85, 80], [72, 62], [60, 42]]; // [saturation, lightness]: light, medium, deep
function hslHex(h, sat, l) {
  sat /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = sat * Math.min(l, 1 - l);
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, "0");
  return `#${f(0)}${f(8)}${f(4)}`;
}
function hexHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return { h: 0, l: 60 };
  const n = parseInt(m[1], 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: Math.round((h * 60 + 360) % 360), l: Math.round(l * 100) };
}
const PALETTE = tones => tones.flatMap(([sa, l]) => PALETTE_HUES.map(h => hslHex(h, sa, l)));

/** A grid of colours + "Svoja boja" with two friendly sliders (shade, light↔dark) instead of the system picker. */
function colorPicker(el, { value, tones = PALETTE_TONES, onPick }) {
  const colors = PALETTE(tones);
  let cur = String(value || "").toLowerCase();
  el.classList.add("cpick");
  el.innerHTML = `<div class="cp-grid">${colors.map(c => `<button type="button" class="cp-sw" data-c="${c}" style="--c:${c}" aria-label="Boja ${c}"></button>`).join("")}</div>
    <button type="button" class="cp-own-toggle" aria-expanded="false"><i class="cp-own-dot"></i>Svoja boja</button>
    <div class="cp-own" hidden>
      <label class="cp-row"><span>Nijansa</span><input type="range" class="cp-hue" min="0" max="359" step="1" aria-label="Nijansa"></label>
      <label class="cp-row"><span>Svjetlina</span><input type="range" class="cp-light" min="25" max="88" step="1" aria-label="Svjetlina"></label>
    </div>`;
  const hue = $(".cp-hue", el), light = $(".cp-light", el), own = $(".cp-own", el), tog = $(".cp-own-toggle", el), dot = $(".cp-own-dot", el);
  const paint = () => {
    $$(".cp-sw", el).forEach(b => b.classList.toggle("on", b.dataset.c === cur));
    const custom = cur && !colors.includes(cur);
    tog.classList.toggle("on", custom);
    dot.style.background = custom ? cur : "conic-gradient(#f66, #fd5, #6f8, #6cf, #a7f, #f6c, #f66)";
    const { h, l } = hexHsl(cur || "#ff6b6b");
    hue.value = h; light.value = Math.max(25, Math.min(88, l));
    light.style.setProperty("--h", h);
  };
  const pick = c => { cur = c.toLowerCase(); paint(); onPick(cur); };
  $$(".cp-sw", el).forEach(b => b.addEventListener("click", () => pick(b.dataset.c)));
  tog.addEventListener("click", () => { own.hidden = !own.hidden; tog.setAttribute("aria-expanded", !own.hidden); });
  const fromSliders = () => { light.style.setProperty("--h", hue.value); pick(hslHex(+hue.value, 72, +light.value)); };
  hue.addEventListener("input", fromSliders); light.addEventListener("input", fromSliders);
  paint();
  return { set: c => { cur = String(c || "").toLowerCase(); paint(); } };
}

// ═══════════════ per-month style sheet ═══════════════
/** One simple page: live preview on top, then colour, symbol, card tint and the (all-months) name size. */
function openMonthStyle(m) {
  const S = () => state.settings; // always the live settings (a sync from another device can swap the object)
  const name = m ? MONTH_NAMES[m - 1] : "Bez mjeseca";
  const mp = () => (S().months[m] = S().months[m] || {});
  const custom = !MONTH_ICONS.includes(mp().icon || "") ? mp().icon : "";
  const ov = document.createElement("div");
  ov.className = "overlay month-sheet";
  ov.innerHTML = `<div class="sheet sheet-sm" role="dialog" aria-label="Izgled mjeseca: ${esc(name)}">
    <div class="sheet-header"><div class="sheet-title">Izgled mjeseca</div><button class="btn btn-ghost btn-icon" data-close aria-label="Zatvori">✕</button></div>
    <div class="month-preview-wrap"><div class="month month-pv"><div class="month-head preview" aria-hidden="true"><span class="month-name"><h2></h2></span><span class="month-rule"></span></div></div>
      <div class="card preview-card" aria-hidden="true"><div class="card-top"><div class="card-main"><div class="artist">Izvođač</div><div class="album-name">Ovako izgledaju kartice</div></div><div class="peek"><span class="score">${rateSym()} <b>4.5</b></span></div></div></div></div>
    <div class="sheet-body">
      <section class="ms-sec"><div class="fl">Boja <span class="fl-acts"><button type="button" class="mini" id="m-color-reset">zadana</button></span></div><div id="m-color"></div>
        <div class="ms-range ms-tint" title="Koliko su kartice ovog mjeseca obojene"><span class="tint-ic tint-0" aria-hidden="true"></span><input type="range" class="range" id="m-tint" min="0" max="100" value="${parseInt(monthTint(m))}" aria-label="Obojenost kartica"><span class="tint-ic tint-1" aria-hidden="true"></span></div></section>
      <section class="ms-sec"><div class="fl">Simbol</div>
        <div class="sym-strip" id="m-icon">${MONTH_ICONS.map(ic => `<button type="button" data-v="${esc(ic)}" aria-label="${ic ? "Simbol " + ic : "Bez simbola"}">${ic || "∅"}</button>`).join("")}<label class="sym-own"><span aria-hidden="true">✎</span><input id="m-icon-custom" maxlength="12" placeholder="svoj…" value="${esc(custom || "")}" aria-label="Upiši svoj simbol"></label></div>
      </section>
      <section class="ms-sec ms-all"><div class="fl"><label for="m-scale">Veličina naziva</label> <small>– za sve mjesece · <span id="m-scale-v">${Math.round((S().monthScale || 1) * 100)} %</span></small></div>
        <div class="ms-range"><small aria-hidden="true">A</small><input type="range" class="range" id="m-scale" min="0.7" max="1.5" step="0.05" value="${S().monthScale || 1}"><small aria-hidden="true" style="font-size:18px">A</small></div>
      </section>
    </div>
    <div class="form-actions"><button class="btn btn-ghost" id="m-reset">Vrati zadano</button><button class="btn btn-primary" data-close>Gotovo</button></div>
  </div>`;
  document.body.appendChild(ov);
  const close = () => { ov.classList.add("closing"); setTimeout(() => ov.remove(), 200); };
  $$("[data-close]", ov).forEach(b => b.addEventListener("click", close));
  ov.addEventListener("click", e => { if (e.target === ov) close(); });

  const picker = colorPicker($("#m-color", ov), { value: monthColor(m), onPick: c => { mp().color = c; apply(); } });
  // "Svoja boja" sits in the section header next to "zadana" – keeps the sheet short enough to need no scrolling
  $("#m-color-reset", ov).before($(".cp-own-toggle", ov));
  const paint = () => {
    const c = monthColor(m);
    [$(".sheet", ov), $(".preview-card", ov)].forEach(el => { el.style.setProperty("--m", c); el.style.setProperty("--tint", monthTint(m)); });
    $(".preview h2", ov).innerHTML = monthTitleHtml(m);
    $$("#m-icon button", ov).forEach(x => x.classList.toggle("on", x.dataset.v === (mp().icon || "")));
    $(".sym-own", ov).classList.toggle("on", !!mp().icon && !MONTH_ICONS.includes(mp().icon));
    $("#m-tint", ov).value = parseInt(monthTint(m));
    $("#m-scale-v", ov).textContent = Math.round((S().monthScale || 1) * 100) + " %";
  };
  const apply = () => { saveSettings(); paint(); state.rendered = new Set(state.view?.albums.map(a => a.key)); renderList(); };
  paint();
  { // start the symbol strip at the chosen one
    const strip = $("#m-icon", ov), on = $(".on", strip) || $(".sym-own.on", strip);
    if (on) strip.scrollLeft = Math.max(0, on.offsetLeft - strip.offsetLeft - strip.clientWidth / 2 + on.offsetWidth / 2);
  }

  $("#m-color-reset", ov).addEventListener("click", () => { delete mp().color; picker.set(monthColor(m)); apply(); });
  $("#m-tint", ov).addEventListener("input", e => { mp().tint = +e.target.value; apply(); });
  $("#m-scale", ov).addEventListener("input", e => { S().monthScale = +e.target.value; apply(); });
  $$("#m-icon button", ov).forEach(b => b.addEventListener("click", () => { mp().icon = b.dataset.v; $("#m-icon-custom", ov).value = ""; apply(); }));
  $("#m-icon-custom", ov).addEventListener("input", e => {
    // short on purpose: at most 3 visible characters (an emoji with skin tone counts as one)
    let v = e.target.value.trim();
    try { v = [...new Intl.Segmenter().segment(v)].slice(0, 3).map(x => x.segment).join(""); } catch (err) { v = [...v].slice(0, 3).join(""); }
    mp().icon = v; apply();
  });
  $("#m-reset", ov).addEventListener("click", () => {
    const hidden = mp().hidden;
    delete S().months[m]; if (hidden !== undefined) mp().hidden = hidden;
    $("#m-icon-custom", ov).value = ""; picker.set(monthColor(m)); apply();
  });
}

// ═══════════════ floating background ═══════════════
let bgSig = "";
function renderBg() {
  const el = $("#bg"), b = state.settings.bg;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sig = JSON.stringify([b, state.settings.accent, state.settings.style, allMonthColors(), reduce]);
  if (sig === bgSig) return;
  bgSig = sig;
  if (!b.on || reduce) { el.innerHTML = ""; return; }
  const syms = BG_SETS[b.set] || BG_SETS.notes;
  const colors = b.color === "accent" ? [state.settings.accent || style().accent] : b.color === "white" ? [state.settings.style === "film" ? "#4E342E" : "#ffffff"] : allMonthColors();
  const n = Math.round(b.density);
  let h = "";
  for (let i = 0; i < n; i++) {
    const sym = syms[Math.floor(Math.random() * syms.length)];
    const wide = sym.length > 2;
    const size = (wide ? 11 : 14) + Math.random() * (wide ? 8 : 22);
    const dur = (22 + Math.random() * 28) / (b.speed || 1);
    h += `<span style="--x:${(Math.random() * 100).toFixed(1)}vw;--s:${size.toFixed(0)}px;--d:${dur.toFixed(1)}s;--dl:${(-Math.random() * dur).toFixed(1)}s;--sw:${((Math.random() * 2 - 1) * 60).toFixed(0)}px;--r:${((Math.random() * 2 - 1) * 50).toFixed(0)}deg;--o:${Math.min(0.5, (0.05 + Math.random() * 0.09) * (b.opacity || 1)).toFixed(3)};--c:${colors[Math.floor(Math.random() * colors.length)]}">${esc(sym)}</span>`;
  }
  el.innerHTML = h;
}

// ═══════════════ boot ═══════════════
(function boot() {
  loadCache();
  // a shared link (…/?tko) always starts at "Tko sluša?" – nobody lands in someone else's table
  const params = new URLSearchParams(location.search);
  if (params.has("tko")) {
    localStorage.removeItem("muzika_user");
    params.delete("tko");
    history.replaceState(null, "", location.pathname + (params.toString() ? "?" + params : "") + location.hash);
  }
  const saved = localStorage.getItem("muzika_user");
  state.me = saved || null;
  loadSettings(); applyTheme(); loadSeen();
  state.scrollToEnd = true;
  // very first visit: language → group password → greeting (in that language) → who's listening
  if (!localStorage.getItem(LANG_KEY) && !localStorage.getItem(WELCOME_KEY)) renderLangPick();
  else if (state.me) rebuild(); else renderLogin();
  // people who already used the app see the welcome + rules once, too (once the data – and so the password – is in)
  if (state.me && !localStorage.getItem(WELCOME_KEY) && localStorage.getItem(LANG_KEY)) state.welcomeWanted = true;
  refresh(true).then(() => {
    if ($(".lang-screen, .gate")) return;
    if (!state.me) renderLogin();
    else if (state.welcomeWanted && state.snap) { state.welcomeWanted = false; renderWelcome(() => {}); }
  });
  startPolling();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
