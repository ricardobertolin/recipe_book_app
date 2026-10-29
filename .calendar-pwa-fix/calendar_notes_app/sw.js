/* Retro Notes service worker.
   Everything the app needs is same-origin and precached, so it opens offline and
   instantly with its real fonts. Bump SHELL_CACHE on every deploy: install
   refetches the shell, activate drops the old one, and the page reloads itself
   once the new worker takes control (see the controllerchange handler in app.js). */
'use strict';

var SHELL_CACHE = 'retronotes-shell-v2';

var SHELL = [
  './',
  './index.html',
  './styles.css',
  './fonts.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon-180.png',
  './fonts/v18-pxiKyp0ihIEF2isRFJXGdg.woff2',
  './fonts/v18-pxiKyp0ihIEF2isfFJU.woff2',
  './fonts/v20--F63fjptAgt5VM-kVkqdyU8n1i8q1w.woff2',
  './fonts/v20--F63fjptAgt5VM-kVkqdyU8n1iEq129k.woff2',
  './fonts/v20--F6qfjptAgt5VM-kVkqdyU8n3twJwl5FgtIU.woff2',
  './fonts/v20--F6qfjptAgt5VM-kVkqdyU8n3twJwlBFgg.woff2',
  './fonts/v20--F6qfjptAgt5VM-kVkqdyU8n3vAOwl5FgtIU.woff2',
  './fonts/v20--F6qfjptAgt5VM-kVkqdyU8n3vAOwlBFgg.woff2'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SHELL_CACHE).then(function (c) {
      // addAll is all-or-nothing; request each so one bad path cannot
      // leave the app with no cache at all.
      return Promise.all(SHELL.map(function (url) {
        return c.add(new Request(url, { cache: 'reload' })).catch(function () { });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== SHELL_CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

// respondWith() must never settle on undefined — that surfaces as a hard
// ERR_FAILED rather than a normal network error, so misses get a real Response.
var OFFLINE = function () {
  return new Response('', { status: 504, statusText: 'Offline' });
};

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;

  // Navigations: try the network so a fresh deploy is picked up, fall back to
  // the cached shell when offline. Query strings (?new=1) must not miss.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(SHELL_CACHE).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html', { ignoreSearch: true }).then(function (hit) {
          return hit || caches.match('./').then(function (h2) { return h2 || OFFLINE(); });
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.open(SHELL_CACHE).then(function (c) {
      return c.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          if (res && res.ok) c.put(req, res.clone());
          return res;
        }).catch(OFFLINE);
      });
    })
  );
});
