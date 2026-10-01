const CACHE = 'gastos-v1';
const CDN = 'https://cdn.jsdelivr.net/';
const PAGE_TIMEOUT = 3000;
const FILE_TIMEOUT = 8000;
const offlinePages = new Set();

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

function fresh(request) {
  return fetch(request, { cache: 'no-cache' }).then((response) => keep(request, response));
}

async function cacheFirst(request, load) {
  return await caches.match(request) ?? load(request);
}

function networkFirst(request, cached, timeout, onFallback) {
  const network = fresh(request);
  if (!cached) return network;
  const fallback = () => {
    onFallback?.();
    return cached;
  };
  return Promise.race([
    network.catch(fallback),
    new Promise((resolve) => setTimeout(() => resolve(fallback()), timeout)),
  ]);
}

async function page(event) {
  const cached = await caches.match(event.request, { ignoreSearch: true })
    ?? await caches.match('./') ?? await caches.match('./index.html');
  return networkFirst(event.request, cached, PAGE_TIMEOUT, () => offlinePages.add(event.resultingClientId));
}

async function file(event) {
  if (offlinePages.has(event.clientId)) return cacheFirst(event.request, fresh);
  return networkFirst(event.request, await caches.match(event.request), FILE_TIMEOUT);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.url.startsWith(CDN)) event.respondWith(cacheFirst(request, async (target) => keep(target, await fetch(target))));
  else if (!request.url.startsWith(self.location.origin)) return;
  else if (request.mode === 'navigate') event.respondWith(page(event));
  else event.respondWith(file(event));
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
