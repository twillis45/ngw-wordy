# Wordy — handoff

Read this first. It is written for a session that has none of the context.

## Where the catalogue stands

126 boards, 17 themes, on-theme rate **0.697**. 185 tests pass. Everything is
committed and pushed to `main`.

The single most useful thing to know: **on-theme rate is a proxy, not the
product.** It measures whether a row's word appears in that theme's curated
vocabulary. It caught a real disaster once, taking the catalogue from 0.216 to
0.62, and it is now being optimised past its useful range. Players experience
CLUES, not vocabulary membership. Treat 0.60 as a floor that catches generic
boards, never as a target to chase — chasing it is how a vocabulary got padded
and a rate got reported as 0.58 when the truth was 0.34.

## The four rules, and what each one cost

All are in `docs/AUTHORING.md` with the measurements attached. In short:

1. **Measure base DENSITY before authoring.** Density is how many of the
   theme's words a base's six letters can spell. A base at density 2 caps its
   board at 0.40 whatever the clues do — no rewrite, donor swap or cut moves
   it. The Road Trip and Laundry Day were authored without this and both
   landed at 0.58 with no available repair.
2. **Never pad a vocabulary to move a number.** The test: would this word be
   on-theme for a DIFFERENT pack? If yes it is texture. `mat`, `bag`, `lift`,
   `set` fit a kitchen, a garage and a laundry, so they do no work in any.
3. **Prefer a prize word that belongs to the theme** — a preference, NOT a
   gate. Using it as a gate rejects rnb90s, which sits at 0.80 and is the best
   pack in the catalogue.
4. **US English.** `tyre`, `kerb`, `bonnet`, `boot`, `peg`, `tap` all shipped
   and had to be corrected.

## The two worksheets

    node scripts/viability.mjs      # can a theme carry a pack at all?
    node scripts/prize-words.mjs    # shortlist of prize words per pack
    node scripts/prize-words.mjs 7  # what a seventh tile would offer

`viability.mjs` is the gate that should run BEFORE any authoring. It was not
run for Laundry Day or Caribbean, which is why both were written, shipped and
then found unfixable.

## Decisions already made, with evidence

- **Cut laundry and caribbean.** Measured unviable at any wheel size — laundry
  has 2 bases at density 3+, caribbean has 6, against a floor of 12. Not an
  authoring problem.
- **A base may now have ONE doubled letter.** The old six-distinct rule threw
  away 76 usable theme words. Capped at one pair because two pairs leaves four
  distinct letters, and CHURCH yields three answers total — measured.
- **A seventh letter is a net loss right now.** It roughly doubles answers per
  board (43 -> 91), which changes the product from a 1-3 board sitting into a
  Spelling Bee style hunt, and it costs a full re-tune of the wheel geometry.
  Fewer packs qualify, not more. Revisit only if session length is wanted.
- **The binding constraint is vocabulary size, not wheel size.** rnb90s reaches
  0.80 on 145 usable words. Every structural lever tried moved things less than
  vocabulary depth did.

## What is queued

1. Cut laundry and caribbean.
2. Re-base the surviving packs on real prize words. `prize-words.mjs` ranks but
   deliberately does not choose — "is this satisfying to be rewarded with" is a
   human judgement, and an auto-picking version returned PLATES for church.
   Best available today: GATHER and TALENT (cookout), ANTHEM (church), GATHER
   or SEATED (sunday), SLICED or BURIED (texas).
3. Re-run the on-theme measurement afterwards; density roughly doubled.
4. Never shipped, still open: Wing 7's veto read on The Beauty Supply clue set,
   and one real community reader per pack — budgeted before commercial ship and
   NOT yet done for any pack. See `docs/CULTURAL_BOARD.md`.

## Traps in this repo

- **The light theme is declared TWICE** — a `prefers-color-scheme` block for
  'auto' and an explicit `[data-theme='light']` block. Patching one and not the
  other has caused two separate bugs. Change both.
- **`merge-pack` now runs `check-pack` and refuses on failure.** It used to be
  advisory, and a board with an unspellable row reached the catalogue that way.
  `npm test` passed on it, because the ratchet measures on-theme RATE and an
  unsolvable row is still an on-theme row.
- **Spellability is a MULTISET question.** `canSpell` in `lib/game.ts`. A set
  check says TOTTER is spellable from COTTON. The same class of bug once turned
  45 boards into 118 and produced LOCUST, which is kept as a named regression
  case in `multiset.test.ts`.
- **Shell quoting mangles inline node scripts** (backticks, `${...}`,
  apostrophes). Write to a scratchpad file and run that. Commit messages with
  backticks get shell-evaluated — use `git commit -F file`.
- Node must be PATH-pinned: `export PATH="/usr/local/opt/node@20/bin:$PATH"`.
- Dev server: `npm run dev -- -p 3007`. Port 3000 is a different project.

## Known open bug

React #418 hydration error on cold load. Cause is now identified: the two
`<script dangerouslySetInnerHTML>` no-flash tags in `app/layout.tsx`. The
console says it plainly — "Encountered a script tag while rendering React
component". `Preferences.tsx` exists as a patch for the symptom.
