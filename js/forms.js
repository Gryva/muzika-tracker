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
function renderLogin(joining = false) {
  $(".login")?.remove();
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
}

// ═══════════════ rating widget ═══════════════
function ratingWidget(container, initial, onChange) {
  const p = parseRating(initial);
  let v = p ? p.v : 0, plus = p ? p.plus : false, raw = initial || "";
  container.innerHTML = `<div class="rate">
    <div class="rate-track" role="slider" aria-label="Ocjena" tabindex="0">${[0, 1, 2, 3, 4].map(() => `<b>★</b>`).join("")}</div>
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

// ═══════════════ duration in the owner's own style ═══════════════
/** Writes seconds the way this person already writes durations in their tab: "36min", "50 min", "1h 16 min", "41 min 22 sek". */
function fmtDurationLike(sec, owner) {
  sec = Math.round(Number(sec) || 0);
  if (!sec) return "";
  const mine = (state.view?.albums || []).filter(a => a.owner === owner && a.duration).map(a => String(a.duration).trim());
  const sample = mine.slice(-30);
  const has = re => sample.some(d => re.test(d));
  const gap = sample.length && !has(/\d\s+min/i) && has(/\d+min/i) ? "" : " ";
  const useSec = has(/sek|sec|\d+:\d{2}/i);
  const useHours = has(/\d\s*h\b/i);
  const colon = sample.length && sample.filter(d => /^\d+:\d{2}(:\d{2})?$/.test(d)).length > sample.length / 2;
  if (colon) {
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  }
  let m = useSec ? Math.floor(sec / 60) : Math.round(sec / 60);
  const s = sec % 60;
  let out = "";
  if (useHours && m >= 60) { out = `${Math.floor(m / 60)}h `; m %= 60; }
  out += `${m}${gap}min`;
  if (useSec && s) out += ` ${s}${gap}sek`;
  return out;
}

// ═══════════════ add / edit album ═══════════════
/** Calm, two-step form: the essentials first, everything else folded under "More details".
 *  Year / genre / duration / Spotify + YouTube links are found automatically in the background. */
function openEditor(a = null, prefill = {}) {
  if (!canWrite()) return;
  const editing = !!a;
  const src = a || prefill;
  const f = { rating: a?.rating || "", recommend: a?.recommend || "", lookup: null };
  const ov = document.createElement("div");
  ov.className = "overlay editor";
  const recOpts = ["Da", "Ne", "Meh"];
  if (f.recommend && !recOpts.includes(f.recommend)) recOpts.push(f.recommend);
  const hasMore = editing && (a.year || a.genre || a.duration || a.standoutTracks || a.comments);
  ov.innerHTML = `<form class="sheet" autocomplete="off" aria-label="${editing ? "Uredi album" : "Novi album"}">
    <div class="sheet-header"><div class="sheet-title">${editing ? "Uredi album" : "Novi album"}</div><button type="button" class="btn btn-ghost btn-icon" data-close aria-label="Zatvori">✕</button></div>
    <div class="sheet-body">
      <div class="step" style="--s:0">
        <div class="fg"><label class="fl" for="f-artist">Izvođač</label><input class="fi fi-big" id="f-artist" value="${esc(src.artist || "")}" placeholder="npr. Pink Floyd" required></div>
        <div class="fg"><label class="fl" for="f-album">Album</label><input class="fi fi-big" id="f-album" value="${esc(src.album || "")}" placeholder="npr. Animals" required></div>
        <div class="hint hide" id="f-also"></div>
        <div class="hint found" id="f-found" aria-live="polite"></div>
      </div>
      <div class="step" style="--s:1">
        <div class="fg"><label class="fl">Ocjena</label><div id="f-rating"></div></div>
      </div>
      <div class="step" style="--s:2">
        <div class="fg"><label class="fl">Preporučaš?</label><div class="choice" id="f-rec">${recOpts.map(o => `<button type="button" data-v="${esc(o)}" class="${f.recommend === o ? "on" : ""}">${o === "Da" ? "✅ Da" : o === "Ne" ? "❌ Ne" : o === "Meh" ? "🤷 Meh" : esc(o)}</button>`).join("")}</div></div>
      </div>
      <div class="step" style="--s:3">
        <div class="fg"><label class="fl" for="f-impression">Dojam</label><textarea class="ft" id="f-impression" placeholder="Kakav ti je bio?">${esc(a?.impression || "")}</textarea></div>
      </div>
      <details class="group more step" style="--s:4" ${hasMore ? "open" : ""}><summary>Više detalja <small>– datum, godina, žanr, pjesme…</small></summary>
        <div class="row3">
          <div class="fg"><label class="fl" for="f-date">Slušano</label><input type="date" class="fi" id="f-date" value="${editing ? isoDate(a.listenedDate) : todayIso()}"></div>
          <div class="fg"><label class="fl" for="f-year">Godina</label><input class="fi" id="f-year" value="${esc(a?.year || "")}" placeholder="automatski" inputmode="numeric"></div>
          <div class="fg"><label class="fl" for="f-duration">Trajanje</label><input class="fi" id="f-duration" value="${esc(a?.duration || "")}" placeholder="automatski"></div>
        </div>
        <div class="fg"><label class="fl" for="f-genre">Žanr</label><input class="fi" id="f-genre" value="${esc(a?.genre || "")}" placeholder="automatski"></div>
        <div class="fg"><label class="fl" for="f-tracks">Istaknute pjesme</label><input class="fi" id="f-tracks" value="${esc(a?.standoutTracks || "")}" placeholder="Dogs, Pigs, Sheep"></div>
        <div class="fg"><label class="fl" for="f-comments">Bilješka <small>– ide u stupac s komentarima u tablici</small></label><input class="fi" id="f-comments" value="${esc(a?.comments || "")}" placeholder="Još nešto?"></div>
      </details>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-close>Odustani</button>
      <button class="btn btn-primary" id="f-save">${editing ? "Spremi" : "Dodaj album"}</button>
    </div>
  </form>`;
  document.body.appendChild(ov);
  const close = () => { ov.classList.add("closing"); setTimeout(() => ov.remove(), 220); };
  $$("[data-close]", ov).forEach(b => b.addEventListener("click", close));
  ov.addEventListener("click", e => { if (e.target === ov) close(); });

  ratingWidget($("#f-rating", ov), f.rating, v => f.rating = v);
  $$("#f-rec button", ov).forEach(b => b.addEventListener("click", () => {
    f.recommend = f.recommend === b.dataset.v ? "" : b.dataset.v;
    $$("#f-rec button", ov).forEach(x => x.classList.toggle("on", x.dataset.v === f.recommend));
  }));

  const artistI = $("#f-artist", ov), albumI = $("#f-album", ov), found = $("#f-found", ov);

  // "others listened to this too" + duplicate warning
  const checkAlso = () => {
    const nk = normKey(artistI.value, albumI.value), el = $("#f-also", ov);
    const owners = [...(D.byNk.get(nk) || [])].filter(o => !a || o !== a.owner);
    const dupe = !editing && owners.includes(state.me);
    const others = owners.filter(o => o !== state.me);
    el.className = "hint " + (dupe ? "warn" : "ok") + (!albumI.value || (!others.length && !dupe) ? " hide" : "");
    el.innerHTML = dupe ? "⚠️ Ovaj album si već upisao/la." : others.length ? `✨ Slušali su ga i: ${others.map(esc).join(", ")}!` : "";
  };

  // quietly fill year / genre / duration (only empty or still-automatic fields) and remember the links
  let lookupSeq = 0;
  const auto = {};
  const fillAuto = (id, value) => {
    const el = $(id, ov);
    if (value && (!el.value || el.value === auto[id])) { el.value = auto[id] = value; return true; }
    return false;
  };
  const lookup = async () => {
    const artist = artistI.value.trim(), album = albumI.value.trim();
    if (!artist || !album) { found.textContent = ""; return; }
    const seq = ++lookupSeq;
    found.textContent = "Tražim podatke…"; found.className = "hint found";
    try {
      const r = (await apiPost({ action: "lookup", artist, album })).result;
      if (seq !== lookupSeq) return;
      f.lookup = r;
      const got = [];
      if (fillAuto("#f-year", r?.year)) got.push("godinu");
      if (fillAuto("#f-genre", r?.genre)) got.push("žanr");
      if (fillAuto("#f-duration", fmtDurationLike(r?.durationSec, a?.owner || state.me))) got.push("trajanje");
      if (r?.spotify || r?.youtube || r?.apple || r?.deezer) got.push("linkove za slušanje");
      found.textContent = got.length ? `✓ Pronađeno: ${got.join(", ")}` : r ? "✓ Pronađeno" : "";
      found.className = "hint found ok";
    } catch (e) {
      if (seq === lookupSeq) found.textContent = isNetworkError(e) ? "Izvan mreže – podaci će se popuniti kasnije" : "";
    }
  };
  let lt;
  const onNameChange = () => { checkAlso(); clearTimeout(lt); lt = setTimeout(lookup, 700); };
  artistI.addEventListener("input", onNameChange);
  albumI.addEventListener("input", onNameChange);
  if (prefill.artist && !editing) { checkAlso(); lookup(); }
  if (editing) checkAlso();

  ov.querySelector("form").addEventListener("submit", e => {
    e.preventDefault();
    const val = id => $(id, ov).value.trim();
    const data = {
      artist: val("#f-artist"), album: val("#f-album"), year: val("#f-year"), genre: val("#f-genre"),
      duration: val("#f-duration"), listenedDate: $("#f-date", ov).value || "", rating: f.rating,
      impression: val("#f-impression"), standoutTracks: val("#f-tracks"), recommend: f.recommend,
      comments: val("#f-comments")
    };
    if (!data.artist || !data.album) return toast("Izvođač i album su obavezni");
    const L = f.lookup || {};
    ["spotify", "youtube", "apple", "deezer"].forEach(k => { if (L[k] && !(editing && a[k])) data[k] = L[k]; });
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
  setTimeout(() => (editing ? null : artistI.value ? $("#f-impression", ov) : artistI)?.focus({ preventScroll: true }), 380);
}

// ═══════════════ settings ═══════════════
function openSettings(section) {
  const s = state.settings;
  const me = canWrite() ? userByName(state.me) : null;
  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML = `<div class="sheet">
    <div class="sheet-header"><div class="sheet-title">Postavke</div><button class="btn btn-ghost btn-icon" data-close aria-label="Zatvori">✕</button></div>
    <div class="sheet-body">
      ${me ? `<div class="section-title" id="sec-profile">👤 Profil</div>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:6px">
        <span id="s-av" style="cursor:pointer" title="Promijeni fotku">${avatar(me.name, 64)}</span>
        <div style="flex:1"><div style="font-weight:800;font-size:17px">${esc(me.name)}</div>
          <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap"><button class="mini" id="s-photo">📷 Promijeni fotku</button>${me.avatar ? `<button class="mini danger" id="s-nophoto">Makni fotku</button>` : ""}</div></div>
      </div>
      <div class="swatches" id="s-ucolor">${USER_COLORS_UI.map(c => `<button class="sw ${c === me.color ? "on" : ""}" data-c="${c}" style="background:${c};width:26px;height:26px" aria-label="Boja profila ${c}"></button>`).join("")}</div>` : ""}
      ${state.snap?.sheetUrl ? `<a class="sheet-link" href="${esc(state.snap.sheetUrl)}" target="_blank" rel="noopener">📊 Otvori Google tablicu <span aria-hidden="true">↗</span></a>` : ""}

      <details class="group" ${section === "style" ? "open" : ""}><summary>🎞️ Stil <small class="group-val">${esc(style().name)}</small></summary>
      <div class="styles" id="s-style">${Object.entries(STYLES).map(([k, st]) => `
        <button class="style-card ${s.style === k ? "on" : ""}" data-v="${k}" aria-pressed="${s.style === k}">
          <span class="style-swatch">${st.swatch.map(c => `<i style="background:${c}"></i>`).join("")}</span>
          <b style="font-family:${st.display || st.font}">${esc(st.name)}</b><small>${esc(st.desc)}</small>
        </button>`).join("")}</div>
      <div class="hint">Boje mjeseci: dodirni ⚙︎ pored naziva mjeseca.</div>
      </details>

      <details class="group"><summary>🎨 Boja, font i kartice</summary>
      <div class="fl" style="margin-top:6px">Boja naglaska <button class="mini" id="s-accent-reset">Kao u stilu</button></div>
      <div class="swatches" id="s-accent">${Object.values(THEMES).map(c => `<button class="sw ${c === s.accent ? "on" : ""}" data-c="${c}" style="background:${c}" aria-label="Naglasak ${c}"></button>`).join("")}
        <input type="color" class="sw-input" id="s-accent-custom" value="${esc(s.accent || style().accent)}" title="Svoja boja" aria-label="Svoja boja naglaska"></div>

      <div class="fl" style="margin-top:16px">Font</div>
      <div class="choice" id="s-font"><button data-v="auto" class="${s.font === "auto" ? "on" : ""}">iz stila</button>${Object.keys(FONTS).map(k => `<button data-v="${k}" class="${s.font === k ? "on" : ""}" style="font-family:${FONTS[k]}">${k}</button>`).join("")}</div>
      <div class="fl" style="margin-top:16px"><label for="s-mscale">Veličina naziva mjeseca</label> <small id="s-mscale-v">${Math.round((s.monthScale || 1) * 100)}%</small></div>
      <div class="ms-range"><small>A</small><input type="range" class="range" id="s-mscale" min="0.7" max="1.5" step="0.05" value="${s.monthScale || 1}"><small style="font-size:18px">A</small></div>
      <div class="fl" style="margin-top:16px">Kartice albuma</div>
      <div class="choice" id="s-cards">${[["collapsed", "Uredno – dodirni za otvaranje"], ["open", "Uvijek otvorene"]].map(([k, l]) => `<button data-v="${k}" class="${s.cards === k ? "on" : ""}">${l}</button>`).join("")}</div>
      </details>

      <details class="group"><summary>✨ Pozadina koja lebdi</summary>
      <div class="choice" id="s-bgset">
        <button data-v="off" class="${!s.bg.on ? "on" : ""}">Isključeno</button>
        ${Object.keys(BG_SETS).map(k => `<button data-v="${k}" class="${s.bg.on && s.bg.set === k ? "on" : ""}">${BG_SETS[k].slice(0, 3).join(" ")}</button>`).join("")}
      </div>
      <div class="row2" style="margin-top:12px">
        <div class="fg"><label class="fl" for="s-density">Količina</label><input type="range" class="range" id="s-density" min="4" max="50" value="${s.bg.density}"></div>
        <div class="fg"><label class="fl" for="s-speed">Brzina</label><input type="range" class="range" id="s-speed" min="0.3" max="2.5" step="0.1" value="${s.bg.speed}"></div>
      </div>
      <div class="row2">
        <div class="fg"><label class="fl" for="s-opacity">Vidljivost</label><input type="range" class="range" id="s-opacity" min="0.3" max="3" step="0.1" value="${s.bg.opacity}"></div>
        <div class="fg"><label class="fl">Boje</label><div class="choice" id="s-bgcolor">${[["months", "Mjeseci"], ["accent", "Naglasak"], ["white", "Jedna"]].map(([k, l]) => `<button data-v="${k}" class="${s.bg.color === k ? "on" : ""}">${l}</button>`).join("")}</div></div>
      </div>

      </details>

      <details class="group"><summary>🛟 Sigurnosna kopija i sinkronizacija ${state.outbox.some(o => !o.done) ? `<span class="pending-pill">⏳ čeka</span>` : ""}</summary>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
        <button class="btn btn-ghost btn-sm" id="s-backup">💾 Preuzmi kopiju</button>
        <button class="btn btn-ghost btn-sm" id="s-sync">🔄 Sinkroniziraj sad</button>
      </div>
      <div class="hint">${state.outbox.filter(o => !o.done).length ? `⏳ Promjena na čekanju: ${state.outbox.filter(o => !o.done).length} – spremljene su na uređaju.` : "✓ Sve je sinkronizirano."} Aplikacija čuva kopiju svih podataka na uređaju, pa radi i bez interneta.</div>
      </details>

      <button class="link-btn switch-user" id="s-switch">Nisi ${me ? esc(me.name) : "ti"}? Promijeni korisnika</button>
    </div></div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  $$("[data-close]", ov).forEach(b => b.addEventListener("click", close));
  ov.addEventListener("click", e => { if (e.target === ov) close(); });
  if (section === "profile") setTimeout(() => $("#sec-profile", ov)?.scrollIntoView(), 0);

  const choice = (sel, fn) => $$(sel + " button", ov).forEach(b => b.addEventListener("click", () => {
    $$(sel + " button", ov).forEach(x => x.classList.toggle("on", x === b)); fn(b.dataset.v);
  }));
  const rerender = () => { saveSettings(); state.rendered = new Set(state.view?.albums.map(a => a.key)); renderMain(); };

  $$("#s-style .style-card", ov).forEach(b => b.addEventListener("click", () => {
    s.style = b.dataset.v;
    // a new look starts from its own colours: drop accent + month colour overrides (icons / folded months stay)
    s.accent = null; s.tint = null;
    Object.values(s.months).forEach(mp => { delete mp.color; delete mp.tint; });
    if (style().bgSet === "off") s.bg.on = false;
    else if (Object.values(STYLES).some(x => x.bgSet === s.bg.set) || !s.bg.on) { s.bg.set = style().bgSet; s.bg.on = true; }
    $$("#s-style .style-card", ov).forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
    $$("#s-accent .sw", ov).forEach(x => x.classList.remove("on"));
    $("#s-accent-custom", ov).value = style().accent;
    $(".group-val", ov).textContent = style().name;
    rerender();
  }));
  $$("#s-accent .sw", ov).forEach(el => el.addEventListener("click", () => {
    $$("#s-accent .sw", ov).forEach(x => x.classList.toggle("on", x === el)); s.accent = el.dataset.c; saveSettings();
  }));
  $("#s-accent-reset", ov).addEventListener("click", () => { s.accent = null; $$("#s-accent .sw", ov).forEach(x => x.classList.remove("on")); $("#s-accent-custom", ov).value = style().accent; saveSettings(); });
  $("#s-accent-custom", ov).addEventListener("input", e => { s.accent = e.target.value; $$("#s-accent .sw", ov).forEach(x => x.classList.remove("on")); saveSettings(); });
  choice("#s-bgset", v => { if (v === "off") s.bg.on = false; else { s.bg.on = true; s.bg.set = v; } saveSettings(); });
  choice("#s-bgcolor", v => { s.bg.color = v; saveSettings(); });
  ["density", "speed", "opacity"].forEach(k => $("#s-" + k, ov).addEventListener("change", e => { s.bg[k] = +e.target.value; s.bg.on = true; saveSettings(); }));
  choice("#s-font", v => { s.font = v; saveSettings(); });
  $("#s-mscale", ov).addEventListener("input", e => { s.monthScale = +e.target.value; $("#s-mscale-v", ov).textContent = Math.round(s.monthScale * 100) + "%"; saveSettings(); });
  choice("#s-cards", v => { s.cards = v; state.openCards = new Set(); rerender(); });

  $("#s-backup", ov).addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), data: state.view, pending: state.outbox }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = `muzika-backup-${todayIso()}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  });
  $("#s-sync", ov).addEventListener("click", () => { flush(); refresh(true); toast("Sinkroniziram…"); });
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
    $("#s-photo", ov).addEventListener("click", setPhoto);
    $("#s-nophoto", ov)?.addEventListener("click", () => { queue({ action: "updateUser", name: me.name, avatar: "" }, "Fotka profila"); close(); });
    $$("#s-ucolor .sw", ov).forEach(el => el.addEventListener("click", () => {
      $$("#s-ucolor .sw", ov).forEach(x => x.classList.toggle("on", x === el));
      queue({ action: "updateUser", name: me.name, color: el.dataset.c }, "Boja profila");
    }));
  }
}

// ═══════════════ per-month style sheet ═══════════════
/** A small, clear sheet: live preview on top, then Colour, Symbol (+ which side), Card tint, Fold. */
function openMonthStyle(m) {
  const s = state.settings;
  const name = m ? MONTH_NAMES[m - 1] : "Bez mjeseca";
  const mp = () => (s.months[m] = s.months[m] || {});
  const palette = style().monthColors.filter((c, i, arr) => arr.indexOf(c) === i);
  const cur = () => String(monthColor(m)).toLowerCase();
  const custom = !MONTH_ICONS.includes(mp().icon || "") ? mp().icon : "";
  const ov = document.createElement("div");
  ov.className = "overlay month-sheet";
  ov.innerHTML = `<div class="sheet sheet-sm" role="dialog" aria-label="Izgled mjeseca: ${esc(name)}">
    <div class="sheet-header"><div class="sheet-title">Izgled mjeseca</div><button class="btn btn-ghost btn-icon" data-close aria-label="Zatvori">✕</button></div>
    <div class="month-preview-wrap"><div class="month-head preview" aria-hidden="true"><span class="month-name"><h2></h2></span><span class="month-rule"></span></div>
      <div class="card preview-card" aria-hidden="true"><div class="card-top"><div class="card-main"><div class="artist">Izvođač</div><div class="album-name">Ovako izgledaju kartice: ${esc(name)}</div></div><div class="peek"><span class="score">★ <b>4.5</b></span></div></div></div></div>
    <div class="sheet-body">
      <section class="ms-sec"><div class="fl">Boja</div>
        <div class="swatches" id="m-color">${palette.map(c => `<button class="sw" data-c="${c}" style="background:${c}" aria-label="Boja ${c}"></button>`).join("")}
          <label class="sw sw-custom" title="Bilo koja boja" aria-label="Odaberi bilo koju boju"><input type="color" id="m-custom" value="${esc(/^#/.test(monthColor(m)) ? monthColor(m) : "#888888")}"><span aria-hidden="true">＋</span></label></div>
      </section>
      <section class="ms-sec"><div class="fl">Simbol <small>– stoji s obje strane naziva</small></div>
        <div class="icons" id="m-icon">${MONTH_ICONS.map(ic => `<button data-v="${esc(ic)}" aria-label="${ic ? "Simbol " + ic : "Bez simbola"}">${ic || "∅"}</button>`).join("")}</div>
        <div class="ms-row">
          <input class="fi" id="m-icon-custom" maxlength="12" placeholder="Upiši svoj: 🌧️ ✌︎ ₍ᐢ•ﻌ•ᐢ₎" value="${esc(custom || "")}" aria-label="Upiši svoj simbol">
        </div>
      </section>
      <section class="ms-sec"><label class="fl" for="m-tint">Obojenost kartica</label>
        <div class="ms-range"><small>bez</small><input type="range" class="range" id="m-tint" min="0" max="100" value="${parseInt(monthTint(m))}"><small>puno</small></div>
      </section>
      <section class="ms-sec"><label class="toggle"><input type="checkbox" id="m-hidden" ${mp().hidden ? "checked" : ""}> Sklopi ovaj mjesec <small>(ili dodirni naziv mjeseca)</small></label></section>
    </div>
    <div class="form-actions"><button class="btn btn-ghost" id="m-reset">Vrati zadano</button><button class="btn btn-primary" data-close>Gotovo</button></div>
  </div>`;
  document.body.appendChild(ov);
  const close = () => { ov.classList.add("closing"); setTimeout(() => ov.remove(), 200); };
  $$("[data-close]", ov).forEach(b => b.addEventListener("click", close));
  ov.addEventListener("click", e => { if (e.target === ov) close(); });

  const paint = () => {
    const c = monthColor(m);
    const sheet = $(".sheet", ov);
    [sheet, $(".preview-card", ov)].forEach(el => { el.style.setProperty("--m", c); el.style.setProperty("--tint", monthTint(m)); });
    $(".preview h2", ov).innerHTML = monthTitleHtml(m);
    $$("#m-color .sw[data-c]", ov).forEach(x => x.classList.toggle("on", x.dataset.c.toLowerCase() === cur()));
    $(".sw-custom", ov).classList.toggle("on", !$$("#m-color .sw[data-c]", ov).some(x => x.classList.contains("on")));
    $$("#m-icon button", ov).forEach(x => x.classList.toggle("on", x.dataset.v === (mp().icon || "")));
    $("#m-tint", ov).value = parseInt(monthTint(m));
  };
  const apply = () => { saveSettings(); paint(); state.rendered = new Set(state.view?.albums.map(a => a.key)); renderList(); };
  paint();

  $$("#m-color .sw[data-c]", ov).forEach(b => b.addEventListener("click", () => { mp().color = b.dataset.c; $("#m-custom", ov).value = b.dataset.c; apply(); }));
  $("#m-custom", ov).addEventListener("input", e => { mp().color = e.target.value; apply(); });
  $("#m-tint", ov).addEventListener("input", e => { mp().tint = +e.target.value; apply(); });
  $$("#m-icon button", ov).forEach(b => b.addEventListener("click", () => { mp().icon = b.dataset.v; $("#m-icon-custom", ov).value = ""; apply(); }));
  $("#m-icon-custom", ov).addEventListener("input", e => {
    // short on purpose: at most 3 visible characters (an emoji with skin tone counts as one)
    let v = e.target.value.trim();
    try { v = [...new Intl.Segmenter().segment(v)].slice(0, 3).map(x => x.segment).join(""); } catch (err) { v = [...v].slice(0, 3).join(""); }
    mp().icon = v; apply();
  });
  $("#m-hidden", ov).addEventListener("change", e => { mp().hidden = e.target.checked; apply(); });
  $("#m-reset", ov).addEventListener("click", () => { delete s.months[m]; $("#m-icon-custom", ov).value = ""; $("#m-hidden", ov).checked = false; apply(); });
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
  const saved = localStorage.getItem("muzika_user");
  state.me = saved || null;
  loadSettings(); applyTheme(); loadSeen();
  state.scrollToEnd = true;
  if (state.me) rebuild(); else renderLogin();
  refresh(true).then(() => { if (!state.me) renderLogin(); });
  startPolling();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
