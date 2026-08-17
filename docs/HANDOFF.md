# Wordy — handoff

Read this first. It is written for a session that has none of the context.

Last verified 2026-08-15 against `main` at 0866d5f. Every number below was
measured on the day, not carried forward.

## Where the catalogue stands

**118 boards. 15 themes declared, 14 carrying boards. On-theme rate 0.710
across 590 rows. 225 tests pass in 8 files.** Working tree clean, everything
pushed to `main`, no open PRs or issues.

Reproduce the rate with `node scripts/pack-radar.mjs` — it prints per theme,
and excludes the base row the way `src/lib/catalogue.test.ts` does.

The single most useful thing to know: **on-theme rate is a proxy, not the
product.** It measures whether a row's word appears in that theme's curated
vocabulary. It caught a real disaster once, taking the catalogue from 0.216 to
0.62, and it is now being optimized past its useful range. Players experience
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
    node scripts/pack-radar.mjs     # standing health check — what to build next

`viability.mjs` is the gate that should run BEFORE any authoring. It was not
run for Laundry Day or Caribbean, which is why both were written, shipped and
then found unfixable. `pack-radar.mjs` reports and never gates, on purpose — a
check that fails the build for saying "stoop has no boards" just gets muted.

## Decisions already made, with evidence

- **Cut laundry and caribbean — DONE.** Measured unviable at any wheel size,
  and both are now gone from `data/packs/` and the corpus.
- **A base may now have ONE doubled letter.** The old six-distinct rule threw
  away 76 usable theme words. Capped at one pair because two pairs leaves four
  distinct letters, and CHURCH yields three answers total — measured.
- **A seventh letter is a net loss right now.** It roughly doubles answers per
  board (43 -> 91), which changes the product from a 1-3 board sitting into a
  Spelling Bee style hunt, and it costs a full re-tune of the wheel geometry.
  Fewer packs qualify, not more. Revisit only if session length is wanted.
- **The binding constraint is vocabulary size, not wheel size.** rnb90s reaches
  0.80 on 150 usable words. Every structural lever tried moved things less than
  vocabulary depth did.

## What is queued

1. **`stoop` is the cheapest win left.** Vocabulary already shipped — 107 usable
   words, density 159, comfortably over the floor of 12 — and ZERO boards. It is
   a theme already paid for. `tailgate` is the same shape one step further back:
   204 words, density 453, not yet in `themes.json`.
2. **Depth, not more packs, for the six shallow ones.** sitcom (50 usable
   words), spades (52), juneteenth (52), beautysupply (75), garden (82),
   steppers (89) — against ~140-150 for the packs that reach 0.80.
3. **Re-base surviving packs on real prize words.** `prize-words.mjs` ranks but
   deliberately does not choose — "is this satisfying to be rewarded with" is a
   human judgment, and an auto-picking version returned PLATES for church.
   rnb90s, garden, beautysupply, hbcu, steppers and sitcom currently carry zero
   theme-owned prize words.
4. **Never shipped, still open:** Wing 7's veto read on The Beauty Supply clue
   set, and one real community reader per pack — budgeted before commercial
   ship and NOT yet done for any pack. See `docs/CULTURAL_BOARD.md`. This is
   also store BLOCKER 1.10.

## Store readiness

`docs/STORE_READINESS.md` is the live tracker and is current. The short version:
web ships today; **Android via TWA needs a custom domain before it can start**
(see 0.3 there); iOS needs a ruling on whether it is a wrapper or a real client.
The licence work (ENABLE provenance, WordNet notice) is done.

## Traps in this repo

- **The light theme is declared TWICE** — a `prefers-color-scheme` block and an
  explicit `[data-theme='light']` block, at `globals.css:393` and `:490`, with
  a second pair for the matte accent at `:1320` and `:1370`. Patching one and
  not the other has caused two separate bugs. Change both.
- **`merge-pack` runs `check-pack` and refuses on failure.** It used to be
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

## What CI runs

Three workflows in `.github/workflows/`: `ci.yml`, `pages.yml`, `catalogue.yml`.
Beyond `npm test` and `npm run lint`, the browser-level gates are:

    npm run check:rail
    npm run check:intro       # first-run teach is shown, and ends by being acted on
    npm run check:hydration   # red-proofed: 3 of 3 loads failed before the fix

All three were added because something shipped that only a running browser could
have caught.

## Known open bugs

**None outstanding.** The React #418 hydration error that dominated this doc's
previous version is fixed and gated. Root cause was `fullscreenSupported()`
called in a render body — `false` on the server, `true` in a browser — so the
prerendered tree was thrown away on every load. It is now read through
`useSyncExternalStore` with a server snapshot of `false`. `Preferences.tsx`,
written as a patch for the symptom, is no longer load-bearing for it.

One thing is fixed but unconfirmed in production: the stale-service-worker fix
(STORE_READINESS 5.1) was verified end to end locally and **still needs one
confirmation on the live Pages deploy**.
