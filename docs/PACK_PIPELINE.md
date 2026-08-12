# Pack pipeline — candidate themes and where each one stands

Working tracker for new packs. Updated 2026-08-12.

## Where this list came from — read this first

**These candidates are editorial judgement plus seasonality, not scraped trend
data.** One web search for word-game pack trends was run and returned only
generic copy ("themed packs including music, movies and geography appeal to
different interests") — nothing that names a category or ranks one. So nothing
below is sourced from a trend feed, and no number in the "why now" column is a
measurement of popularity.

What IS measured is the right-hand side: whether a theme can carry a pack at
all. That is the column to trust.

## The gate

`node scripts/viability.mjs` — **12 bases at density 3+**. Density is how many
of the theme's words a base's six letters can spell. Nothing else is a gate:
an on-theme prize word is a preference, and the script used to gate on it,
which failed six shipped packs including the best one. Fixed 2026-08-12.

## The finding that governs everything here

**Depth is the lever, not the theme.** Round 1 drafted ~35 words per theme and
*every candidate failed*. The same themes at ~140 words all passed:

| theme | 35-word draft | ~140-word draft |
|---|---|---|
| gym | 15 | **206** |
| tailgate | 11 | **152** |
| fishfry | 10 | **123** |
| gogo | 11 | **70** |

A 4x vocabulary bought a 14x density. Round 1 was measuring the draft, not the
theme — so a "no" from a thin vocabulary means nothing. Deepen, then judge.

Second-order: depth also buys BOARDS, not just density. Tailgate at 148 words
offered 8 usable boards; at 207 words it offered 20, and gained its first
on-theme prize word (STRIPE).

## Status

| theme | shelf | density | boards free | gate | status |
|---|---|---|---|---|---|
| **tailgate** | The Table | **453** | 14 at 3+ | PASS | **authoring now** |
| **stoop** | The Block | 159 | — | PASS | vocabulary shipped, **0 boards** — cheapest win left |
| gym | Elsewhere | 206 | — | PASS | measured, queued. No shelf fits it well |
| fishfry | The Table | 123 | — | PASS | measured, queued. CULTURAL — bench + reader first |
| gogo | The Soundtrack | 70 | — | PASS | measured, queued. CULTURAL — bench + reader first |
| thrift | Elsewhere | 7 @35w | — | untested deep | deepen to ~140 before judging |
| school | Elsewhere | 6 @35w | — | untested deep | seasonal (August); deepen first |
| sneaker | The Block | 5 @35w | — | untested deep | deepen first |
| skincare | Elsewhere | 4 @35w | — | untested deep | deepen first |
| reunion | The Table | 4 @35w | — | untested deep | CULTURAL. Bench signed the NAME already |
| beach | The Long Way | 3 @35w | — | untested deep | deepen first |
| kitchen | The Table | 3 @35w | — | untested deep | bench REFUSED this one before |
| salon | The Block | 2 @35w | — | untested deep | CULTURAL. Bench signed the name |
| coffee | Elsewhere | 0 @35w | — | untested deep | weakest draft; may genuinely not carry |

Every "@35w" number is a thin-draft score and is **not** evidence the theme
fails. See the finding above.

## The shelf ceiling is a real constraint

Five named shelves plus `Elsewhere`, and the comment in `game.ts` records a
standing veto on a sixth. A theme with no shelf is a theme with nowhere to
live, which is why gym — the densest candidate measured — is queued behind
tailgate rather than ahead of it.

## Cultural packs cost more

Per `AGENTS.md` and `docs/CULTURAL_BOARD.md`: a cultural vocabulary needs bench
sign-off BEFORE scoring, and one real community reader per pack before
commercial ship. That reader is budgeted and has **not** happened for any pack.
General packs (tailgate, gym, thrift, school, sneaker, skincare, beach, coffee)
carry no such gate, which is why the first new pack is a general one.

## Order of work

1. **tailgate** — authoring now. General, fits The Table, timed to the season.
2. **stoop** — vocabulary already shipped and scores 159 with zero boards. It
   is a theme sitting in `themes.json` doing nothing.
3. **gym** — densest measured candidate; needs a shelf answer first.
4. Deepen the untested drafts to ~140 words and re-measure as a batch.
5. Cultural queue (fishfry, gogo, reunion, salon) behind the bench.
