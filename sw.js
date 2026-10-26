const CACHE = 'puzzles-v5';
const ASSETS = [
  './', './index.html', './style.css', './app.js', './lib/rng.js', './lib/history.js',
  './games/queens.js', './games/tango.js', './games/zip.js', './games/patches.js',
  './manifest.webmanifest', './icons/icon.svg', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate: serve from cache, refresh in the background.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const cached = await c.match(e.request);
      const net = fetch(e.request)
        .then((res) => { if (res.ok) c.put(e.request, res.clone()); return res; })
        .catch(() => null);
      return cached || (await net) || Response.error();
    })
  );
});
