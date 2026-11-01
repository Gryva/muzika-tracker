/* Muzika Tracker – rendering: header, tabs, album cards, listen list, notifications, login */

const ICONS = {
  spotify: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm5.5 17.3a.75.75 0 0 1-1 .25c-2.85-1.74-6.45-2.14-10.68-1.17a.75.75 0 1 1-.33-1.46c4.63-1.06 8.6-.6 11.77 1.34.36.22.47.68.25 1.04zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.26-2-8.23-2.59-12.08-1.42a.94.94 0 0 1-.55-1.8c4.4-1.33 9.87-.68 13.6 1.62.44.27.58.85.32 1.29zm.13-3.4C15.2 8.3 8.78 8.1 5.06 9.22a1.13 1.13 0 1 1-.65-2.16c4.27-1.3 11.37-1.05 15.85 1.6a1.13 1.13 0 0 1-1.16 1.95z"/></svg>`,
  youtube: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg>`
};

// ═══════════════ small components ═══════════════
function avatar(name, size) {
  const u = userByName(name);
  const st = `${size ? `--sz:${size}px;` : ""}--uc:${esc(u?.color || "#555")}`;
  if (u?.avatar) return `<span class="av" style="${st}" title="${esc(name)}"><img src="${esc(u.avatar)}" alt=""></span>`;
  return `<span class="av" style="${st}" title="${esc(name)}">${esc((name || "?").slice(0, 1).toUpperCase())}</span>`;
}
function starsHtml(v) {
  let h = "";
  for (let i = 0; i < 5; i++) h += `<b style="--f:${Math.round(Math.max(0, Math.min(1, v - i)) * 100)}%">★</b>`;
  return `<span class="stars">${h}</span>`;
}
function ratingHtml(r) {
  const p = parseRating(r);
  if (!p) return r ? `<span class="chip">★ ${esc(r)}</span>` : "";
  return `${starsHtml(p.v)}<span class="rating-num">${esc(fmtRating(p.v, p.plus))}</span>`;
}
function recHtml(r) {
  if (!r) return "";
  const s = norm(r);
  const [cls, ic] = /^(da|yes|ja)/.test(s) ? ["rec-yes", "✅"] : /^(ne|no)\b/.test(s) ? ["rec-no", "❌"] : ["rec-meh", "🤷"];
  return `<span class="rec ${cls}">${ic} ${esc(r)}</span>`;
}
function coverHtml(a, cls = "") {
  const ini = ((a.artist || "?").slice(0, 1) + (a.album || "").slice(0, 1)).toUpperCase();
  return `<div class="cover ${cls}" data-ini="${esc(ini)}">${a.cover ? `<img src="${esc(a.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer" onload="this.classList.add('ok')" onerror="this.remove()">` : ""}</div>`;
}
function linksHtml(a) {
  const q = encodeURIComponent(`${a.artist} ${a.album}`);
  const L = [];
  L.push(`<a class="link sp ${a.spotify ? "" : "search"}" target="_blank" rel="noopener" href="${esc(a.spotify || "https://open.spotify.com/search/" + q)}" title="${a.spotify ? "Open on Spotify" : "Search on Spotify"}">${ICONS.spotify}Spotify</a>`);
  L.push(`<a class="link yt ${a.youtube ? "" : "search"}" target="_blank" rel="noopener" href="${esc(a.youtube || "https://www.youtube.com/results?search_query=" + q + "+full+album")}" title="${a.youtube ? "Open on YouTube" : "Search on YouTube"}">${ICONS.youtube}YouTube</a>`);
  if (a.apple) L.push(`<a class="link am" target="_blank" rel="noopener" href="${esc(a.apple)}"> Music</a>`);
  if (a.deezer) L.push(`<a class="link dz" target="_blank" rel="noopener" href="${esc(a.deezer)}">Deezer</a>`);
  return `<div class="links">${L.join("")}</div>`;
}

// ═══════════════ header + tabs ═══════════════
function renderHeader() {
  const h = $("#header");
  const n = state.notifs.length;
  h.innerHTML = `
    <div class="header-inner">
      <div class="logo">Muzika</div>
      <span class="sync" id="sync"></span>
      <div class="spacer"></div>
      ${canWrite() ? `<button class="btn btn-ghost btn-icon" id="btn-bell" title="Activity" aria-label="Activity${n ? ` (${n} new)` : ""}">🔔${n ? `<span class="badge">${n > 99 ? "99+" : n}</span>` : ""}</button>` : ""}
      ${canWrite() ? `<button class="btn btn-ghost btn-icon btn-me" id="btn-settings" title="Settings & profile" aria-label="Settings and profile">${avatar(state.me, 34)}</button>`
        : `<button class="btn btn-ghost btn-icon" id="btn-settings" title="Settings" aria-label="Settings">⚙️</button><button class="btn btn-ghost btn-sm" id="btn-login">Log in</button>`}
    </div>`;
  setSync();
  $("#btn-settings").addEventListener("click", () => openSettings());
  $("#btn-login")?.addEventListener("click", () => { state.me = null; renderLogin(); });
  $("#btn-bell")?.addEventListener("click", togglePanel);
  if (n > (renderHeader._last || 0) && renderHeader._last !== undefined) $("#btn-bell")?.classList.add("wiggle");
  renderHeader._last = n;
  renderFab();
}

/** The one big button: bottom-right, where the thumb already is. */
function renderFab() {
  let f = $("#fab");
  if (!canWrite()) { f?.remove(); return; }
  if (!f) {
    f = document.createElement("button");
    f.id = "fab"; f.className = "fab"; f.setAttribute("aria-label", "Add album"); f.title = "Add album";
    f.innerHTML = `<span aria-hidden="true">＋</span>`;
    f.addEventListener("click", () => openEditor());
    document.body.appendChild(f);
  }
}

/** Whose table you're looking at: one pill that folds open into everyone + the listen list. */
function renderTabs() {
  const t = $("#tabs");
  const v = state.view;
  if (!v) { t.innerHTML = ""; return; }
  const order = users().map(u => u.name);
  if (canWrite()) order.sort((a, b) => (b === state.me) - (a === state.me));
  if (state.tab !== "listen" && !order.includes(state.tab)) state.tab = canWrite() ? state.me : order[0];
  const count = n => v.albums.filter(a => a.owner === n).length;
  const hasNew = n => v.albums.some(a => a.owner === n && isNew(a));
  const listenNew = canWrite() && v.listen.some(l => l.forUser === state.me && l.addedBy !== state.me && l.ts > listenSeen());
  const anyNew = order.some(n => n !== state.tab && hasNew(n)) || (state.tab !== "listen" && listenNew);
  const cur = state.tab;
  const mineAlbums = cur === "listen" ? [] : v.albums.filter(a => a.owner === cur);
  const rated = mineAlbums.map(a => parseRating(a.rating)?.v).filter(Boolean);
  const stats = cur === "listen" ? "" : `${mineAlbums.length} album${mineAlbums.length === 1 ? "" : "a"}${rated.length ? ` · ★ ${(rated.reduce((s, x) => s + x, 0) / rated.length).toFixed(1)}` : ""}`;
  const label = cur === "listen" ? `<span class="who-ic" aria-hidden="true">🎧</span>Listen list`
    : `${avatar(cur, 26)}${isMe(cur) ? "My table" : esc(cur)}`;
  t.innerHTML = `
    <div class="who">
      <button class="who-btn" id="who-btn" aria-expanded="${!!state.whoOpen}" aria-controls="who-menu">
        ${label}${anyNew ? `<i class="dot" aria-label="New activity"></i>` : ""}<span class="chev" aria-hidden="true"></span>
      </button>
      <span class="who-stats">${stats}</span>
    </div>
    <div class="who-menu ${state.whoOpen ? "open" : ""}" id="who-menu" ${state.whoOpen ? "" : "hidden"}>
      ${order.map(n => `<button class="who-item ${cur === n ? "active" : ""}" data-tab="${esc(n)}">${avatar(n, 30)}<span>${isMe(n) ? "Me" : esc(n)}</span><small>${count(n)}</small>${hasNew(n) && cur !== n ? `<i class="dot"></i>` : ""}</button>`).join("")}
      <button class="who-item ${cur === "listen" ? "active" : ""}" data-tab="listen"><span class="av who-ll" style="--sz:30px">🎧</span><span>Listen list</span>${listenNew ? `<i class="dot"></i>` : ""}</button>
    </div>`;
  $("#who-btn", t).addEventListener("click", e => { e.stopPropagation(); state.whoOpen = !state.whoOpen; renderTabs(); if (state.whoOpen) $(".who-item.active", t)?.focus(); });
  $$(".who-item", t).forEach(b => b.addEventListener("click", e => {
    e.stopPropagation();
    state.tab = b.dataset.tab; state.pickerFor = null; state.whoOpen = false;
    renderTabs(); renderMain(); window.scrollTo({ top: 0, behavior: "smooth" });
  }));
}

// ═══════════════ main list ═══════════════
function sortAlbums(list) {
  return list.sort((a, b) =>
    (b.month || 0) - (a.month || 0) ||
    isoDate(b.listenedDate).localeCompare(isoDate(a.listenedDate)) ||
    (b.created || 0) - (a.created || 0) ||
    (b.row || 0) - (a.row || 0));
}

function renderMain() {
  const main = $("#main");
  if (state.tab === "listen") return renderListen(main);
  const v = state.view;
  if (!v) {
    main.innerHTML = state.loading ? `<div class="spinner"></div>` :
      `<div class="empty"><div class="empty-icon">🔗</div>Can't reach the Google Sheet.<br><small>${esc(state.lastError)}</small></div>`;
    return;
  }
  // keep focus + text in a comment box across re-renders
  const act = document.activeElement;
  const focusKey = act?.dataset?.cmt, sel = act?.selectionStart;
  const drafts = {};
  $$("input[data-cmt]", main).forEach(i => { if (i.value) drafts[i.dataset.cmt] = i.value; });
  if (!$("#list")) main.innerHTML = `<div id="list"></div>`;
  renderList();
  Object.entries(drafts).forEach(([k, val]) => { const i = $(`input[data-cmt="${CSS.escape(k)}"]`); if (i) i.value = val; });
  if (focusKey) { const i = $(`input[data-cmt="${CSS.escape(focusKey)}"]`); if (i) { i.focus(); try { i.setSelectionRange(sel, sel); } catch (e) {} } }

  if (state.tab !== state.me) {
    const owner = state.tab;
    clearTimeout(renderMain._seenT);
    renderMain._seenT = setTimeout(() => { if (state.tab === owner && markOwnerSeen(owner)) { state.notifs = computeNotifs(); renderHeader(); renderTabs(); } }, 1500);
  }
}

function renderList() {
  const v = state.view, list = $("#list");
  if (!list) return;
  const albums = sortAlbums(v.albums.filter(a => a.owner === state.tab));

  if (!albums.length) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">🎧</div>${canWrite() && state.tab === state.me ? "Nothing yet – tap ＋ to add your first album" : "No albums yet"}</div>`;
    return;
  }
  let html = "", month = -1, i = 0;
  const counts = {};
  albums.forEach(a => counts[a.month || 0] = (counts[a.month || 0] || 0) + 1);
  for (const a of albums) {
    if ((a.month || 0) !== month) {
      if (month !== -1) html += `</div></section>`;
      month = a.month || 0;
      const mp = monthPref(month), name = month ? MONTH_NAMES[month - 1] : "Bez mjeseca";
      html += `<section class="month ${mp.hidden ? "folded" : ""}" style="--m:${monthColor(month)};--tint:${monthTint(month)}" data-month="${month}">
        <header class="month-head">
          <span class="month-num" aria-hidden="true">${month ? String(month).padStart(2, "0") : "—"}</span>
          <button class="month-name" data-act="fold-month" aria-expanded="${!mp.hidden}" title="${mp.hidden ? "Show" : "Hide"} ${name}"><h2>${mp.icon ? `<span class="month-icon">${esc(mp.icon)}</span>` : ""}${name}</h2></button>
          <span class="month-count">${counts[month]} ${counts[month] === 1 ? "album" : "albuma"}</span>
          <button class="month-gear" data-act="month-style" aria-label="Style ${name}" title="Style ${name}">⚙︎</button>
        </header><div class="album-list">`;
    }
    if (!monthPref(month).hidden) html += cardHtml(a, i++);
  }
  list.innerHTML = html + `</div></section>`;
  albums.forEach(a => state.rendered.add(a.key));
}

const cardOpen = a => state.settings.cards === "open" ? !state.openCards.has(a.key) : state.openCards.has(a.key);

function cardHtml(a, i) {
  const mine = isMe(a.owner);
  const fresh = !state.rendered.has(a.key);
  const also = alsoListened(a);
  const cmts = D.comments.get(a.key) || [];
  const rx = D.reactions.get(a.key) || [];
  const open = state.openThreads.has(a.key);
  const expanded = cardOpen(a) || open;
  const grouped = {};
  rx.forEach(r => (grouped[r.emoji] = grouped[r.emoji] || []).push(r.user));
  const rxSummary = Object.keys(grouped).slice(0, 3).join("");

  return `
  <article class="card ${fresh ? "enter fade-in" : ""} ${a.pending ? "pending" : ""} ${expanded ? "open" : ""}" data-key="${esc(a.key)}" style="--m:${monthColor(a.month)};--tint:${monthTint(a.month)};--i:${Math.min(i, 12)}">
    <div class="card-top" data-act="toggle-card" role="button" tabindex="0" aria-expanded="${expanded}" aria-label="${esc(a.artist)} – ${esc(a.album)}, ${expanded ? "collapse" : "expand"}">
      ${coverHtml(a, "photo")}
      <div class="card-main">
        <div class="artist">${esc(a.artist)}</div>
        <div class="album-name">${esc(a.album)}</div>
        <div class="meta">
          ${ratingHtml(a.rating)}
          ${isNew(a) ? `<span class="new-pill tag">NEW</span>` : ""}
          ${a.pending ? `<span class="pending-pill" title="Saved on this device, waiting to sync">⏳ syncing</span>` : ""}
        </div>
      </div>
      <div class="peek">
        <span class="peek-row">${also.length ? `<span class="av-stack" title="Also heard by ${esc(also.join(", "))}">${also.map(o => avatar(o, 16)).join("")}</span>` : ""}${rxSummary ? `<span class="peek-rx">${rxSummary}</span>` : ""}${cmts.length ? `<span class="peek-c">💬${cmts.length}</span>` : ""}</span>
        <span class="chev" aria-hidden="true"></span>
      </div>
    </div>
    ${expanded ? `<div class="card-more">
    <div class="meta">
      ${a.year ? `<span class="chip">${esc(String(a.year).replace(/\.$/, ""))}</span>` : ""}
      ${a.genre ? `<span class="chip">${esc(a.genre)}</span>` : ""}
      ${a.duration ? `<span class="chip">⏱ ${esc(a.duration)}</span>` : ""}
      ${a.listenedDate ? `<span class="chip">📅 ${esc(fmtDate(a.listenedDate))}</span>` : ""}
    </div>
    ${(a.impression || a.standoutTracks || a.recommend || a.comments) ? `<div class="body">
      ${a.impression ? `<div class="impression">“${esc(a.impression)}”</div>` : ""}
      ${a.standoutTracks && a.standoutTracks !== "-" ? `<div class="tracks"><b>🎵</b> ${esc(a.standoutTracks)}</div>` : ""}
      ${recHtml(a.recommend)}
      ${a.comments ? `<div class="note">📝 ${esc(a.comments)}</div>` : ""}
    </div>` : ""}
    ${linksHtml(a)}
    <div class="owner-line">${avatar(a.owner, 18)} ${esc(a.owner)}
      ${also.length ? `<span class="also" title="Also in ${esc(also.join(", "))}'s table">also heard by <span class="av-stack">${also.map(o => avatar(o, 18)).join("")}</span></span>` : ""}
    </div>
    <div class="social">
      ${Object.entries(grouped).map(([e, us]) => `<button class="rx ${canWrite() && us.includes(state.me) ? "mine" : ""}" data-act="react" data-emoji="${e}" title="${esc(us.join(", "))}">${e}<small>${us.length}</small></button>`).join("")}
      ${canWrite() ? (state.pickerFor === a.key
        ? `<span class="rx-picker">${REACTIONS.map(e => `<button data-act="react" data-emoji="${e}">${e}</button>`).join("")}</span>`
        : `<button class="rx" data-act="picker" title="React" aria-label="Add reaction">☺︎<small>+</small></button>`) : ""}
      <button class="rx" data-act="thread" title="Comments" aria-label="Comments (${cmts.length})">💬<small>${cmts.length || ""}</small></button>
      <span class="grow"></span>
      <span class="actions">
        ${canWrite() && !mine ? `<button class="mini" data-act="listen-me" title="Add to my listen list">＋ 🎧</button>` : ""}
        ${mine ? `<button class="mini" data-act="edit">✏️ Edit</button><button class="mini danger" data-act="delete" title="Delete" aria-label="Delete album">🗑️</button>` : ""}
      </span>
    </div>
    ${open ? threadHtml(a, cmts) : ""}
    </div>` : ""}
  </article>`;
}

function threadHtml(a, cmts) {
  return `<div class="thread">
    ${cmts.map(c => `<div class="cmt">${avatar(c.author, 26)}<div class="cmt-body">
        <div class="cmt-head"><b>${esc(c.author)}</b><span>${c.pending ? "⏳" : timeAgo(c.ts)}</span>
          ${isMe(c.author) ? `<button class="cmt-del" data-act="uncomment" data-id="${esc(c.id)}" title="Delete">✕</button>` : ""}</div>
        <div class="cmt-text">${esc(c.text)}</div></div></div>`).join("")}
    ${!cmts.length ? `<div class="hint">No comments yet${canWrite() ? " – say something nice 💬" : ""}</div>` : ""}
    ${canWrite() ? `<div class="cmt-form">${avatar(state.me, 26)}<input data-cmt="${esc(a.key)}" placeholder="Write a comment…" maxlength="1000" enterkeyhint="send"><button class="btn btn-primary btn-sm" data-act="send">Send</button></div>` : ""}
  </div>`;
}

// ═══════════════ card actions (event delegation) ═══════════════
document.addEventListener("click", e => {
  const btn = e.target.closest("[data-act]");
  if (!btn) {
    if (state.pickerFor && !e.target.closest(".rx-picker")) { state.pickerFor = null; renderList(); }
    if (state.panelOpen && !e.target.closest(".panel") && !e.target.closest("#btn-bell")) closePanel();
    if (state.whoOpen && !e.target.closest(".tabs")) { state.whoOpen = false; renderTabs(); }
    return;
  }
  const card = btn.closest(".card");
  const a = card && D.byKey.get(card.dataset.key);
  const act = btn.dataset.act;

  if (act === "toggle-card" && a) {
    toggleCard(a);
  } else if (act === "fold-month" || act === "month-style") {
    const m = +btn.closest(".month").dataset.month;
    if (act === "month-style") return openMonthStyle(m);
    const s = state.settings, mp = { ...(s.months[m] || {}) };
    mp.hidden = !mp.hidden; s.months[m] = mp; saveSettings(); renderList();
  } else if (act === "react" && a && canWrite()) {
    const on = !(D.reactions.get(a.key) || []).some(r => r.user === state.me && r.emoji === btn.dataset.emoji);
    state.pickerFor = null;
    queue({ action: "react", key: a.key, owner: a.owner, user: state.me, emoji: btn.dataset.emoji, on, ts: Date.now() }, "Reaction");
    requestAnimationFrame(() => $(`.card[data-key="${CSS.escape(a.key)}"] .rx[data-emoji="${btn.dataset.emoji}"]`)?.classList.add("pop"));
  } else if (act === "picker" && a) {
    state.pickerFor = a.key; renderList();
  } else if (act === "thread" && a) {
    state.openThreads.has(a.key) ? state.openThreads.delete(a.key) : state.openThreads.add(a.key);
    renderList();
    if (state.openThreads.has(a.key)) $(`input[data-cmt="${CSS.escape(a.key)}"]`)?.focus({ preventScroll: true });
  } else if (act === "send" && a) {
    sendComment(a);
  } else if (act === "uncomment") {
    if (confirm("Delete your comment?")) queue({ action: "uncomment", id: btn.dataset.id, author: state.me }, "Delete comment");
  } else if (act === "edit" && a) {
    openEditor(a);
  } else if (act === "delete" && a) {
    deleteAlbum(a);
  } else if (act === "listen-me" && a) {
    const exists = state.view.listen.some(l => l.forUser === state.me && (l.nk || normKey(l.artist, l.album)) === a.nk);
    if (exists) return toast("Already on your listen list 🎧");
    queue({ action: "listenAdd", id: uid(), forUser: state.me, artist: a.artist, album: a.album, addedBy: state.me, note: `from ${a.owner}`, ts: Date.now() }, "Listen list");
    toast("Added to your listen list 🎧");
  }
});
function toggleCard(a) {
  state.openCards.has(a.key) ? state.openCards.delete(a.key) : state.openCards.add(a.key);
  if (!cardOpen(a)) state.openThreads.delete(a.key);
  state.pickerFor = null;
  renderList();
}
document.addEventListener("keydown", e => {
  if ((e.key === "Enter" || e.key === " ") && e.target.dataset?.act === "toggle-card") {
    e.preventDefault();
    const a = D.byKey.get(e.target.closest(".card")?.dataset.key);
    if (a) { toggleCard(a); $(`.card[data-key="${CSS.escape(a.key)}"] .card-top`)?.focus(); }
    return;
  }
  if (e.key === "Enter" && e.target.dataset?.cmt) {
    e.preventDefault();
    const a = D.byKey.get(e.target.dataset.cmt);
    if (a) sendComment(a);
  }
  if (e.key === "Escape") { $(".overlay")?.remove(); closePanel(); if (state.whoOpen) { state.whoOpen = false; renderTabs(); $("#who-btn")?.focus(); } }
});

function sendComment(a) {
  const input = $(`input[data-cmt="${CSS.escape(a.key)}"]`);
  const text = input?.value.trim();
  if (!text) return;
  input.value = "";
  queue({ action: "comment", id: uid(), key: a.key, owner: a.owner, author: state.me, text, ts: Date.now() }, "Comment");
  setTimeout(() => $(`input[data-cmt="${CSS.escape(a.key)}"]`)?.focus({ preventScroll: true }), 0);
}

function deleteAlbum(a) {
  if (!confirm(`Delete "${a.artist} – ${a.album}"?\nIt's removed from your Sheet tab (a backup is kept in app_trash).`)) return;
  if (a.pending && String(a.id).startsWith("tmp_")) {
    state.outbox = state.outbox.filter(o => !(o.payload.action === "add" && "tmp_" + o.payload.clientId === a.id && !o.done));
    saveOutbox(); rebuild(); return;
  }
  queue({ action: "delete", id: a.id, owner: a.owner, expectArtist: a.artist, expectAlbum: a.album, clientId: uid() }, "Delete");
  toast("Deleted ✂️");
}

// ═══════════════ listen list ═══════════════
function renderListen(main) {
  const v = state.view;
  if (!v) { main.innerHTML = `<div class="spinner"></div>`; return; }
  const who = state.listenFor || (canWrite() ? state.me : users()[0]?.name);
  state.listenFor = who;
  const items = v.listen.filter(l => l.forUser === who).sort((a, b) => (!!listenDone(a) - !!listenDone(b)) || b.ts - a.ts);
  const forMe = isMe(who);
  // keep a half-typed suggestion across background refreshes
  const old = $("#ll-form"), keep = old && old.dataset.for === who ? Object.fromEntries(new FormData(old)) : null;
  const focusName = document.activeElement?.closest?.("#ll-form") ? document.activeElement.name : null;
  main.innerHTML = `
    <div class="ll-users">${users().map(u => `<button class="tab ${u.name === who ? "active" : ""}" data-ll="${esc(u.name)}">${avatar(u.name, 20)}${esc(u.name)} <span class="tab-count">${v.listen.filter(l => l.forUser === u.name && !listenDone(l)).length}</span></button>`).join("")}</div>
    ${canWrite() ? `<form class="ll-add" id="ll-form" data-for="${esc(who)}">
      <input class="fi" name="artist" placeholder="Artist" autocomplete="off" required>
      <input class="fi" name="album" placeholder="Album (optional)" autocomplete="off">
      <button class="btn btn-primary">${forMe ? "＋ Add" : "＋ Suggest to " + esc(who)}</button>
      <input class="fi" name="note" placeholder="${forMe ? "Note to self (optional)" : "Why should they hear it? (optional)"}" style="grid-column:1/-1">
    </form>` : ""}
    <div class="ll-list">
      ${items.length ? items.map((l, i) => {
        const done = listenDone(l);
        return `<div class="ll-item ${done ? "done" : ""}" style="animation-delay:${Math.min(i, 10) * 30}ms">
          <div class="ll-main">
            <div class="ll-title">${esc(l.artist)}${l.album ? ` <span>– ${esc(l.album)}</span>` : ""}</div>
            <div class="ll-sub">${l.addedBy !== l.forUser ? `${avatar(l.addedBy, 16)} ${esc(l.addedBy)} suggested · ` : ""}${timeAgo(l.ts)}${l.note ? ` · ${esc(l.note)}` : ""}${done ? ` · ✓ listened${done.rating ? " ★" + esc(done.rating) : ""}` : ""}</div>
          </div>
          ${forMe && !done ? `<button class="mini" data-ll-log="${esc(l.id)}">🎧 Log it</button>` : ""}
          ${canWrite() && (forMe || isMe(l.addedBy)) ? `<button class="mini danger" data-ll-del="${esc(l.id)}" title="Remove">✕</button>` : ""}
        </div>`;
      }).join("") : `<div class="empty"><div class="empty-icon">📝</div>${forMe ? "Your listen list is empty.<br>Tap ＋ 🎧 on anyone's album, or add one above." : `Nothing on ${esc(who)}'s list yet.<br>Suggest something!`}</div>`}
    </div>`;

  if (keep) Object.entries(keep).forEach(([k, val]) => { const i = $(`#ll-form [name="${k}"]`); if (i) i.value = val; });
  if (focusName) $(`#ll-form [name="${focusName}"]`)?.focus();
  $$("[data-ll]", main).forEach(b => b.addEventListener("click", () => { state.listenFor = b.dataset.ll; renderListen(main); }));
  $("#ll-form")?.addEventListener("submit", e => {
    e.preventDefault();
    const f = new FormData(e.target);
    queue({ action: "listenAdd", id: uid(), forUser: who, artist: f.get("artist").trim(), album: f.get("album").trim(), addedBy: state.me, note: f.get("note").trim(), ts: Date.now() }, "Listen list");
    toast(forMe ? "Added 🎧" : `Suggested to ${who} 💌`);
  });
  $$("[data-ll-del]", main).forEach(b => b.addEventListener("click", () => queue({ action: "listenRemove", id: b.dataset.llDel }, "Listen list")));
  $$("[data-ll-log]", main).forEach(b => b.addEventListener("click", () => {
    const l = v.listen.find(x => x.id === b.dataset.llLog);
    openEditor(null, { artist: l.artist, album: l.album });
  }));
  if (forMe && canWrite() && v.listen.some(l => l.forUser === state.me && l.ts > listenSeen())) {
    lsSet("muzika_lseen_" + state.me, Date.now());
    state.notifs = computeNotifs(); renderHeader(); renderTabs();
  }
}
const listenSeen = () => Math.max(state.seenTs, lsGet("muzika_lseen_" + state.me, 0));

// ═══════════════ notifications panel ═══════════════
function togglePanel() { state.panelOpen ? closePanel() : openPanel(); }
function openPanel() {
  closePanel(true);
  state.panelOpen = true;
  const p = document.createElement("div");
  p.className = "panel";
  const n = state.notifs;
  p.innerHTML = `
    <div class="panel-head">Activity ${n.length ? `<button class="mini" id="mark-read">Mark all read</button>` : ""}</div>
    ${n.length ? n.map((x, i) => `<div class="notif" data-i="${i}">${avatar(x.user, 32)}<div class="notif-text">${x.html}${x.extra ? `<em>${x.extra}</em>` : ""}</div><time>${timeAgo(x.ts)}</time></div>`).join("")
      : `<div class="empty" style="padding:30px"><div class="empty-icon">🌙</div>All caught up</div>`}`;
  document.body.appendChild(p);
  $("#mark-read", p)?.addEventListener("click", () => closePanel());
  $$(".notif", p).forEach(el => el.addEventListener("click", () => {
    const x = n[+el.dataset.i];
    closePanel();
    if (x.type === "listen") { state.tab = "listen"; state.listenFor = state.me; renderTabs(); renderMain(); return; }
    jumpTo(x.key, x.type === "comment");
  }));
}
function closePanel(silent) {
  const p = $(".panel");
  if (!p) { state.panelOpen = false; return; }
  p.remove();
  state.panelOpen = false;
  if (!silent) { markAllRead(); state.notifs = computeNotifs(); renderHeader(); renderTabs(); }
}
function jumpTo(key, openThread) {
  const a = D.byKey.get(key);
  if (!a) return;
  state.tab = a.owner;
  if (openThread) state.openThreads.add(key);
  if (!cardOpen(a)) toggleCard(a);
  if (monthPref(a.month).hidden) { state.settings.months[a.month].hidden = false; saveSettings(); }
  renderTabs(); renderMain();
  const el = $(`.card[data-key="${CSS.escape(key)}"]`);
  if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.remove("enter"); el.classList.add("flash"); }
}

// ═══════════════ full re-render ═══════════════
function rebuild() {
  state.view = applyPending(state.snap, state.outbox);
  derive();
  if (state.view && state.me && state.me !== GUEST && !userByName(state.me)) {
    // my user was removed / renamed in the Sheet
    state.me = null; localStorage.removeItem("muzika_user"); renderLogin(); return;
  }
  initSeenIfNeeded();
  state.notifs = computeNotifs();
  if ($(".login")) { if (!$(".login form")) renderLogin(); return; }
  if (!state.me) return;
  renderHeader(); renderTabs(); renderMain();
}
