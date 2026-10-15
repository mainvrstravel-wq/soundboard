const CACHE = 'soundboard-shell-v1';
const OWN_CACHE_PREFIX = 'soundboard-shell-';
const FALLBACK = '/offline.html';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([FALLBACK, '/icons/app-192.png', '/icons/app-512.png', '/icons/app-maskable-512.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(OWN_CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  // Keep live room traffic, sound lists, uploads, and audio completely network-driven.
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).catch(async () => (await caches.match(FALLBACK)) || new Response('กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })));
});
