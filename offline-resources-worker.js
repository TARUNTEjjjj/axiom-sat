// Only navigation recovery belongs here. The /resources/ worker owns its
// own verified offline shell and never shares or deletes application caches.
const NETWORK_TIMEOUT_MS = 4000;
const RESOURCE_PATH = '/resources/';

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || request.mode !== 'navigate' || url.origin !== self.location.origin ||
      url.pathname === '/api' || url.pathname.startsWith('/api/') ||
      url.pathname === '/resources' || url.pathname.startsWith(RESOURCE_PATH)) return;
  event.respondWith((async () => {
    const controller = new AbortController();
    let timer;
    try {
      // Keep HTTP responses (including 404/500) intact. Only unavailable or
      // unresponsive navigation requests use the offline library.
      return await Promise.race([
        fetch(request, {signal: controller.signal}),
        new Promise((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error('Navigation timed out')); }, NETWORK_TIMEOUT_MS);
        }),
      ]);
    } catch {
      return Response.redirect(new URL(RESOURCE_PATH, self.location.origin).href, 302);
    } finally { clearTimeout(timer); }
  })());
});
