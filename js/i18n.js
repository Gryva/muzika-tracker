/* Muzika Tracker – English interface.
 * The app is written in Croatian; in English mode every interface text is swapped as it is drawn
 * (text, title, aria-label, placeholder). What people typed – artists, albums, impressions, comments,
 * notes, names – sits inside the elements in SKIP and is never touched. */
(function () {
  if (lang() !== "en") return;
  const SKIP = ".user-text, .artist, .album-name, blockquote.impression, .cmt-text, .cmt-body p, .track, .track-rest, .own-note, .ll-title, .ll-note, .notif-text b, .user-btn[data-user], .who-item[data-tab]:not([data-tab=listen]) span:first-of-type, .rx-who-name, .tab[data-ll], .preview-card, input, textarea, [contenteditable], script, style, [data-noi18n]";
  const ATTRS = ["title", "aria-label", "placeholder", "alt"];

  const DICT = window.I18N_EN || {};
  const PATTERNS = (window.I18N_EN_PATTERNS || []).map(([re, to]) => [new RegExp("^" + re + "$", "u"), to]);
  const FRAGS = (window.I18N_EN_FRAGMENTS || []).map(([re, to]) => [new RegExp(re, "gu"), to]);
  const cache = new Map();
  function tr(text) {
    const t = text.trim();
    if (!t || !/[A-Za-zčćšžđČĆŠŽĐ]/.test(t)) return null;
    if (cache.has(t)) return cache.get(t);
    let out = DICT[t] ?? null;
    if (out == null) for (const [re, to] of PATTERNS) {
      if (re.test(t)) { out = t.replace(re, to); for (const [fr, ft] of FRAGS) out = out.replace(fr, ft); break; }
    }
    if (out != null && out !== t) out = text.replace(t, out); else out = null;
    cache.set(t, out == null ? null : out.trim());
    return out;
  }
  const skipped = el => el && el.closest && el.closest(SKIP);
  function doNode(n) {
    if (n.nodeType === 3) {
      if (skipped(n.parentElement)) return;
      const r = tr(n.nodeValue); if (r != null && r !== n.nodeValue) n.nodeValue = n.nodeValue.replace(n.nodeValue.trim(), r.trim());
      return;
    }
    if (n.nodeType !== 1) return;
    const el = n;
    if (!/^(SCRIPT|STYLE)$/.test(el.tagName)) for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v && !(a !== "placeholder" && el.closest(".user-btn[data-user]"))) { const r = tr(v); if (r != null) el.setAttribute(a, r); }
    }
    if (skipped(el) && el.matches(SKIP)) return;
    for (let c = el.firstChild; c; c = c.nextSibling) doNode(c);
  }
  window.i18nRun = () => document.body && doNode(document.body);
  const mo = new MutationObserver(list => {
    for (const m of list) {
      if (m.type === "childList") m.addedNodes.forEach(doNode);
      else if (m.type === "characterData") doNode(m.target);
      else if (m.type === "attributes") doNode(m.target);
    }
  });
  const start = () => { window.i18nRun(); mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS }); };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
  // native dialogs
  const _confirm = window.confirm.bind(window), _prompt = window.prompt.bind(window);
  window.confirm = m => _confirm(tr(String(m)) ?? m);
  window.prompt = (m, d) => _prompt(tr(String(m)) ?? m, d);
  window.i18nTr = tr;
})();
