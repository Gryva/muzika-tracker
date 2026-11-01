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
/** One "Listen" button; the choices only appear when you ask for them. Exact links when found, a search otherwise. */
function linksMenuHtml(a) {
  const q = encodeURIComponent(`${a.artist} ${a.album}`);
  const opts = [
    ["sp", ICONS.spotify, "Spotify", a.spotify, "https://open.spotify.com/search/" + q],
    ["yt", ICONS.youtube, "YouTube", a.youtube, "https://www.youtube.com/results?search_query=" + q + "+full+album"],
    ["am", "", "Apple Music", a.apple, "https://music.apple.com/search?term=" + q],
    ["dz", "", "Deezer", a.deezer, "https://www.deezer.com/search/" + q + "/album"]
  ].filter(([, , , url], i) => url || i < 2);
  return `<div class="links-menu" role="menu" aria-label="Poslušaj ${esc(a.album)}">${opts.map(([cls, ic, name, url, search]) =>
    `<a role="menuitem" class="link ${cls}" target="_blank" rel="noopener" href="${esc(url || search)}">${ic}<span>${name}</span><small>${url ? "otvori" : "traži"}</small></a>`).join("")}</div>`;
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
      ${canWrite() ? `<button class="btn btn-ghost btn-icon" id="btn-bell" title="Aktivnost" aria-label="Aktivnost${n ? ` (${n} novo)` : ""}">🔔${n ? `<span class="badge">${n > 99 ? "99+" : n}</span>` : ""}</button>` : ""}
      ${canWrite() ? `<button class="btn btn-ghost btn-icon btn-me" id="btn-settings" title="Postavke i profil" aria-label="Postavke i profil">${avatar(state.me, 34)}</button>`
        : `<button class="btn btn-ghost btn-icon" id="btn-settings" title="Postavke" aria-label="Postavke">⚙️</button><button class="btn btn-ghost btn-sm" id="btn-login">Prijava</button>`}
    </div>`;
  setSync();
  $("#btn-settings").addEventListener("click", () => openSettings());
  $("#btn-login")?.addEventListener("click", () => { state.me = null; renderLogin(); });
  $("#btn-bell")?.addEventListener("click", togglePanel);
  if (n > (renderHeader._last || 0) && renderHeader._last !== undefined) $("#btn-bell")?.classList.add("wiggle");
  renderHeader._last = n;
  renderFab();
}

/** The one big button, in a bar of its own at the bottom where the thumb already is. */
function renderFab() {
  let d = $("#dock");
  if (!canWrite() || state.tab === "listen") { d?.remove(); return; }
  if (!d) {
    d = document.createElement("div");
    d.id = "dock"; d.className = "dock";
    d.innerHTML = `<button class="dock-btn" id="fab" aria-label="Dodaj album"><span class="dock-plus" aria-hidden="true">＋</span>Dodaj album</button>`;
    $("#fab", d).addEventListener("click", () => openEditor());
    document.body.appendChild(d);
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
  const stats = cur === "listen" ? "" : `${mineAlbums.length} album${mineAlbums.length === 1 ? "" : "a"}`;
  const label = cur === "listen" ? `<span class="who-ic" aria-hidden="true">🎧</span>Za slušanje`
    : `${avatar(cur, 26)}${isMe(cur) ? "Moja tablica" : esc(cur)}`;
  t.innerHTML = `
    <div class="who">
      <button class="who-btn" id="who-btn" aria-expanded="${!!state.whoOpen}" aria-controls="who-menu">
        ${label}${anyNew ? `<i class="dot" aria-label="Nova aktivnost"></i>` : ""}<span class="chev" aria-hidden="true"></span>
      </button>
      <span class="who-stats">${stats}</span>
    </div>
    <div class="who-menu ${state.whoOpen ? "open" : ""}" id="who-menu" ${state.whoOpen ? "" : "hidden"}>
      ${order.map(n => `<button class="who-item ${cur === n ? "active" : ""}" data-tab="${esc(n)}">${avatar(n, 30)}<span>${isMe(n) ? "Ja" : esc(n)}</span><small>${count(n)}</small>${hasNew(n) && cur !== n ? `<i class="dot"></i>` : ""}</button>`).join("")}
      <button class="who-item ${cur === "listen" ? "active" : ""}" data-tab="listen"><span class="av who-ll" style="--sz:30px">🎧</span><span>Za slušanje</span>${listenNew ? `<i class="dot"></i>` : ""}</button>
    </div>`;
  $("#who-btn", t).addEventListener("click", e => { e.stopPropagation(); state.whoOpen = !state.whoOpen; renderTabs(); if (state.whoOpen) $(".who-item.active", t)?.focus(); });
  $$(".who-item", t).forEach(b => b.addEventListener("click", e => {
    e.stopPropagation();
    state.tab = b.dataset.tab; state.pickerFor = null; state.whoOpen = false; state.scrollToEnd = true;
    renderTabs(); renderMain(); renderFab();
  }));
}

// ═══════════════ main list ═══════════════
/** Same order as the Sheet: January at the top, newest at the bottom (the view starts scrolled to the end). */
function sortAlbums(list) {
  const m = x => x.month || 13;
  return list.sort((a, b) => m(a) - m(b) || (a.row || 0) - (b.row || 0) || (a.created || 0) - (b.created || 0));
}

function renderMain() {
  const main = $("#main");
  if (state.tab === "listen") return renderListen(main);
  const v = state.view;
  if (!v) {
    main.innerHTML = state.loading ? `<div class="spinner"></div>` :
      `<div class="empty"><div class="empty-icon">🔗</div>Ne mogu doći do Google tablice.<br><small>${esc(state.lastError)}</small></div>`;
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
    list.innerHTML = `<div class="empty"><div class="empty-icon">🎧</div>${canWrite() && state.tab === state.me ? "Još ništa – dodaj prvi album gumbom dolje" : "Još nema albuma"}</div>`;
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
          <button class="month-name" data-act="fold-month" aria-expanded="${!mp.hidden}" title="${mp.hidden ? "Prikaži" : "Sakrij"}: ${name}">
            <h2>${monthTitleHtml(month)}</h2><span class="month-count" aria-label="Albuma: ${counts[month]}">${counts[month]}</span>
          </button>
          <span class="month-rule" aria-hidden="true"></span>
          <button class="month-gear" data-act="month-style" aria-label="Uredi izgled: ${name}" title="Uredi izgled: ${name}">⚙︎</button>
        </header><div class="album-list">`;
    }
    if (!monthPref(month).hidden) html += cardHtml(a, i++);
  }
  list.innerHTML = html + `</div></section>`;
  if (state.scrollToEnd) {
    state.scrollToEnd = false;
    requestAnimationFrame(scrollToCurrentMonth);
    // fonts/layout can still be settling on the very first paint: try once more if nothing moved
    setTimeout(() => { if (window.scrollY === 0) scrollToCurrentMonth(); }, 350);
  }
  albums.forEach(a => state.rendered.add(a.key));
}

const cardOpen = a => state.settings.cards === "open" ? !state.openCards.has(a.key) : state.openCards.has(a.key);

/** "★ 4.5+" for the compact row; raw text if someone typed something unusual in the Sheet */
function scoreHtml(r) {
  if (!r) return "";
  const p = parseRating(r);
  return `<span class="score" title="Ocjena ${esc(r)}">★ <b>${esc(p ? fmtRating(p.v, p.plus) : r)}</b></span>`;
}

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
  const facts = [
    a.year && esc(String(a.year).replace(/\.$/, "")),
    a.genre && esc(a.genre),
    a.duration && esc(a.duration),
    a.listenedDate && "slušano " + esc(fmtDate(a.listenedDate))
  ].filter(Boolean);
  const tracks = a.standoutTracks && a.standoutTracks !== "-" ? a.standoutTracks : "";
  const rows = [
    tracks && ["🎵", "Istaknute pjesme", esc(tracks)],
    a.comments && ["📝", "Bilješka", esc(a.comments)]
  ].filter(Boolean);
  // when open, the quick facts move up into the card's head; the body keeps the words
  const headFacts = expanded ? `<div class="facts">${parseRating(a.rating) ? ratingHtml(a.rating) : a.rating ? `<span>★ ${esc(a.rating)}</span>` : ""}${facts.map(f => `<span>${f}</span>`).join("")}${a.recommend ? `<span class="f-rec">${recHtml(a.recommend)}</span>` : ""}</div>` : "";
  const moreOpen = state.moreFor === a.key;

  return `
  <article class="card ${fresh ? "enter fade-in" : ""} ${a.pending ? "pending" : ""} ${expanded ? "open" : ""}" data-key="${esc(a.key)}" style="--m:${monthColor(a.month)};--tint:${monthTint(a.month)};--i:${Math.min(i, 12)}">
    <div class="card-top" data-act="toggle-card" role="button" tabindex="0" aria-expanded="${expanded}" aria-label="${esc(a.artist)} – ${esc(a.album)}, ${expanded ? "zatvori" : "otvori"}">
      <div class="card-main">
        <div class="artist">${esc(a.artist)}</div>
        <div class="album-name">${esc(a.album)}${isNew(a) ? ` <span class="new-pill tag">NOVO</span>` : ""}${a.pending ? ` <span class="pending-pill" title="Spremljeno na uređaju, čeka sinkronizaciju">⏳</span>` : ""}</div>
        ${headFacts}
      </div>
      <div class="peek">
        ${also.length ? `<span class="av-stack" title="Slušali i: ${esc(also.join(", "))}">${also.map(o => avatar(o, 16)).join("")}</span>` : ""}
        ${!expanded && cmts.length ? `<span class="peek-c" title="Komentara: ${cmts.length}">💬${cmts.length}</span>` : ""}
        ${scoreHtml(a.rating)}
        <span class="chev" aria-hidden="true"></span>
      </div>
    </div>
    ${expanded ? `<div class="card-more">
      ${a.impression ? `<blockquote class="impression">${esc(a.impression)}</blockquote>` : ""}
      ${rows.length ? `<ul class="details">${rows.map(([ic, k, v]) => `<li><span class="d-ic" aria-hidden="true">${ic}</span><span class="sr">${k}: </span>${v}</li>`).join("")}</ul>` : ""}
      ${also.length ? `<div class="also-line">${avatar(also[0], 18)}<span>Ima ga i u tablici: ${esc(also.join(", "))}</span></div>` : ""}
      <div class="social">
        ${Object.entries(grouped).map(([e, us]) => `<button class="rx ${canWrite() && us.includes(state.me) ? "mine" : ""}" data-act="react" data-emoji="${e}" title="${esc(us.join(", "))}" aria-label="${e} ${us.length}">${e}<small>${us.length}</small></button>`).join("")}
        ${canWrite() ? (state.pickerFor === a.key
          ? `<span class="rx-picker">${REACTIONS.map(e => `<button data-act="react" data-emoji="${e}" aria-label="Reagiraj ${e}">${e}</button>`).join("")}</span>`
          : `<button class="rx" data-act="picker" title="Reagiraj" aria-label="Dodaj reakciju">☺︎<small>+</small></button>`) : ""}
        <button class="rx ${open ? "mine" : ""}" data-act="thread" aria-expanded="${open}" aria-label="Komentari (${cmts.length})">💬<small>${cmts.length || ""}</small></button>
        <span class="grow"></span>
        <button class="rx ${state.linksFor === a.key ? "mine" : ""}" data-act="links" aria-expanded="${state.linksFor === a.key}" aria-label="Poslušaj na…">🎧<small>Poslušaj</small></button>
        ${canWrite() ? `<button class="rx more-btn ${moreOpen ? "mine" : ""}" data-act="more" aria-expanded="${moreOpen}" aria-label="Još radnji">⋯</button>` : ""}
      </div>
      ${moreOpen ? `<div class="more-menu" role="menu">
        ${mine ? `<button role="menuitem" data-act="edit">✏️ Uredi</button><button role="menuitem" class="danger" data-act="delete">🗑️ Obriši</button>`
          : `<button role="menuitem" data-act="listen-me">🎧 Dodaj na moju listu za slušanje</button>`}
      </div>` : ""}
      ${state.linksFor === a.key ? linksMenuHtml(a) : ""}
      ${open ? threadHtml(a, cmts) : ""}
    </div>` : ""}
  </article>`;
}

function threadHtml(a, cmts) {
  return `<div class="thread">
    ${cmts.map(c => `<div class="cmt">${avatar(c.author, 26)}<div class="cmt-body">
        <div class="cmt-head"><b>${esc(c.author)}</b><span>${c.pending ? "⏳" : timeAgo(c.ts)}</span>
          ${isMe(c.author) ? `<button class="cmt-del" data-act="uncomment" data-id="${esc(c.id)}" title="Obriši" aria-label="Obriši komentar">✕</button>` : ""}</div>
        <div class="cmt-text">${esc(c.text)}</div></div></div>`).join("")}
    ${!cmts.length ? `<div class="hint">Još nema komentara${canWrite() ? " – reci nešto lijepo 💬" : ""}</div>` : ""}
    ${canWrite() ? `<div class="cmt-form">${avatar(state.me, 26)}<input data-cmt="${esc(a.key)}" placeholder="Napiši komentar…" aria-label="Napiši komentar" maxlength="1000" enterkeyhint="send"><button class="btn btn-primary btn-sm" data-act="send">Pošalji</button></div>` : ""}
  </div>`;
}

// ═══════════════ card actions (event delegation) ═══════════════
document.addEventListener("click", e => {
  const btn = e.target.closest("[data-act]");
  if (!btn) {
    if (state.pickerFor && !e.target.closest(".rx-picker")) { state.pickerFor = null; renderList(); }
    if (state.panelOpen && !e.target.closest(".panel") && !e.target.closest("#btn-bell")) closePanel();
    if (state.whoOpen && !e.target.closest(".tabs")) { state.whoOpen = false; renderTabs(); }
    if ((state.moreFor || state.linksFor) && !e.target.closest(".more-menu, .links-menu")) { state.moreFor = state.linksFor = null; renderList(); }
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
    foldMonth(m);
  } else if (act === "react" && a && canWrite()) {
    const on = !(D.reactions.get(a.key) || []).some(r => r.user === state.me && r.emoji === btn.dataset.emoji);
    state.pickerFor = null;
    queue({ action: "react", key: a.key, owner: a.owner, user: state.me, emoji: btn.dataset.emoji, on, ts: Date.now() }, "Reakcija");
    requestAnimationFrame(() => $(`.card[data-key="${CSS.escape(a.key)}"] .rx[data-emoji="${btn.dataset.emoji}"]`)?.classList.add("pop"));
  } else if (act === "links" && a) {
    state.linksFor = state.linksFor === a.key ? null : a.key; state.moreFor = null; renderList();
  } else if (act === "more" && a) {
    state.moreFor = state.moreFor === a.key ? null : a.key; state.linksFor = null; renderList();
  } else if (act === "picker" && a) {
    state.pickerFor = a.key; renderList();
  } else if (act === "thread" && a) {
    state.openThreads.has(a.key) ? state.openThreads.delete(a.key) : state.openThreads.add(a.key);
    renderList();
    if (state.openThreads.has(a.key)) $(`input[data-cmt="${CSS.escape(a.key)}"]`)?.focus({ preventScroll: true });
  } else if (act === "send" && a) {
    sendComment(a);
  } else if (act === "uncomment") {
    if (confirm("Obrisati komentar?")) queue({ action: "uncomment", id: btn.dataset.id, author: state.me }, "Brisanje komentara");
  } else if (act === "edit" && a) {
    state.moreFor = null; renderList(); openEditor(a);
  } else if (act === "delete" && a) {
    state.moreFor = null; renderList(); deleteAlbum(a);
  } else if (act === "listen-me" && a) {
    state.moreFor = null; renderList();
    const exists = state.view.listen.some(l => l.forUser === state.me && (l.nk || normKey(l.artist, l.album)) === a.nk);
    if (exists) return toast("Već je na tvojoj listi za slušanje 🎧");
    queue({ action: "listenAdd", id: uid(), forUser: state.me, artist: a.artist, album: a.album, addedBy: state.me, note: `od ${a.owner}`, ts: Date.now() }, "Lista za slušanje");
    toast("Dodano na listu za slušanje 🎧");
  }
});
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || state.settings.style === "clear";
const EASE = "cubic-bezier(.2, .8, .2, 1)";

/** Open/close a card with a short height + fade animation. */
// sticky bars: keep their heights in CSS variables so the switcher and month headers stick right below
(() => {
  const set = () => {
    const h = $("#header")?.offsetHeight || 0;
    document.documentElement.style.setProperty("--header-h", h + "px");
    document.documentElement.style.setProperty("--chrome-h", chromeHeight() + "px");
  };
  const ro = new ResizeObserver(set);
  ["#header", "#tabs"].forEach(s => $(s) && ro.observe($(s)));
  set();
})();

function toggleCard(a) {
  const sel = `.card[data-key="${CSS.escape(a.key)}"]`;
  const wasOpen = cardOpen(a);
  const flip = () => {
    state.openCards.has(a.key) ? state.openCards.delete(a.key) : state.openCards.add(a.key);
    if (!cardOpen(a)) state.openThreads.delete(a.key);
    state.pickerFor = null; state.moreFor = null; state.linksFor = null;
    renderList();
  };
  const more = $(sel + " .card-more");
  if (calm()) return flip();
  if (wasOpen && more) {
    more.animate([{ height: more.offsetHeight + "px", opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 200, easing: "ease-in" }).onfinish = flip;
    more.style.overflow = "hidden";
    return;
  }
  flip();
  const m2 = $(sel + " .card-more");
  if (m2) {
    m2.style.overflow = "hidden";
    const anim = m2.animate([{ height: "0px", opacity: 0 }, { height: m2.offsetHeight + "px", opacity: 1 }], { duration: 280, easing: EASE });
    anim.onfinish = () => { m2.style.overflow = ""; };
  }
}

/** Fold / unfold a whole month: the list slides shut or open, cards ripple back in. */
function foldMonth(m) {
  const s = state.settings;
  const sec = $(`.month[data-month="${m}"]`), list = sec && $(".album-list", sec);
  const set = hidden => { s.months[m] = { ...(s.months[m] || {}), hidden }; saveSettings(); };
  const hide = !monthPref(m).hidden;
  if (calm() || !list) { set(hide); return renderList(); }
  if (hide) {
    list.style.overflow = "hidden";
    list.animate([{ height: list.offsetHeight + "px", opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 260, easing: "ease-in" }).onfinish = () => { set(true); renderList(); };
    return;
  }
  set(false);
  state.view.albums.filter(a => (a.month || 0) === m).forEach(a => state.rendered.delete(a.key)); // let them ripple in
  renderList();
  const l2 = $(`.month[data-month="${m}"] .album-list`);
  if (l2) {
    l2.style.overflow = "hidden";
    l2.animate([{ height: "0px" }, { height: l2.offsetHeight + "px" }], { duration: 320, easing: EASE }).onfinish = () => { l2.style.overflow = ""; };
  }
}

/** Month name with its symbol on both sides. */
function monthTitleHtml(m) {
  const mp = monthPref(m), name = m ? MONTH_NAMES[m - 1] : "Bez mjeseca";
  if (!mp.icon) return `<span class="month-title">${name}</span>`;
  const ic = `<span class="month-icon" aria-hidden="true">${esc(mp.icon)}</span>`;
  return `${ic}<span class="month-title">${name}</span>${ic.replace("month-icon", "month-icon r")}`;
}

/** Open on the month we're in: its header sits right under the top bars, older months are above. */
function scrollToCurrentMonth() {
  const secs = $$("#list .month");
  if (!secs.length) return;
  const now = new Date().getMonth() + 1;
  const target = secs.find(x => +x.dataset.month === now) || secs.filter(x => +x.dataset.month && +x.dataset.month <= now).pop() || secs[secs.length - 1];
  const top = target.getBoundingClientRect().top + window.scrollY - chromeHeight() - 8;
  window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
}
function chromeHeight() { return ($("#header")?.offsetHeight || 0) + ($("#tabs")?.offsetHeight || 0); }
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
  queue({ action: "comment", id: uid(), key: a.key, owner: a.owner, author: state.me, text, ts: Date.now() }, "Komentar");
  setTimeout(() => $(`input[data-cmt="${CSS.escape(a.key)}"]`)?.focus({ preventScroll: true }), 0);
}

function deleteAlbum(a) {
  if (!confirm(`Obrisati "${a.artist} – ${a.album}"?\nMiče se iz tvoje kartice u tablici (kopija ostaje u app_trash).`)) return;
  if (a.pending && String(a.id).startsWith("tmp_")) {
    state.outbox = state.outbox.filter(o => !(o.payload.action === "add" && "tmp_" + o.payload.clientId === a.id && !o.done));
    saveOutbox(); rebuild(); return;
  }
  queue({ action: "delete", id: a.id, owner: a.owner, expectArtist: a.artist, expectAlbum: a.album, clientId: uid() }, "Brisanje");
  toast("Obrisano ✂️");
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
      <input class="fi" name="artist" placeholder="Izvođač" aria-label="Izvođač" autocomplete="off" required>
      <input class="fi" name="album" placeholder="Album (nije obavezno)" aria-label="Album" autocomplete="off">
      <button class="btn btn-primary">${forMe ? "＋ Dodaj" : "＋ Predloži: " + esc(who)}</button>
      <input class="fi" name="note" placeholder="${forMe ? "Bilješka za sebe (nije obavezno)" : "Zašto bi to trebali čuti? (nije obavezno)"}" aria-label="Bilješka" style="grid-column:1/-1">
    </form>` : ""}
    <div class="ll-list">
      ${items.length ? items.map((l, i) => {
        const done = listenDone(l);
        return `<div class="ll-item ${done ? "done" : ""}" style="animation-delay:${Math.min(i, 10) * 30}ms">
          <div class="ll-main">
            <div class="ll-title">${esc(l.artist)}${l.album ? ` <span>– ${esc(l.album)}</span>` : ""}</div>
            <div class="ll-sub">${l.addedBy !== l.forUser ? `${avatar(l.addedBy, 16)} ${esc(l.addedBy)} predlaže · ` : ""}${timeAgo(l.ts)}${l.note ? ` · ${esc(l.note)}` : ""}${done ? ` · ✓ poslušano${done.rating ? " ★" + esc(done.rating) : ""}` : ""}</div>
          </div>
          ${forMe && !done ? `<button class="mini" data-ll-log="${esc(l.id)}">🎧 Upiši</button>` : ""}
          ${canWrite() && (forMe || isMe(l.addedBy)) ? `<button class="mini danger" data-ll-del="${esc(l.id)}" title="Makni" aria-label="Makni s liste">✕</button>` : ""}
        </div>`;
      }).join("") : `<div class="empty"><div class="empty-icon">📝</div>${forMe ? "Tvoja lista za slušanje je prazna.<br>Dodaj album gore ili preko ⋯ na tuđem albumu." : `Lista (${esc(who)}) je još prazna.<br>Predloži nešto!`}</div>`}
    </div>`;

  if (keep) Object.entries(keep).forEach(([k, val]) => { const i = $(`#ll-form [name="${k}"]`); if (i) i.value = val; });
  if (focusName) $(`#ll-form [name="${focusName}"]`)?.focus();
  $$("[data-ll]", main).forEach(b => b.addEventListener("click", () => { state.listenFor = b.dataset.ll; renderListen(main); }));
  $("#ll-form")?.addEventListener("submit", e => {
    e.preventDefault();
    const f = new FormData(e.target);
    queue({ action: "listenAdd", id: uid(), forUser: who, artist: f.get("artist").trim(), album: f.get("album").trim(), addedBy: state.me, note: f.get("note").trim(), ts: Date.now() }, "Lista za slušanje");
    toast(forMe ? "Dodano 🎧" : `Predloženo: ${who} 💌`);
  });
  $$("[data-ll-del]", main).forEach(b => b.addEventListener("click", () => queue({ action: "listenRemove", id: b.dataset.llDel }, "Lista za slušanje")));
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
    <div class="panel-head">Aktivnost ${n.length ? `<button class="mini" id="mark-read">Označi sve pročitanim</button>` : ""}</div>
    ${n.length ? n.map((x, i) => `<div class="notif" data-i="${i}">${avatar(x.user, 32)}<div class="notif-text">${x.html}${x.extra ? `<em>${x.extra}</em>` : ""}</div><time>${timeAgo(x.ts)}</time></div>`).join("")
      : `<div class="empty" style="padding:30px"><div class="empty-icon">🌙</div>Sve si pogledao/la</div>`}`;
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
