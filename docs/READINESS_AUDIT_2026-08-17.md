# Readiness audit — the road to a 10+ bless

Full bench, soup to nuts. Run 2026-08-17 against `main` + `store-rows-measured`.

Method per `docs/REVIEW_BOARD_GAME_WING.md`: **render first** — 42 artifacts,
7 viewports × 6 states, captured from the PRODUCTION export on :4310, not the
dev server. Wings were scored inline rather than one agent per wing. Every
number below was measured; where a thing could not be measured it says so.

**Surface score = the LOWEST dimension. Bless = 10+.**

## Scores

| # | Wing | Score | What decides it |
|---|---|---|---|
| 1 | Game design & core loop | 8 | Loop is sound; the authored clue is the moat |
| 2 | Layout & visual hierarchy | 9 | Rail holds at all 5 viewports |
| 3 | Interaction, motion & feel | 9 | Haptic vocabulary is genuinely exceptional |
| 4 | Onboarding & first run | 9 | Teach is gated and red-proofed; no Grandmother veto |
| 5 | Accessibility | 9 | 0 contrast failures across 3 themes |
| 6 | Monetization & pay | **3** | Nothing built. Only binding if paid ships |
| 7 | Store readiness & release | **5** | Domain unbought, nothing enrolled, no crash reporting |
| 8 | Security, privacy & IP | 8 | `connect-src 'self'`; clue-text TM pass still owed |
| 9 | **Cultural authenticity** | **2** | **Zero readers, any pack. Holds a BLOCK.** |
| 10 | Live ops & retention | **5** | 3.2 months of daily, then it repeats |

### Surface score: **2 / 10**

Not blessed, and not close — but the shape of the gap is the useful part.

---

## The finding that matters most

**Six of ten wings are already at 8–9. Every one of the four low scores is
procurement or a decision, not code.**

Nothing in wings 1–5 or 8 needs building. The craft is there. What is missing is
a reader, a domain, two developer accounts, and a ruling.

That also means **effort spent on polish right now cannot raise the surface
score at all**, because the surface scores as its lowest dimension and the
lowest dimension is a hiring decision.

---

## Wing 9 — Cultural authenticity · 2/10 · BLOCKS

`AGENTS.md` and `docs/CULTURAL_BOARD.md` both state it: structured perspective is
**not** community consultation, and *"a real reader is budgeted per pack before
anything ships commercially."* That has not happened for **any** of the 12
culturally-specific packs, and store release is the definition of commercial.

This is the whole audit. Everything else is negotiable; this is the seat that
holds a block.

**It is also per-pack, which is the way out.** You do not need twelve readers to
ship — you need readers for the packs you ship:

| clear only | daily pool | repeats after |
|---|---|---|
| cookout | 15 | 0.5 mo |
| + rnb90s | 27 | 0.9 mo |
| **+ church** | **39** | **1.3 mo** |
| + beautysupply | 48 | 1.6 mo |

Three readers buys a 39-board daily rotation with the authored clues intact.
Gate the other nine behind a flag rather than deleting them.

## Wing 10 — Live ops · 5/10

Measured: the daily pool is **98 boards — 3.2 months before it repeats.**
`dailyPoolSize()` counts only daily-eligible themed boards, and
`GENERAL_THEMES = ['roadtrip','garden','diner','hardware']` means everything
else is cultural by design.

The leaders — Wordle, Spelling Bee, Connections, Strands — ship one a day and
never repeat. 98 survives a launch. It does not survive a year, and there is no
content cadence behind it.

Zero notification code. For a daily game that is a missing re-engagement hook —
though Wardle's seat would call it a virtue, and this bench seats him. The real
cost is that **there is no analytics either**, by deliberate design, so day-30
behavior will be invisible. That is a defensible privacy posture and an
uncomfortable live-ops position, and the tension should be chosen on purpose.

## Wing 6 — Monetization · 3/10 · deletable

Zero purchase, entitlement, billing or restore-purchase code exists. Approved
pricing ($16.99 / $29.99-yr for 218 boards) has nothing behind it, and 4.3 is
correct that entitlement cannot live in `localStorage`, which is where all state
lives today.

**Ship free first and this wing stops counting.** That is the single cheapest
move available: it deletes all of section 4 from the blocker set without
building anything.

## Wing 7 — Store readiness · 5/10

Closed 2026-08-16: privacy policy read against the code (1.1–1.3), both store
data forms answered from measurement (1.5/1.6), App Store 1024 icon emitted
(2.1), ENABLE and WordNet licences recorded (1.8/1.9).

Still open: **0.1** iOS wrapper-vs-client unruled · **0.3** domain unbought
(gates Play entirely) · **3.1/3.2** neither account enrolled · **3.5** no crash
reporting, so a store build ships blind · **3.6** PWA update path inside a
wrapper.

## Wings 1–5, 8 — the half that is already done

**W5 Accessibility · 9.** Measured, with a corrected instrument — see below.
0 contrast failures in **all three themes**; tightest ratios 6.41 (light), 5.92
(dark), 5.69 (studio) against a 4.5 requirement. Reduced motion is the correct
universal `*, ::before, ::after` override covering all 29 animated elements. 22
focusables, no positive tabindex, visible focus ring, zoom not blocked, `lang`
set. CVD is handled by design rather than by hue: a solved row replaces its digit
with the revealed word, and the prize row is marked by size and weight.
*Residual:* every interactive target sits at 24×24 — passing WCAG 2.2 AA exactly
on the line, and none reach Apple's 44pt guidance. Plus the documented 1.4.11
border exception at 2.05, which rests on that redundant encoding.

**W3 Interaction & feel · 9.** The haptic vocabulary is the best-engineered thing
in the repo: eight named rhythms derived from **one** description so the two
platforms cannot drift, with the invariant asserted in a test, and an iOS path
that gets real Taptic out of Safari — which exposes no haptic API — via a hidden
`<input switch>`. WebAudio runs through a limiter because the biggest moment in
the game was the one most likely to clip.

**W2 Hierarchy · 9.** `check:rail` passes at all 5 viewports. The naive
monotonic-decrease audit flags the h1 at 12px against 17px body — but the h1 is
the wordmark and the tiles are 40.8px. The board is the subject and the chrome is
chrome; the rank model was wrong, not the design.

**W4 First run · 9.** `check:intro` and `check:rail` both pass and were
red-proofed. The teach retires by being acted on rather than clicked away.

**W8 Security & IP · 8.** `connect-src 'self'` makes third-party transmission
structurally impossible; three runtime dependencies; no trackers. *Residual:* the
clue-text trademark pass (1.11's second half) is untouched, and 1.4 COPPA is
undecided.

---

## Two method corrections, recorded because they nearly became findings

**The contrast audit was wrong twice before it was right.** First pass reported
19 light-mode failures including letter tiles at 1.09:1, which would have made
the game unusable. The rendered artifact showed obvious black-on-pale. Two
separate causes:

1. Flipping `data-theme` at runtime produces a hybrid state — exactly the
   two-declaration trap `HANDOFF.md` warns about. Only a reload, letting the
   no-flash script run before paint, gives a true reading.
2. The parser read `color(srgb 0.84 0.88 0.92 / 0.82)` — CSS Color Level 4, with
   components on 0–1 — as if it were 0–255, turning every pale background
   near-black. Fixed to handle both notations and to composite alpha up the
   ancestor chain.

This is the same shape as the retraction in STORE_READINESS **5.1a**: the test
method defeated the measurement, and the confident wrong answer looked exactly
like a real finding. A contrast checker that cannot parse the color syntax the
app actually ships is worse than no checker.

**The stored theme was `studio`,** left over from the capture harness seeding
localStorage — so the first "light mode" reading was not light mode at all.

---

## The ordered path to 10+

1. **Commission three readers** (cookout, rnb90s, church). Nothing else moves the
   surface score, because nothing else is the lowest dimension. Long lead time —
   start before anything else.
2. **Ship free.** Deletes wing 6 from the count outright.
3. **Clear the name, buy the domain, enroll both accounts.** Unblocks wing 7;
   mostly calendar time, so it runs in parallel with 1.
4. **Add crash reporting** — the one real code gap in wing 7, and a store build
   without it is blind.
5. **Decide the live-ops posture** (wing 10): a content cadence past 3.2 months,
   and whether shipping with no analytics at all is a choice you are making or
   one you are drifting into.
6. Only then polish. Wings 1–5 and 8 are at 8–9 and are not what is holding the
   bless.
