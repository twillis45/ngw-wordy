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
| 0.1 | **Apple Guideline 4.2 — minimum functionality** | **BLOCKER · DECIDE** | *"a repackaged website gets rejected."* A WKWebView wrapper around a web game is the single most-rejected shape on iOS. Needs native surface to survive: offline-first (have it), home-screen widget, Game Center, haptics, share sheet, push. **Decide before building anything else** — this determines whether iOS is a wrapper or a real client. |
| 0.2 | Google Play — repackaged-web is fine via TWA | TODO | Play accepts TWA. Play's equivalent risk is low. **Ship Android first** is the obvious sequencing. |

---

## 1. Legal and policy — needed by BOTH stores

| # | Item | Status | Note |
|---|---|---|---|
| 1.1 | Privacy policy, publicly hosted | **DONE?** | `/privacy` route exists in the export. Needs a read against what the app actually collects. |
| 1.2 | Terms of service | **DONE?** | `/terms` route exists. Same check. |
| 1.3 | Support URL / contact | **DONE?** | `/support` route exists. Stores require a reachable channel. |
| 1.4 | **COPPA / age gate** | **TODO** | The board's privacy seat: *"a word game will attract children whether or not it is aimed at them."* Decide the target age band before the rating questionnaires, because both stores ask and the answer changes obligations. |
| 1.5 | Apple privacy nutrition labels | TODO | Must match reality. Today: no accounts, no ads, no analytics found in the export — that is a strong, simple label. Verify before filing. |
| 1.6 | Play Data Safety form | TODO | Same content, different form. Must agree with 1.5 or it reads as a lie. |
| 1.7 | Content rating (IARC via Play, Apple age rating) | TODO | Word game, no violence. Check the wordlist question below first. |
| 1.8 | **ENABLE1 wordlist license** | **TODO** | ENABLE1 is public domain in practice; confirm and record the provenance. Ships inside the binary. |
| 1.9 | WordNet definitions license | **DONE 2026-08-14** | Correction to this row's first version: attribution WAS already present on `/support`, crediting WordNet 3.1 and ENABLE. The real gap was narrower — the licence grants permission "provided that you agree to comply with the following copyright notice and statements, including the disclaimer, and that the same appear on ALL copies". A summary does not satisfy that. The copyright notice, the AS-IS disclaimer and the name-use clause are now reproduced on `/support`. Bundled data confirmed as WordNet 3.1 (`wordnet-db@3.1.14`), so the version claim on that page was already correct. |
| 1.10 | Cultural content review | **BLOCKER** | `AGENTS.md`: *"a real reader is budgeted per pack before anything ships commercially."* Has not happened for ANY pack. Store release is the definition of commercial. |
| 1.11 | Trademark sweep on theme + clue text | TODO | Clues name real records, artists and brands. Nominative reference is normally fine; a pass is still owed. |

---

## 2. Store listing assets

| # | Item | Status | Note |
|---|---|---|---|
| 2.1 | App icon — 1024×1024 (iOS), 512×512 (Play) | TODO | `scripts/build-icons.py` exists; confirm it emits store sizes, not just PWA sizes. |
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

1. **Rule on 0.1.** iOS-as-wrapper may not be viable; that answer changes the plan.
2. Clear the remaining hard BLOCKER that is nobody's opinion: **1.10 (cultural
   reader)**. 5.1 is closed pending one confirmation on the live deploy.
3. Ship **Android via TWA first** — cheaper, likelier to pass, and it proves the pipeline.
4. Finish the licence work — 1.9 is done, **1.8 (ENABLE provenance)** remains.
   Small, and unpleasant to discover late.
5. Only then decide paid (section 4), because IAP is most of the remaining work.
