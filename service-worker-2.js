const CACHE_NAME = 'fridge-app-v2';
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Network-first for navigation/app shell so updates land quickly when online,
// falling back to cache when offline. Everything else (external CDNs, APIs) passes through untouched.
// Important: {cache:'no-store'} forces a real round-trip to the server every time, bypassing the
// browser's own HTTP cache — without this, GitHub Pages' caching headers could let the browser
// quietly serve an old copy even though this handler is "network-first".
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isAppShell = url.origin === self.location.origin;
  if (!isAppShell || event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
