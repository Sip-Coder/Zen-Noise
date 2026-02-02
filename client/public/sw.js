const CACHE_NAME = 'brown-noise-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  // Simple cache-first strategy
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request).catch(() => {
        // Optional: fallback if offline and not in cache
        // but for a SPA, we usually cache the main bundle.
      });
    })
  );
});
