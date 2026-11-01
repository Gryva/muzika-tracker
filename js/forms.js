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
    img.onerror = () => reject(new Error("Couldn't read that image"));
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
    el.innerHTML = `<div class="login-box"><div class="login-title">🎵 Muzika</div><div class="login-sub">${state.loading ? "Loading…" : "Can't reach the Sheet – " + esc(state.lastError)}</div>${state.loading ? `<div class="spinner"></div>` : `<button class="btn btn-primary" id="retry">Try again</button>`}</div>`;
    document.body.appendChild(el);
    $("#retry", el)?.addEventListener("click", () => { state.loading = true; renderLogin(); refresh(true).then(() => renderLogin()); });
    return;
  }
  if (!joining) {
    el.innerHTML = `<div class="login-box">
      <div class="login-title">🎵 Muzika</div>
      <div class="login-sub">Who's listening? <small>(we'll remember you on this device)</small></div>
      <div class="user-grid">
        ${list.map(u => `<button class="user-btn" data-user="${esc(u.name)}">${avatar(u.name, 52)}${esc(u.name)}</button>`).join("")}
        <button class="user-btn new" id="join"><span class="av" style="--sz:52px">＋</span>I'm new</button>
      </div>
      <button class="link-btn" id="guest">👀 Just looking</button>
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
    <div class="login-title">Welcome! 👋</div>
    <div class="login-sub">Pick a name – you'll get your own tab in the Sheet.</div>
    <div class="avatar-pick"><span class="av" id="j-av" style="--uc:${color}" title="Add a photo (optional)">📷</span><small class="hint">Photo is optional – tap to add</small></div>
    <div class="fg"><input class="fi" id="j-name" placeholder="Your name" maxlength="20" required autocomplete="off" style="text-align:center;font-size:17px"></div>
    <div class="fg"><div class="swatches" style="justify-content:center">${USER_COLORS_UI.map(c => `<span class="sw ${c === color ? "on" : ""}" data-c="${c}" style="background:${c}"></span>`).join("")}</div></div>
    <div class="hint warn hide" id="j-err"></div>
    <div style="display:flex;gap:10px;justify-content:center;margin-top:14px">
      <button type="button" class="btn btn-ghost" id="j-back">Back</button>
      <button class="btn btn-primary" id="j-go">Join 🎉</button>
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
    go.disabled = true; go.textContent = "Creating…"; err.classList.add("hide");
    try {
      await apiPost({ action: "addUser", name, avatar: avatarData, color });
      await refresh(true);
      login(name);
      toast(`Welcome, ${name}! 🎉`);
    } catch (ex) {
      err.textContent = isNetworkError(ex) ? "You need to be online to join." : ex.message;
      err.classList.remove("hide"); go.disabled = false; go.textContent = "Join 🎉";
    }
  });
}
const USER_COLORS_UI = ["#ff6b6b", "#4ecdc4", "#ffd166", "#a78bfa", "#f093fb", "#4dabf7", "#69db7c", "#ff922b", "#e599f7", "#63e6be"];

function login(name) {
  state.me = name;
  localStorage.setItem("muzika_user", name);
  $(".login")?.remove();
  loadSettings(); applyTheme(); loadSeen();
  state.tab = "all"; state.rendered = new Set();
  if (state.snap) adoptServerSettings();
  rebuild();
}

// ═══════════════ rating widget ═══════════════
function ratingWidget(container, initial, onChange) {
  const p = parseRating(initial);
  let v = p ? p.v : 0, plus = p ? p.plus : false, raw = initial || "";
  container.innerHTML = `<div class="rate">
    <div class="rate-track" role="slider" aria-label="Rating" tabindex="0">${[0, 1, 2, 3, 4].map(() => `<b>★</b>`).join("")}</div>
    <div class="rate-side">
      <span class="rate-val"></span>
      <button type="button" class="rate-plus" title="Plus – better than the number says">+</button>
      <input class="fi rate-raw" placeholder="custom" title="Or type anything (e.g. 4.5, 5+)">
      <button type="button" class="mini" data-clear title="Clear">✕</button>
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

// ═══════════════ add / edit album ═══════════════
function openEditor(a = null, prefill = {}) {
  if (!canWrite()) return;
  const editing = !!a;
  const src = a || prefill;
  const f = {
    rating: a?.rating || "", recommend: a?.recommend || "",
    cover: a?.cover || "", coverSource: a?.cover ? "keep" : "", lookup: null, coverMode: a?.cover ? "keep" : "auto"
  };
  const ov = document.createElement("div");
  ov.className = "overlay";
  const recOpts = ["Da", "Ne", "Meh"];
  if (f.recommend && !recOpts.includes(f.recommend)) recOpts.push(f.recommend);
  ov.innerHTML = `<form class="sheet" autocomplete="off">
    <div class="sheet-header"><div class="sheet-title">${editing ? "✏️ Edit album" : "＋ New album"}</div><button type="button" class="btn btn-ghost btn-icon" data-close>✕</button></div>
    <div class="sheet-body">
      <div class="row2">
        <div class="fg"><label class="fl">Artist</label><input class="fi" id="f-artist" value="${esc(src.artist || "")}" placeholder="e.g. Pink Floyd" required></div>
        <div class="fg"><label class="fl">Album</label><input class="fi" id="f-album" value="${esc(src.album || "")}" placeholder="e.g. Animals" required></div>
      </div>
      <div class="hint hide" id="f-also"></div>
      <div class="fg">
        <label class="fl">Cover <small>– found automatically, or upload your own</small></label>
        <div class="cover-pick">
          <div class="cover" id="f-cover" style="--m:${monthColor(a?.month)}" data-ini="?"></div>
          <div class="cover-btns">
            <button type="button" class="mini" id="f-upload">📷 Upload my own</button>
            <button type="button" class="mini" id="f-find">🔍 Find automatically</button>
            <button type="button" class="mini danger" id="f-nocover">✕ No cover</button>
            <span class="hint" id="f-cover-hint"></span>
          </div>
        </div>
      </div>
      <div class="fg"><label class="fl">Rating <small>– tap or drag the stars, + for "even better"</small></label><div id="f-rating"></div></div>
      <div class="fg"><label class="fl">Recommend?</label><div class="choice" id="f-rec">${recOpts.map(o => `<button type="button" data-v="${esc(o)}" class="${f.recommend === o ? "on" : ""}">${o === "Da" ? "✅ Da" : o === "Ne" ? "❌ Ne" : o === "Meh" ? "🤷 Meh" : esc(o)}</button>`).join("")}</div></div>
      <div class="row3">
        <div class="fg"><label class="fl">Year</label><input class="fi" id="f-year" value="${esc(a?.year || "")}" placeholder="1977" inputmode="numeric"></div>
        <div class="fg"><label class="fl">Listened</label><input type="date" class="fi" id="f-date" value="${editing ? isoDate(a.listenedDate) : todayIso()}"></div>
        <div class="fg"><label class="fl">Duration</label><input class="fi" id="f-duration" value="${esc(a?.duration || "")}" placeholder="42 min"></div>
      </div>
      <div class="fg"><label class="fl">Genre</label><input class="fi" id="f-genre" value="${esc(a?.genre || "")}" placeholder="Progressive rock"></div>
      <div class="fg"><label class="fl">Impression</label><textarea class="ft" id="f-impression" placeholder="How did it make you feel?">${esc(a?.impression || "")}</textarea></div>
      <div class="fg"><label class="fl">Standout tracks</label><input class="fi" id="f-tracks" value="${esc(a?.standoutTracks || "")}" placeholder="Dogs, Pigs, Sheep"></div>
      <div class="fg"><label class="fl">Note <small>– goes in the comment column of your Sheet</small></label><input class="fi" id="f-comments" value="${esc(a?.comments || "")}" placeholder="Anything else?"></div>
      <div class="row2">
        <div class="fg"><label class="fl">Spotify link <small>(auto)</small></label><input class="fi" id="f-spotify" value="${esc(a?.spotify || "")}" placeholder="https://open.spotify.com/album/…" inputmode="url"></div>
        <div class="fg"><label class="fl">YouTube link <small>(auto)</small></label><input class="fi" id="f-youtube" value="${esc(a?.youtube || "")}" placeholder="https://youtube.com/…" inputmode="url"></div>
      </div>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" id="f-save">${editing ? "Save" : "Add album"}</button>
    </div>
  </form>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  $$("[data-close]", ov).forEach(b => b.addEventListener("click", close));
  ov.addEventListener("click", e => { if (e.target === ov) close(); });

  ratingWidget($("#f-rating", ov), f.rating, v => f.rating = v);
  $$("#f-rec button", ov).forEach(b => b.addEventListener("click", () => {
    f.recommend = f.recommend === b.dataset.v ? "" : b.dataset.v;
    $$("#f-rec button", ov).forEach(x => x.classList.toggle("on", x.dataset.v === f.recommend));
  }));

  const artistI = $("#f-artist", ov), albumI = $("#f-album", ov), spotifyI = $("#f-spotify", ov);
  const coverEl = $("#f-cover", ov), hint = $("#f-cover-hint", ov);
  const paintCover = () => {
    coverEl.dataset.ini = ((artistI.value || "?")[0] + (albumI.value || "")[0] || "").toUpperCase();
    coverEl.innerHTML = f.cover ? `<img class="ok" src="${esc(f.cover)}" referrerpolicy="no-referrer" alt="">` : "";
  };
  paintCover();

  // "others listened to this too" + duplicate warning
  const checkAlso = () => {
    const nk = normKey(artistI.value, albumI.value), el = $("#f-also", ov);
    const owners = [...(D.byNk.get(nk) || [])].filter(o => !a || o !== a.owner);
    const dupe = !editing && owners.includes(state.me);
    const others = owners.filter(o => o !== state.me);
    el.classList.toggle("hide", !albumI.value || (!others.length && !dupe));
    el.className = "hint " + (dupe ? "warn" : "ok") + (!albumI.value || (!others.length && !dupe) ? " hide" : "");
    el.innerHTML = dupe ? "⚠️ You already logged this album." : others.length ? `✨ ${others.map(esc).join(", ")} listened to this too!` : "";
  };

  let lookupSeq = 0;
  const lookup = async (manual) => {
    const artist = artistI.value.trim(), album = albumI.value.trim();
    if (!artist || !album) { if (manual) toast("Type artist and album first"); return; }
    if (!manual && f.coverMode !== "auto") return;
    const seq = ++lookupSeq;
    hint.textContent = "Searching…"; hint.className = "hint";
    try {
      const r = (await apiPost({ action: "lookup", artist, album, spotify: spotifyI.value.trim() })).result;
      if (seq !== lookupSeq) return;
      f.lookup = r;
      if (r?.cover) { f.cover = r.cover; f.coverSource = r.source; f.coverMode = "auto"; paintCover(); }
      if (r?.year && !$("#f-year", ov).value) $("#f-year", ov).value = r.year;
      if (r?.genre && !$("#f-genre", ov).value) $("#f-genre", ov).value = r.genre;
      // fill the link fields, but never overwrite a link the user typed themselves
      const ytI = $("#f-youtube", ov);
      if (!spotifyI.value || spotifyI.value === f.autoSp) spotifyI.value = f.autoSp = r?.spotify || "";
      if (!ytI.value || ytI.value === f.autoYt) ytI.value = f.autoYt = r?.youtube || "";
      const lk = [r?.spotify && "Spotify", r?.youtube && "YouTube"].filter(Boolean);
      hint.textContent = (r?.cover ? `Found via ${r.source === "itunes" ? "Apple Music" : r.source === "deezer" ? "Deezer" : "Spotify"} ✓` : "No cover found – upload one?") + (lk.length ? ` · ${lk.join(" + ")} link${lk.length > 1 ? "s" : ""} ✓` : "");
      hint.className = "hint " + (r?.cover ? "ok" : "warn");
    } catch (e) {
      if (seq === lookupSeq) { hint.textContent = isNetworkError(e) ? "Offline – will look it up when synced" : e.message; hint.className = "hint warn"; }
    }
  };
  let lt;
  const onNameChange = () => { checkAlso(); paintCover(); clearTimeout(lt); lt = setTimeout(() => lookup(false), 700); };
  artistI.addEventListener("input", onNameChange);
  albumI.addEventListener("input", onNameChange);
  spotifyI.addEventListener("change", () => { if (spotifyI.value.includes("open.spotify.com")) { f.coverMode = "auto"; lookup(true); } });
  $("#f-find", ov).addEventListener("click", () => { f.coverMode = "auto"; lookup(true); });
  $("#f-nocover", ov).addEventListener("click", () => { f.cover = ""; f.coverMode = "none"; f.lookup = null; paintCover(); hint.textContent = "No cover"; hint.className = "hint"; });
  $("#f-upload", ov).addEventListener("click", async () => {
    const file = await pickFile(); if (!file) return;
    hint.textContent = "Uploading…"; hint.className = "hint";
    try {
      const data = await resizeImage(file, 600, false);
      f.cover = data; paintCover();
      const r = await apiPost({ action: "uploadImage", dataUrl: data, name: `${artistI.value}-${albumI.value}` });
      f.cover = r.url; f.coverSource = "user"; f.coverMode = "custom"; paintCover();
      hint.textContent = "Your cover ✓"; hint.className = "hint ok";
    } catch (e) {
      f.cover = a?.cover || ""; paintCover();
      hint.textContent = isNetworkError(e) ? "Uploading needs internet" : e.message; hint.className = "hint warn";
    }
  });
  if (prefill.artist && !editing) { checkAlso(); lookup(false); }
  if (editing) checkAlso();

  ov.querySelector("form").addEventListener("submit", e => {
    e.preventDefault();
    if (f.cover.startsWith("data:")) return toast("Wait for the upload to finish…");
    const val = id => $(id, ov).value.trim();
    const data = {
      artist: val("#f-artist"), album: val("#f-album"), year: val("#f-year"), genre: val("#f-genre"),
      duration: val("#f-duration"), listenedDate: $("#f-date", ov).value || "", rating: f.rating,
      impression: val("#f-impression"), standoutTracks: val("#f-tracks"), recommend: f.recommend,
      comments: val("#f-comments"), spotify: val("#f-spotify"), youtube: val("#f-youtube")
    };
    if (!data.artist || !data.album) return toast("Artist and album are required");
    if (editing) {
      if (f.coverMode !== "keep") { data.cover = f.cover; data.coverSource = f.coverSource; }
      if (f.lookup?.apple && !a.apple) data.apple = f.lookup.apple;
      if (f.lookup?.deezer && !a.deezer) data.deezer = f.lookup.deezer;
      if (String(a.id).startsWith("tmp_")) {
        const op = state.outbox.find(o => !o.done && o.payload.action === "add" && "tmp_" + o.payload.clientId === a.id);
        if (op) { Object.assign(op.payload, data); saveOutbox(); rebuild(); close(); return; }
        return toast("Still syncing – try again in a moment");
      }
      queue({ action: "update", id: a.id, owner: a.owner, expectArtist: a.artist, expectAlbum: a.album, ...data }, "Edit");
      toast("Saved ✏️");
    } else {
      Object.assign(data, { owner: state.me, clientId: uid(), ts: Date.now() });
      if (f.cover) { data.cover = f.cover; data.coverSource = f.coverSource; }
      if (f.coverMode === "none") data.lookup = false;
      if (f.lookup?.apple) data.apple = f.lookup.apple;
      if (f.lookup?.deezer) data.deezer = f.lookup.deezer;
      queue({ action: "add", ...data }, "Add album");
      const others = [...(D.byNk.get(normKey(data.artist, data.album)) || [])].filter(o => o !== state.me);
      toast(others.length ? `Added 🎉 ✨ ${others.join(", ")} heard it too!` : "Added 🎉", 3500);
    }
    close();
  });
  setTimeout(() => (editing ? null : artistI.value ? $("#f-impression", ov) : artistI)?.focus(), 50);
}

// ═══════════════ settings ═══════════════
function openSettings(section) {
  const s = state.settings;
  const me = canWrite() ? userByName(state.me) : null;
  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML = `<div class="sheet">
    <div class="sheet-header"><div class="sheet-title">⚙️ Make it yours</div><button class="btn btn-ghost btn-icon" data-close>✕</button></div>
    <div class="sheet-body">
      ${me ? `<div class="section-title" id="sec-profile">👤 Profile</div>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:6px">
        <span id="s-av" style="cursor:pointer" title="Change photo">${avatar(me.name, 64)}</span>
        <div style="flex:1"><div style="font-weight:800;font-size:17px">${esc(me.name)}</div>
          <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap"><button class="mini" id="s-photo">📷 Change photo</button>${me.avatar ? `<button class="mini danger" id="s-nophoto">Remove photo</button>` : ""}</div></div>
      </div>
      <div class="swatches" id="s-ucolor">${USER_COLORS_UI.map(c => `<span class="sw ${c === me.color ? "on" : ""}" data-c="${c}" style="background:${c};width:26px;height:26px"></span>`).join("")}</div>` : ""}

      <div class="section-title">🎨 Accent colour</div>
      <div class="swatches" id="s-accent">${Object.values(THEMES).map(c => `<span class="sw ${c === s.accent ? "on" : ""}" data-c="${c}" style="background:${c}"></span>`).join("")}
        <input type="color" class="sw-input" id="s-accent-custom" value="${esc(s.accent)}" title="Custom colour"></div>

      <div class="section-title">🗓️ Month colours <button class="mini" id="s-mreset">Reset</button></div>
      <div class="months">${MONTH_NAMES.map((m, i) => `<label class="month-sw"><input type="color" data-m="${i}" value="${esc(s.monthColors[i])}">${m.slice(0, 3)}</label>`).join("")}</div>
      <div class="fg" style="margin-top:12px"><label class="fl">Card tint <small id="s-tint-v">${s.tint}%</small></label><input type="range" class="range" id="s-tint" min="0" max="45" value="${s.tint}"></div>

      <div class="section-title">✨ Floating background</div>
      <div class="choice" id="s-bgset">
        <button data-v="off" class="${!s.bg.on ? "on" : ""}">Off</button>
        ${Object.keys(BG_SETS).map(k => `<button data-v="${k}" class="${s.bg.on && s.bg.set === k ? "on" : ""}">${BG_SETS[k].slice(0, 3).join(" ")}</button>`).join("")}
      </div>
      <div class="row2" style="margin-top:12px">
        <div class="fg"><label class="fl">Amount</label><input type="range" class="range" id="s-density" min="4" max="50" value="${s.bg.density}"></div>
        <div class="fg"><label class="fl">Speed</label><input type="range" class="range" id="s-speed" min="0.3" max="2.5" step="0.1" value="${s.bg.speed}"></div>
      </div>
      <div class="row2">
        <div class="fg"><label class="fl">Visibility</label><input type="range" class="range" id="s-opacity" min="0.3" max="3" step="0.1" value="${s.bg.opacity}"></div>
        <div class="fg"><label class="fl">Colours</label><div class="choice" id="s-bgcolor">${[["months", "Months"], ["accent", "Accent"], ["white", "White"]].map(([k, l]) => `<button data-v="${k}" class="${s.bg.color === k ? "on" : ""}">${l}</button>`).join("")}</div></div>
      </div>

      <div class="section-title">🔤 Look</div>
      <div class="choice" id="s-font">${Object.keys(FONTS).map(k => `<button data-v="${k}" class="${s.font === k ? "on" : ""}" style="font-family:${FONTS[k]}">${k}</button>`).join("")}</div>
      <div class="choice" id="s-view" style="margin-top:8px">${[["card", "📋 Cards"], ["compact", "⚡ Compact"]].map(([k, l]) => `<button data-v="${k}" class="${s.view === k ? "on" : ""}">${l}</button>`).join("")}</div>

      <div class="section-title">🛟 Safety</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${state.snap?.sheetUrl ? `<a class="btn btn-ghost btn-sm" href="${esc(state.snap.sheetUrl)}" target="_blank" rel="noopener">📊 Open Google Sheet</a>` : ""}
        <button class="btn btn-ghost btn-sm" id="s-backup">💾 Download backup</button>
        <button class="btn btn-ghost btn-sm" id="s-sync">🔄 Sync now</button>
      </div>
      <div class="hint">${state.outbox.filter(o => !o.done).length ? `⏳ ${state.outbox.filter(o => !o.done).length} change(s) saved on this device, waiting to sync.` : "✓ Everything is synced."} The app keeps a copy of all data on this device, so it works offline too.</div>

      <div class="section-title">🚪 Account</div>
      <button class="btn btn-ghost" style="width:100%" id="s-switch">Switch user</button>
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

  $$("#s-accent .sw", ov).forEach(el => el.addEventListener("click", () => {
    $$("#s-accent .sw", ov).forEach(x => x.classList.toggle("on", x === el)); s.accent = el.dataset.c; saveSettings();
  }));
  $("#s-accent-custom", ov).addEventListener("input", e => { s.accent = e.target.value; $$("#s-accent .sw", ov).forEach(x => x.classList.remove("on")); saveSettings(); });
  $$("[data-m]", ov).forEach(i => i.addEventListener("input", () => { s.monthColors[+i.dataset.m] = i.value; rerender(); }));
  $("#s-mreset", ov).addEventListener("click", () => { s.monthColors = DEFAULT_MONTH_COLORS.slice(); $$("[data-m]", ov).forEach(i => i.value = s.monthColors[+i.dataset.m]); rerender(); });
  $("#s-tint", ov).addEventListener("input", e => { s.tint = +e.target.value; $("#s-tint-v", ov).textContent = s.tint + "%"; saveSettings(); });
  choice("#s-bgset", v => { if (v === "off") s.bg.on = false; else { s.bg.on = true; s.bg.set = v; } saveSettings(); });
  choice("#s-bgcolor", v => { s.bg.color = v; saveSettings(); });
  ["density", "speed", "opacity"].forEach(k => $("#s-" + k, ov).addEventListener("change", e => { s.bg[k] = +e.target.value; s.bg.on = true; saveSettings(); }));
  choice("#s-font", v => { s.font = v; saveSettings(); });
  choice("#s-view", v => { s.view = v; rerender(); });

  $("#s-backup", ov).addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), data: state.view, pending: state.outbox }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = `muzika-backup-${todayIso()}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  });
  $("#s-sync", ov).addEventListener("click", () => { flush(); refresh(true); toast("Syncing…"); });
  $("#s-switch", ov).addEventListener("click", () => { close(); state.me = null; localStorage.removeItem("muzika_user"); renderLogin(); });

  if (me) {
    const setPhoto = async () => {
      const f = await pickFile(); if (!f) return;
      try {
        const data = await resizeImage(f, 160, true);
        queue({ action: "updateUser", name: me.name, avatar: data }, "Profile photo");
        close(); toast("Looking good 😎");
      } catch (e) { toast(e.message); }
    };
    $("#s-av", ov).addEventListener("click", setPhoto);
    $("#s-photo", ov).addEventListener("click", setPhoto);
    $("#s-nophoto", ov)?.addEventListener("click", () => { queue({ action: "updateUser", name: me.name, avatar: "" }, "Profile photo"); close(); });
    $$("#s-ucolor .sw", ov).forEach(el => el.addEventListener("click", () => {
      $$("#s-ucolor .sw", ov).forEach(x => x.classList.toggle("on", x === el));
      queue({ action: "updateUser", name: me.name, color: el.dataset.c }, "Profile colour");
    }));
  }
}

// ═══════════════ floating background ═══════════════
let bgSig = "";
function renderBg() {
  const el = $("#bg"), b = state.settings.bg;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sig = JSON.stringify([b, state.settings.accent, state.settings.monthColors, reduce]);
  if (sig === bgSig) return;
  bgSig = sig;
  if (!b.on || reduce) { el.innerHTML = ""; return; }
  const syms = BG_SETS[b.set] || BG_SETS.notes;
  const colors = b.color === "accent" ? [state.settings.accent] : b.color === "white" ? ["#ffffff"] : state.settings.monthColors;
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
  if (state.me) rebuild(); else renderLogin();
  refresh(true).then(() => { if (!state.me) renderLogin(); });
  startPolling();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
