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
| 1.9 | **WordNet definitions license** | **TODO** | `data/wordnet.json`. WordNet's license is permissive and REQUIRES an attribution notice. Not present in the UI as far as this pass found — likely an actual compliance gap. |
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
| 5.1 | **Service worker serves a stale build** | **BLOCKER** | Observed twice in one session: the live GitHub Pages site rendered a build old enough to predate clue mode, and locally the browser kept serving pre-rebuild CSS until the SW was unregistered and caches cleared by hand. In a store binary this is worse — a shipped bad cache cannot be fixed by a redeploy, and support has no "clear your cache" instruction to give. Needs a versioned cache with a skipWaiting/refresh path, and a visible "update available" affordance. |
| 5.2 | First-run stall offer fired at 39s with zero interaction | **FIXED 2026-08-12** | Measured on the production export: a brand-new player who had touched nothing was told "Stuck? I'll open the 3-letter one. Costs 3 hints. You have 3." The clock now starts on first action. Would have read badly to a reviewer and is a Grandmother-veto condition. |
| 5.3 | No first-run explainer appears | **DECIDE** | Measured: no intro on a cleared profile. The one-line teach ("Six letters. Six words. All from the wheel.") may be enough — that is a defensible Wardle-style restraint — but it is currently an accident rather than a decision. |

---

## Suggested order

1. **Rule on 0.1.** iOS-as-wrapper may not be viable; that answer changes the plan.
2. Clear the two real BLOCKERS that are nobody's opinion: **5.1 (stale cache)** and **1.10 (cultural reader)**.
3. Ship **Android via TWA first** — cheaper, likelier to pass, and it proves the pipeline.
4. Do the licence work (1.8, 1.9) — small, and unpleasant to discover late.
5. Only then decide paid (section 4), because IAP is most of the remaining work.
