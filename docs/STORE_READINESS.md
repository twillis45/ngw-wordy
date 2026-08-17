# Store readiness — Apple App Store + Google Play

Tracker. Started 2026-08-12. Status values: **BLOCKER** (ships nothing until
fixed) · **TODO** · **DONE** · **DECIDE** (needs a human ruling).

Wordy today is a Next.js static export deployed to GitHub Pages. Neither store
accepts a URL, so everything below assumes a wrapper: **TWA** (Trusted Web
Activity, via Bubblewrap) for Play, **Capacitor** or a WKWebView shell for iOS.

---

## 0. The one that decides whether this is worth starting

| # | Item | Status | Note |
|---|---|---|---|
| 0.1 | **Apple Guideline 4.2 — minimum functionality** | **BLOCKER · DECIDE** | *"a repackaged website gets rejected."* A WKWebView wrapper around a web game is the single most-rejected shape on iOS. Needs native surface to survive: offline-first (have it), home-screen widget, Game Center, haptics, share sheet, push. **Decide before building anything else** — this determines whether iOS is a wrapper or a real client. **Intent stated 2026-08-15: all three surfaces are wanted (web + Play + App Store).** That settles *whether*, not *what shape* — see the audit in 0.4. |
| 0.2 | Google Play — repackaged-web is fine via TWA | TODO — **gated by 0.3** | Play accepts TWA. Play's equivalent risk is low. **Ship Android first** is the obvious sequencing — but it cannot start until 0.3 is closed. |
| 0.3 | **A custom domain is a hard prerequisite for TWA** | **BLOCKER — newly found 2026-08-15** | A TWA proves it owns its web content with a Digital Asset Links file at **`https://<domain>/.well-known/assetlinks.json` — the ORIGIN root, not the app's sub-path.** Today the app is served from `https://twillis45.github.io/ngw-wordy/` (confirmed via the Pages API; `cname` is null, no `public/CNAME`). That well-known path belongs to the *`twillis45.github.io` user-pages repo*, not this one, so this repo structurally cannot publish it. `github.io` is also on the Public Suffix List, which is not a domain to anchor app identity to. Unverified, a TWA falls back to Custom-Tab UI **with a visible address bar** — which is precisely the "repackaged website" read we are trying to avoid, on the store that was supposed to be the easy one. Buy the domain and point Pages at it; it is cheap and it unblocks Play, iOS universal links, and the `start_url`/`id` migration the manifest already anticipates. |
| 0.4 | **What native surface already exists** | note, 2026-08-15 | Audited against the source, because the 4.2 argument turns on it and the tracker had never written it down. Present today, in the web app: real iOS **Taptic haptics** (`lib/feedback.ts` — the iOS 18 hidden `<input switch>` trick, since Safari exposes no haptic API, with an 8-signal rhythm vocabulary designed to be legible with the screen off), synthesized **WebAudio** with a limiter on the bus, **share sheet** via `navigator.share` with clipboard fallback, **offline-first** service worker, `display: 'fullscreen'` with maskable icons, and **optional end-to-end-encrypted sync** with no account and no server-readable progress (`lib/sync.ts`). This is materially more than a webview around a page — but 4.2 is judged on the **binary**, and none of it is native code. |

---

## 1. Legal and policy — needed by BOTH stores

| # | Item | Status | Note |
|---|---|---|---|
| 1.1 | Privacy policy, publicly hosted | **DONE 2026-08-16** | Read against the code rather than taken on trust, and it holds. Two things were wrong and are fixed. (a) The page claimed Wordy "makes no network requests to anyone once the page has loaded" — literally false: it fetches its own `/data/definitions.json` and the worker fetches its own assets. The claim now says what is actually true and is still the strong version — no requests to any *third party*, only its own files from the address you loaded it from. An untrue sentence is a liability precisely because the rest of this posture is genuinely excellent. (b) The date read `10 August 2026`; house style is US format. |
| 1.2 | Terms of service | **DONE 2026-08-16** | `/terms` read; no claims that contradict the code. Date format corrected. |
| 1.3 | Support URL / contact | **DONE 2026-08-16** | `/support` read; reachable channel present, and it carries the WordNet notice required by 1.9. Date format corrected. |
| 1.4 | **COPPA / age gate** | **TODO** | The board's privacy seat: *"a word game will attract children whether or not it is aimed at them."* Decide the target age band before the rating questionnaires, because both stores ask and the answer changes obligations. |
| 1.5 | Apple privacy nutrition labels | **ANSWERED 2026-08-16 — file as "Data Not Collected"** | Measured, not assumed. Zero analytics/tracker SDKs in source or export (searched gtag, GA, GTM, Segment, Mixpanel, Amplitude, PostHog, Sentry, Bugsnag, Firebase, Meta, Hotjar, Plausible, DoubleClick — the only hit was a code comment). Three runtime dependencies total: `next`, `react`, `react-dom`. Four `fetch` sites exist and none reach a third party in a shipped build: two are the optional sync, which is off unless `NEXT_PUBLIC_SYNC_URL` is set and the deploy never sets it; one is same-origin `/data/definitions.json`; the fourth is `api.dictionaryapi.dev` behind `MODERN_UPGRADE_ENABLED = false`, disabled deliberately and documented in `definitions.ts`. The shipped CSP is the backstop and makes it structural rather than a promise: **`connect-src 'self'`**. |
| 1.6 | Play Data Safety form | **ANSWERED 2026-08-16 — "No data collected"** | Same measurement as 1.5, and it must stay in step with it. On-device `localStorage` keys (progress, streak, hints, theme, accent, reading mode, fullscreen) are **storage, not collection** — nothing transmits them. |
| 1.7 | Content rating (IARC via Play, Apple age rating) | TODO | Word game, no violence. Check the wordlist question below first. |
| 1.8 | **ENABLE1 wordlist license** | **DONE 2026-08-14 — one question left for the attorney** | Recorded in `data/enable1.PROVENANCE.md`. What ships is ENABLE 1.x, 172,823 words, sha256 `3f161302…`, byte-identical to the widely mirrored copy — re-downloaded and compared on the day. The project's own readme releases it: *"The ENABLE master word list, WORD.LST, is herewith formally released into the Public Domain."* Three things stay soft and are written down rather than smoothed over: the permission is not IN the file (172,823 bare words, no header, no notice), the readme quoted is the ENABLE2K edition and describes a later revision of the same master list, and a public-domain dedication is a claim about a jurisdiction — some do not let an author abandon copyright, and neither store limits distribution by territory. A hash cannot close that last one; ask the attorney already reading the filing whether a CC0 fallback is wanted. `src/lib/content.test.ts` asserts the hash and the count, so the vetted file is the file that ships. |
| 1.9 | WordNet definitions license | **DONE 2026-08-14** | Correction to this row's first version: attribution WAS already present on `/support`, crediting WordNet 3.1 and ENABLE. The real gap was narrower — the licence grants permission "provided that you agree to comply with the following copyright notice and statements, including the disclaimer, and that the same appear on ALL copies". A summary does not satisfy that. The copyright notice, the AS-IS disclaimer and the name-use clause are now reproduced on `/support`. Bundled data confirmed as WordNet 3.1 (`wordnet-db@3.1.14`), so the version claim on that page was already correct. |
| 1.10 | Cultural content review | **BLOCKER** | `AGENTS.md`: *"a real reader is budgeted per pack before anything ships commercially."* Has not happened for ANY pack. Store release is the definition of commercial. |
| 1.11 | Trademark sweep on the NAME, and on theme + clue text | **PARTIAL 2026-08-16 — knockout done, clearance owed** | Two separate jobs; only the first has moved. **The name:** run on USPTO's live search, with a control query to prove the syntax returned results at all. `WM:"six on the dial"` → **0 results** (stopwords drop, so this searched marks containing both *six* and *dial*, live and dead). Control `WM:"wordy"` → 37, which also settles the old name: **WORDY is LIVE/PENDING in Class 009 for "downloadable software in the nature of a mobile application", owned by Wordy Plus LLC** — the exact goods this app is. That is a knockout search, **not clearance**: it does not cover confusingly-similar marks, common-law rights, or state registrations, and it is not a legal opinion. Send it to the attorney already engaged on 1.8 — one engagement, two questions. **Do not buy the domain until this closes**; the point of clearing first is not to pay for an asset that must be abandoned. **Clue text:** untouched. Clues name real records, artists and brands; nominative reference is normally fine, but the pass is still owed. |

---

## 2. Store listing assets

| # | Item | Status | Note |
|---|---|---|---|
| 2.1 | App icon — 1024×1024 (iOS), 512×512 (Play) | **DONE 2026-08-16** | Confirmed the suspicion in this row's first version: the script emitted PWA sizes only (192, 512, maskable pair, 180). Play's 512 was already covered by `icon-512.png`; **Apple's 1024 was missing entirely.** `build-icons.py` now also emits `store/app-store-icon-1024.png` — verified 1024×1024, mode RGB, **no alpha**, which App Store Connect rejects. Written outside `public/` on purpose: store art is uploaded, never served, and `public/` is the deploy artifact. Note the repo's Pillow is an x86_64 build on an arm64 machine and `npm run icons` fails on `import PIL`; that is a pre-existing environment problem, not a script one. |
| 2.2 | Play feature graphic 1024×500 | TODO | Play-only, required. |
| 2.3 | iPhone screenshots (6.7" and 6.5" required) | TODO | Can be captured from the render harness at the right viewports. |
| 2.4 | iPad screenshots | TODO | Only if the iOS build declares iPad support. Cheaper to ship iPhone-only first. |
| 2.5 | Play phone/tablet screenshots (2–8) | TODO | Same source. |
| 2.6 | Description, subtitle, keywords | TODO | |
| 2.7 | Privacy-policy URL in both listings | TODO | Points at 1.1. |

---

## 3. Build and release engineering

| # | Item | Status | Note |
|---|---|---|---|
| 3.1 | Apple Developer Program — $99/yr | TODO | Enrollment can take days. Start early. |
| 3.2 | Google Play Developer — $25 once | TODO | Plus identity verification, which now takes real time. |
| 3.3 | Play target API level | TODO | Play enforces a rolling minimum; check the current deadline at build time. |
| 3.4 | Version + build numbering scheme | TODO | Neither store lets you reuse a build number. |
| 3.5 | Crash reporting | TODO | There is none today. A store build without it is blind. |
| 3.6 | **PWA update path inside a wrapper** | **TODO — see 5.1** | The hard problem for a webview-derived binary: which layer updates, and how does a user escape a bad cache. |
| 3.7 | Staged rollout + rollback plan | TODO | |

---

## 4. Monetization — only if the paid packs ship

| # | Item | Status | Note |
|---|---|---|---|
| 4.1 | **Digital goods MUST use IAP / Play Billing** | **BLOCKER if paid** | Approved pricing is $16.99 / $29.99-yr for 218 boards. Taking that any other way in-app is an instant rejection on both stores. |
| 4.2 | Restore purchases | TODO | Apple requires it explicitly. |
| 4.3 | Receipt validation | TODO | Today all state is localStorage, which a user can edit. Entitlement cannot live there. |
| 4.4 | Price tiers, tax, payouts | TODO | |
| 4.5 | Subscription terms shown before purchase | TODO | Both stores check the wording. |

---

## 5. Findings from the 2026-08-12 smoke test that block or endanger release

| # | Item | Status | Note |
|---|---|---|---|
| 5.1 | Service worker served a stale build | **FIXED 2026-08-14 — verify on the live deploy** | Three causes, all closed: the cache name was hand-edited and is now stamped from a content hash at build time (`scripts/stamp-sw.mjs`); `fetch()` on navigations went through the HTTP cache, so "network-first" degraded to "whatever the browser kept", and now passes `cache: 'no-store'`; and a new worker took over without the open document reloading, which `ServiceWorker.tsx` now handles on `controllerchange`. Verified end to end: one normal reload picks up a new build. **Still to confirm on the live Pages deploy**, since every measurement here was local. |
| 5.1a | I twice reported 5.1 as unfixed when it was working | note | Worth recording as a testing lesson, not a code one. I verified by unregistering the worker and clearing caches, which leaves `navigator.serviceWorker.controller` null — so `hadController` is false and the auto-reload is *correctly* suppressed. The test method defeated the fix and I read that as the fix failing. A hard refresh cannot verify a soft-refresh path. |
| 5.2 | First-run stall offer fired at 39s with zero interaction | **FIXED 2026-08-12** | Measured on the production export: a brand-new player who had touched nothing was told "Stuck? I'll open the 3-letter one. Costs 3 hints. You have 3." The clock now starts on first action. Would have read badly to a reviewer and is a Grandmother-veto condition. |
| 5.3 | ~~No first-run explainer appears~~ | **RETRACTED 2026-08-14** | The finding was wrong, and wrong because it was looked at rather than measured. Probed on the production export at 390×844, cold profile: the teach ("Six letters. Six words. All from the wheel.") IS shown, and is gone after one banked word with `seenIntro` true. It is also demonstrably a decision — `storage.ts` names the flag, `backup.ts` carries it through a device change, and `Game.tsx` records the ruling that the teach "should end by being acted on rather than by being clicked away". `npm run check:intro` asserts both halves and was red-proofed. Nothing here to decide. |
| 5.4 | ~~React hydration mismatch on every page load~~ | **FIXED 2026-08-14** | Root cause was one call in a render body: `fullscreenSupported()` answers `false` on the server and `true` in a browser, so `{fullscreenSupported() && <button/>}` put a header button in the client tree that the prerendered HTML did not have. React could not reconcile the header and regenerated the whole tree — the prerender was being built and thrown away on every load. Now read through `useSyncExternalStore` with a server snapshot of `false`, which is what that hook is for: hydrate matching the HTML, then re-render with the real answer. Verified: absent from the served HTML, present in the DOM after mount on a browser that supports it, and the button still works. Gated by `npm run check:hydration` — red-proofed, 3 of 3 loads failed before the fix. |

---

## Suggested order

Revised 2026-08-15, now that all three surfaces are wanted.

1. **Clear the name (1.11), then buy the domain (0.3).** The domain is still the
   smallest action with the largest unblock — it gates Play, iOS universal links,
   and moving off the Pages sub-path — but clearance now comes first. The
   knockout search is clean and the review board declined to bless the name on a
   knockout alone, which is the right call: a domain bought ahead of clearance is
   an asset that may have to be abandoned. One attorney engagement covers this
   and the 1.8 question together.
2. **Start the two enrollments (3.1, 3.2).** Apple is $99/yr, Play is $25 once,
   and both take real calendar time for identity verification. They are pure
   waiting, so they should be waiting in the background from day one.
3. **Confirm 5.1 on the live deploy.** One reload on the real Pages URL. Every
   measurement behind that fix was local.
4. **Clear 1.10 (cultural reader).** The one hard blocker that is nobody's
   opinion and that no amount of engineering closes. Store release is the
   definition of commercial ship, and it has not happened for ANY pack. It gates
   release on *every* surface, so it should be running in parallel from now.
5. **Ship Android via TWA.** Cheapest, likeliest to pass, and it proves the
   release pipeline end to end before iOS raises the stakes.
6. **Then iOS, and not as a bare wrapper** — see 0.1 and 0.4. The web app
   already has haptics, share, offline and fullscreen; what it does not have is
   native code, and 4.2 is judged on the binary.
7. Licence work is done — 1.9 (WordNet notice) and 1.8 (ENABLE provenance) are
   both recorded. One question rides along to the attorney: whether a 1997 US
   public-domain dedication wants a CC0 fallback for territories that do not
   recognize abandonment.
8. Only then decide paid (section 4), because IAP is most of the remaining work
   — and note 4.3 forces a native layer on iOS regardless of what 0.1 decides.
