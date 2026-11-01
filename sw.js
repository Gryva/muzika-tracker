// Muzika Tracker service worker: lets the app open without internet.
// Network first (so updates show immediately), cached copy as fallback. API calls are never cached here
// – the app keeps its own data copy in localStorage.
const CACHE = "muzika-shell-v7";
const SHELL = ["./", "index.html", "styles.css?v=7", "js/core.js?v=7", "js/ui.js?v=7", "js/forms.js?v=7"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: false }).then(r => r || caches.match("index.html")))
  );
});
