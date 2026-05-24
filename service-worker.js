const CACHE_NAME = 'mazerun-v1';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './dist/main.js',
  './dist/gameLoop.js',
  './dist/map.js',
  './dist/player.js',
  './dist/ghost.js',
  './dist/renderer.js',
  './dist/input.js',
  './dist/audio.js',
  './dist/storage.js',
  './dist/types.js',
  './dist/constants.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((response) => {
        if (!response.ok || response.type !== 'basic') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        return response;
      });
    })
  );
});
