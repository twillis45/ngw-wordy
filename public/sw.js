/**
 * Service worker.
 *
 * The game is a static page plus one JSON file with 240 pre-solved puzzles —
 * everything it needs to run is cacheable, so offline play is essentially
 * free once the shell is warm.
 *
 * Strategy is deliberately split:
 *   • navigations  -> network-first, fall back to cache. A deploy should be
 *     picked up on the next online visit, not weeks later.
 *   • everything else -> cache-first. Next fingerprints its assets, so a
 *     cached URL is immutable and re-fetching it is pure waste.
 *
 * Bump CACHE on any change to this file so old entries get swept.
 */
/*
 * Bumped to v3 to force out the slur-bearing puzzles.json.
 *
 * This constant is part of the content fix, not bookkeeping. Assets are served
 * cache-first, and puzzles.json is NOT fingerprinted — so a cache hit never
 * revalidates, and every already-installed player would have kept serving the
 * old data forever no matter what we deployed. The version bump is the only
 * thing that actually sweeps it (see the activate handler below).
 *
 * Any future content correction must bump this too.
 */
const CACHE = 'wordy-v3';

/**
 * Where the app is mounted, derived from this file's own URL — "/" on
 * localhost and Render, "/ngw-wordy/" on GitHub Pages. Reading it here rather
 * than templating a build-time value in means one static file works at any
 * base, and the worker can never disagree with the page that registered it.
 */
const BASE = self.location.pathname.replace(/sw\.js$/, '');

// Precache only what is guaranteed to exist at every deploy. Hashed build
// assets are picked up lazily on first use.
const PRECACHE = [BASE, `${BASE}data/puzzles.json`, `${BASE}manifest.webmanifest`];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // addAll is atomic — one 404 would reject the whole install and leave
      // the worker unregistered, so tolerate individual misses.
      .then((cache) =>
        Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never touch non-GET or cross-origin traffic.
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((hit) => hit || caches.match(BASE))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        // Opaque/error responses are not worth caching.
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
