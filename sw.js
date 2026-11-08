// Offline: the whole app is cached at install, so it opens instantly and works without a connection.
// Exchange-rate and holiday APIs are cross-origin and never cached here (the app keeps its own copy).
// Bump VERSION on every deploy: the new worker re-downloads everything, then the page reloads once.
const VERSION = 'nanter-v3';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/icon.svg',
  'icons/mark.svg',
  'js/app.js',
  'js/core/dom.js',
  'js/core/form.js',
  'js/core/num.js',
  'js/core/solver.js',
  'js/core/store.js',
  'js/core/ui.js',
  'js/data/geo.js',
  'js/data/schoolfr.js',
  'js/data/units.js',
  'js/lib/currencies.js',
  'js/lib/dates.js',
  'js/lib/holidays.js',
  'js/lib/qr.js',
  'js/lib/quick.js',
  'js/lib/sun.js',
  'js/lib/tz.js',
  'js/tools/calc.js',
  'js/tools/health.js',
  'js/tools/holidays.js',
  'js/tools/home.js',
  'js/tools/kitchen.js',
  'js/tools/math.js',
  'js/tools/money.js',
  'js/tools/phone.js',
  'js/tools/qrtool.js',
  'js/tools/registry.js',
  'js/tools/sizes.js',
  'js/tools/tech.js',
  'js/tools/time.js',
  'js/tools/travel.js',
  'js/tools/units.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('nanter-') && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    if (req.mode === 'navigate') {
      const hit = await cache.match('index.html');
      if (hit) return hit;
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') { const idx = await cache.match('index.html'); if (idx) return idx; }
      throw err;
    }
  })());
});
