/* Recipe Book service worker.
 *
 * App shell: precached, then served cache-first so the book opens instantly
 * and works with no network at all.
 * Google Fonts: stale-while-revalidate, so the first online visit warms them
 * and every later visit (online or not) gets them from the cache.
 *
 * Bump CACHE_VERSION whenever the shell changes; the old caches are dropped
 * on activate and clients are claimed immediately.
 */

const CACHE_VERSION = 'v2';
const SHELL_CACHE = `recipe-book-shell-${CACHE_VERSION}`;
const FONT_CACHE = `recipe-book-fonts-${CACHE_VERSION}`;

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/base.css',
  './styles/layout.css',
  './styles/theme-playful.css',
  './styles/theme-editorial.css',
  './styles/theme-pixel.css',
  './js/app.js',
  './js/config.js',
  './js/dom.js',
  './js/formats.js',
  './js/icons.js',
  './js/store.js',
  './js/themes.js',
  './js/util.js',
  './js/views/common.js',
  './js/views/home.js',
  './js/views/recipe.js',
  './js/views/cook.js',
  './js/views/edit.js',
  './js/views/sheets.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon.png',
  './icons/apple-touch-icon.png'
];

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // addAll is all-or-nothing; add one by one so a single 404 cannot
    // stop the whole worker from installing.
    await Promise.all(SHELL.map((url) =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, FONT_CACHE]);
    for (const key of await caches.keys()) {
      if (!keep.has(key)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navigations always resolve to the shell: the router lives in the hash.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cached = await caches.match('./index.html', { ignoreSearch: true });
      if (cached) {
        refresh(request, SHELL_CACHE);
        return cached;
      }
      try {
        return await fetch(request);
      } catch {
        return new Response('<h1>Offline</h1><p>Open Recipe Book once while online to install it.</p>',
          { headers: { 'Content-Type': 'text/html' }, status: 503 });
      }
    })());
    return;
  }

  event.respondWith(cacheFirst(request, SHELL_CACHE));
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) {
    refresh(request, cacheName);
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(cacheName)).put(request, response.clone());
    return response;
  } catch (err) {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      // Font CSS/binaries come back opaque sometimes; cache either way.
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

/** Quietly keep the cache warm without blocking the response. */
function refresh(request, cacheName) {
  fetch(request)
    .then(async (response) => {
      if (response.ok) (await caches.open(cacheName)).put(request, response);
    })
    .catch(() => {});
}
