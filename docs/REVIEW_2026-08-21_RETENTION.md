# Review board — streak dates, scoring, and retention

Convened 2026-08-21. Game wing, 12 seats (roster:
`docs/REVIEW_BOARD_GAME_WING.md`). Board rules apply: **lens-not-literal**,
**measure don't eyeball**, **brutal not consensus**, and the surface scores as
its **LOWEST** dimension.

Three questions were put to the board:

1. Should the seven-day Streak row carry dates?
2. Should we add scores, points, or a leaderboard?
3. What else keeps a player coming back — and where are the gaps against
   leaders?

Two seats are real people, channelled as lenses and cited only for what they
are documented for. Ten are archetypes, standing for populations. Five of
those ten were added after a first proposal was rejected for containing no
players at all — every seat made games or audited them, and none played this
one.

---

## What was measured first

| Fact | Where |
|---|---|
| Streak cells are labelled with ONE letter, from a fixed array | `src/lib/storage.ts` `last7()` — `['S','M','T','W','T','F','S']` |
| `DayCell` carries `key`, `label`, `played` — **no date reaches the UI** | `src/lib/storage.ts:465` |
| Score is computed every board and shown for the CURRENT board only | `src/components/Rail.tsx:149` — `meta={`${score} pts`}` |
| No personal best, no history, no catalogue progress anywhere | grepped `storage.ts` — no `bestScore` / `history` |
| The challenge deep-link exists and IS wired | `src/components/Game.tsx:2993` |
| …but only from the completion sheet | same — gated behind finishing a board |
| Filed as "Data Not Collected" / "No data collected" | `STORE_READINESS` 1.5, 1.6 |
| Shipped CSP forbids any third-party call | `connect-src 'self'` |
| Catalogue | 499 boards, 118 themed, 2,994 clues |

## What the leaders actually do

Read from Mobbin screens, not from memory.

- **Duolingo** — a full DATED calendar (numbered days, month header) and a
  **Personal / Friends** split. Social comparison is scoped to friends, never
  global.
- **Vocabulary** — "You outrank 4% of learners" over a distribution curve with
  a *You* marker. A percentile against the population, **with no identities on
  screen at all**.
- **Me+** — a year heatmap plus a Record block: perfect days, best streak,
  lifetime total.
- **CapWords** — dated calendar beneath the streak count.
- **Life Reset** — level, XP to next level, and trait bars showing deltas.

The pattern across all five: **personal history is universal; a global
leaderboard is absent.** Where comparison exists it is either aggregate and
anonymous, or scoped to people you already know.

---

## Question 1 — should the Streak row carry dates?

**Ruling: yes, in the accessible name and title. No visible dates.**

- **WCAG 2.2 / mobile-a11y lead — 4/10 as it stands.** `S`/`S` and `T`/`T` are
  indistinguishable, and `DayCell` never carries a date, so no amount of
  markup can fix it downstream — the data is not there. A screen reader hears
  seven cells, two pairs of which are identical, with only a ring
  distinguishing today. **Blocking for the accessibility seat.**
- **Tufte — 7/10.** Seven 24px cells are the right density for a seven-day
  window; adding visible dates would blow the data-ink ratio for information
  the player already knows. But the letters currently encode *less* than they
  appear to: the row implies a date range and names none of it.
- **Daily-ritual player — 8/10.** "I know what day it is. I want to know
  whether I kept it." Visible dates would be noise.

**Consensus, and it is the only unanimous one in this review:** put the full
date in `DayCell`, expose it through the accessible name and `title`, leave
the visible label alone. Cheap, no layout cost, and it closes an
accessibility defect rather than a taste preference.

## Question 2 — scores, points, leaderboards?

**Ruling: build personal history. Do NOT build a global leaderboard.**

The board split, and the split is worth recording rather than smoothing.

- **Privacy counsel — blocking.** A global leaderboard needs identity and a
  server. That reopens 1.5 and 1.6, breaks `connect-src 'self'`, and converts
  a filed "no data collected" into a data-collecting product. This is not a
  feature decision; it is a **filing** decision, and it also drags COPPA into
  scope (1.4 is still open). No other seat has authority to overrule this one.
- **Josh Wardle lens — opposed.** Documented for building a game with no
  accounts, no ads, one puzzle a day, and for saying that because he *started*
  with the intention of not monetising, it stayed easy to say no. The lens
  applied here: a leaderboard is the first mechanic that makes the game about
  other people rather than the words, and the board should be honest that it
  is an engagement mechanic, not a fun one.
- **Completionist — 2/10, and the loudest finding in this review.** The game
  already computes a score on every board and shows it for the current board
  only. There is no best, no history, no sense of how much of 499 is left.
  **We are throwing away the number we already have** while debating whether
  to add a new one.
- **Group-chat player — 6/10.** "Leaderboard" here means four friends, not
  four million. The challenge link is the right shape and is buried behind
  completing a board — the one moment a player is *least* likely to want to
  stop and share.
- **Returning player — 3/10 on any ranked model.** A leaderboard ranks the
  lapsed cohort last, permanently, which is the cohort you most need back.
- **F2P economy designer — 5/10.** Points with no sink are a number going up.
  We already have a currency with a sink that works (hints). Adding a second
  scoring axis without a sink dilutes the one that functions.

**What to build instead**, in priority order and all local:

1. **Personal history** — best score, current vs. best streak, boards cleared
   out of 499. Every leader has this. No filing change. Uses data already
   stored.
2. **Surface the challenge link earlier** — it is a better 1:1 mechanic than
   Wordle's broadcast grid and it is reachable only after finishing.
3. **Anonymous percentile**, if comparison is genuinely wanted — the
   Vocabulary pattern. It can be computed from a shipped static distribution
   with no server and no identity, which keeps the CSP and both filings
   intact.

## Question 3 — what else keeps a player coming back?

Gaps against leaders, ranked by the board:

1. **No history to return to.** (Completionist, live-ops PM.) The single
   biggest gap and the cheapest to close.
2. **Absence is punished, never softened.** (Returning player.) Duolingo
   ships streak freezes. We have 499 boards and no answer to a broken streak
   beyond starting at zero.
3. **Completion is a sheet, not a moment.** (Live-ops PM, group-chat player.)
   Apple News gives a solved puzzle a full screen with time, rank and share.
   Ours closes over the board.
4. **118 themed packs are invisible as a collection.** (Completionist.) The
   catalogue is the product's pricing power and there is no progress surface
   for it.
5. **No reason to open the app on a day you do not want to play.** (Daily
   ritual.) No archive browse, no "yesterday's answers", no light-touch
   surface.
6. **The interrupted player is unmeasured.** (Interrupted player.) One-handed
   reach on the dial has never been checked, and there is an open, unresolved
   report of the wrong letters being selected while dragging.

---

## Scores

| Dimension | Score | Held by |
|---|---|---|
| Streak row — accessibility | **4/10** | WCAG lead |
| Scoring / history | **2/10** | Completionist |
| Retention surface | **3/10** | Live-ops PM |
| Privacy posture | **9/10** | Privacy counsel |
| Restraint | **9/10** | Wardle lens |
| First-run comprehension | **6/10** | First-timer |

**Surface score: 2/10** — the board scores as its lowest dimension, and the
lowest is not the leaderboard we do not have. It is the score we already
compute and never show.

## What the board did NOT decide

- **Nobody here is cited for competitive scoring fairness.** If a real
  competitive ladder is wanted, that seat is missing and was deliberately not
  filled with an adjacent famous name.
- **The F2P seat is an archetype covering a camp that could not be measured** —
  Mobbin indexes none of Wordscapes, Word Cookies or Words With Friends, and
  they are canvas-driven with no readable stylesheet. Its findings are
  reasoning, not evidence, and are marked as such.
- **Seating insider lenses is not community consent.** Unchanged, and stated
  every time.
