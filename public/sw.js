// Zim 2026 service worker — offline support.
//
// Strategy:
//   - Page navigations: network-first, falling back to the last-seen copy in the
//     runtime cache, then to /offline.html when neither is reachable.
//   - Static build assets (/_next/static, icons, fonts, images): stale-while-
//     revalidate, so they load instantly and refresh in the background.
//   - Everything else same-origin (RSC payloads, API/action GETs) and every
//     cross-origin request (Supabase REST/Realtime lives off-origin) passes
//     straight through to the network, never cached.
//
// Bump CACHE_VERSION to invalidate old caches on the next activate.

const CACHE_VERSION = "v1";
const SHELL_CACHE = `zc-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `zc-runtime-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

// Precached on install so the offline fallback is always available.
const PRECACHE_URLS = [OFFLINE_URL, "/icon.svg", "/manifest.webmanifest"];

const STATIC_EXT =
  /\.(?:js|css|woff2?|ttf|otf|eot|png|jpe?g|gif|svg|webp|avif|ico)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Let the page ask a freshly-installed worker to take over immediately.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || STATIC_EXT.test(url.pathname);
}

// Stale-while-revalidate: serve cache immediately, update it in the background.
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached || network || fetch(request);
}

// Network-first for navigations, with cache and offline-page fallbacks.
async function networkFirstNavigation(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    return offline || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GETs, and only our own origin — leave Supabase and mutations alone.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
  // Anything else (RSC payloads, API GETs) falls through to the network.
});
