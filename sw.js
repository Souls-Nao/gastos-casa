const CACHE = 'gastos-v1';
const CDN = 'https://cdn.jsdelivr.net/';
const TIMEOUT = 3000;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

async function keep(request, response) {
  if (response.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function cacheFirst(request) {
  return await caches.match(request) ?? keep(request, await fetch(request));
}

async function networkFirst(request) {
  const page = request.mode === 'navigate';
  const cached = await caches.match(request, { ignoreSearch: page })
    ?? (page ? await caches.match('./') ?? await caches.match('./index.html') : undefined);
  const network = fetch(request, { cache: 'no-cache' }).then((response) => keep(request, response));
  if (!cached) return network;
  return Promise.race([
    network.catch(() => cached),
    new Promise((resolve) => setTimeout(resolve, TIMEOUT, cached)),
  ]);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.url.startsWith(CDN)) event.respondWith(cacheFirst(request));
  else if (request.url.startsWith(self.location.origin)) event.respondWith(networkFirst(request));
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'cache') return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const url of event.data.urls) {
      if (await cache.match(url)) continue;
      await fetch(url).then((response) => keep(url, response)).catch(() => null);
    }
  })());
});
