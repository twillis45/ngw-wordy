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
/*
 * STAMPED AT BUILD TIME. `scripts/stamp-sw.mjs` replaces the placeholder with
 * a hash of the built asset names, so every deploy that changes anything gets
 * a new cache and the activate handler sweeps the old one.
 *
 * It was a hand-edited constant, and the comment above admits the failure mode
 * — "any future content correction must bump this too", i.e. a correctness
 * guarantee resting on somebody remembering. It was not remembered: a live
 * build and a local rebuild both kept serving superseded assets in one session
 * until the worker was unregistered by hand. A player cannot do that, and a
 * store binary cannot be fixed by redeploying, which is why this is stamped
 * rather than typed.
 *
 * The literal below is the DEV fallback: unstamped (running from source, or a
 * build that skipped the script) behaves exactly as before.
 */
const CACHE = '__BUILD_ID__'.startsWith('__') ? 'wordy-dev' : '__BUILD_ID__';

/**
 * Where the app is mounted, derived from this file's own URL — "/" on
 * localhost and Render, "/sixonthedial/" on GitHub Pages. Reading it here rather
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
      /*
       * `cache: 'no-store'` — network-first has to mean the NETWORK.
       *
       * A bare fetch() still goes through the HTTP cache, so a document served
       * with any max-age comes back from disk without touching the server, and
       * "network-first" quietly degrades to "whatever the browser kept".
       * GitHub Pages sends max-age on HTML, which is exactly the shape of the
       * staleness seen live. The document is one small request; spending it is
       * the whole point of this branch.
       */
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          /*
           * Only cache a navigation that actually SUCCEEDED.
           *
           * This used to put any resolved response into the cache — an HTTP
           * error is not a rejected fetch, so a 404, a 500, a maintenance page
           * or a captive-portal interstitial all became the offline shell, and
           * stayed the offline shell. Only the network-failure path was
           * guarded. Same discipline the asset branch already applies below.
           */
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((hit) => hit || caches.match(BASE))
        )
    );
    return;
  }

  /*
   * Data files get stale-while-revalidate, not cache-first.
   *
   * The cache-first rule is justified by Next fingerprinting its assets — true
   * for /_next/static/*, and false for /data/*.json, which are stable URLs. So
   * a cache hit never revalidated them, and a content correction could not
   * reach anyone already installed except via a CACHE version bump that
   * somebody has to remember. Serve the copy we have, refresh it in the
   * background, and the next load is current.
   */
  if (/\/data\/[^/]+\.json$/.test(new URL(request.url).pathname)) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(request).then((hit) => {
          const fresh = fetch(request)
            .then((response) => {
              if (response && response.ok && response.type === 'basic') {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => hit);
          return hit || fresh;
        })
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
