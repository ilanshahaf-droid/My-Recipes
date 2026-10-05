const CACHE_NAME = 'fridge-app-v3';
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

// ---- Web Push: "someone added an item to the shopping list" (sent by the notify-shopping Edge Function) ----
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (e) { data = { title: 'מה יש במקרר?', body: event.data ? event.data.text() : '' }; }
  event.waitUntil((async () => {
    // If the app is open and visible, its own in-app message already covers this — don't double up.
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.some((w) => w.visibilityState === 'visible') && data.tag !== 'push-test') return;
    await self.registration.showNotification(data.title || 'מה יש במקרר?', {
      body: data.body || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: data.tag || 'fridge',
      renotify: true,
      lang: 'he',
      dir: 'rtl',
      data: { url: data.url || './' }
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if ('focus' in w) { await w.focus(); return; }
    }
    await self.clients.openWindow(url);
  })());
});
