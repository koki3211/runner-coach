const CACHE = 'runner-coach-v2';
const ASSETS = [
  '/', '/index.html', '/app.js', '/firebase-config.js', '/social.js',
  '/design-tokens/variables.css', '/design-tokens/font-family.css',
  '/manifest.json', '/icon.svg'
];

// Domains that should always go to network (Firebase, Google APIs)
const NETWORK_ONLY = ['googleapis.com', 'gstatic.com', 'firebaseio.com', 'firebaseapp.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Network-only for Firebase / Google API calls
  if (NETWORK_ONLY.some(d => url.hostname.includes(d))) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Cache-first for local assets
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (res.ok && e.request.method === 'GET') {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    })).catch(() => caches.match('/index.html'))
  );
});
