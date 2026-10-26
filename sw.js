// Atomic app-shell cache: every version precaches a complete, consistent set of files
// and serves only from that set. A new version installs beside the old one, then takes over.
const VERSION = 'v22';
const CACHE = 'puzzles-' + VERSION;
const ASSETS = [
  './', './index.html', './style.css', './app.js', './lib/rng.js', './lib/history.js',
  './games/queens.js', './games/tango.js', './games/zip.js', './games/patches.js',
  './manifest.webmanifest', './icons/icon.svg', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  const key = e.request.mode === 'navigate' ? './index.html' : e.request;
  e.respondWith(
    caches.open(CACHE).then(async (c) => (await c.match(key, { ignoreSearch: true })) || fetch(e.request))
  );
});
