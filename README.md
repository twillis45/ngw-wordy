# Wordy

Six letters. How many words can you make?

Mobile-first PWA-ready word game in **Studio Matte** — the locked carbon +
steel-blue palette from `ngw-event-planner`
(`demo/src/theme/palette.js`, Standard Carbon dark mode).

## Running it

This repo needs Node ≥ 20. The machine default is 16, so pin it:

```bash
export PATH=/usr/local/opt/node@20/bin:$PATH
```

```bash
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Production build (fully static) |
| `npm test` | Engine tests (vitest) |
| `npm run puzzles` | Regenerate `public/data/puzzles.json` |
| `npm run lint` | ESLint |

## How it works

**Puzzles are solved at build time.** `scripts/build-puzzles.mjs` reads
`data/enable1.txt` (172k words) and emits 240 puzzles, each carrying its own
complete answer set. The client never ships a dictionary — validating a word
is a set lookup, so there is no network round-trip and no perceptible latency.
The whole file is 92 KB.

Each puzzle is 6 distinct letters drawn from a 6-letter base word:

- **grid** — 6 target words, always including the base. These are the blanks
  you're filling.
- **bonus** — every *other* word the letters can make (~38 more). These still
  score, and every 3 of them earns a hint. This is the retention engine that
  Wordscapes and Word Cookies both run on.

**The daily puzzle is a pure function of the date** (`dailyIndex`), so every
player gets the same letters with no server involved.

### Architecture notes

- `src/lib/game.ts` — the whole rule set, pure and dependency-free. Scoring,
  ranks, submission classification, the share card. All 22 tests hit this file.
- `src/lib/storage.ts` — a `useSyncExternalStore` source, not component state.
  The page is statically prerendered so localStorage is client-only, and
  `commit` needs to read the current found-set *synchronously* while handling
  an input event. One store gives both, with no load effect and no second
  mirrored copy to drift.
- `src/lib/feedback.ts` — haptics + WebAudio oscillator blips. No audio assets.
- Selection is ref-backed. React batches within a task, so a fast typist
  landing a letter and Enter in the same batch would otherwise submit an empty
  word.

### Design rules

- **One accent moment.** `--color-success` marks a found word. Nothing else on
  the screen is saturated. The rank bar is steel, never green.
- **Banned, as in the parent design system:** `#1a6fba`, `#14b8a6`, `#f0bc44`,
  `#e08c38`. No warm gold as a hierarchy accent.
- **Thumb zone.** Wheel in the bottom third; the grid never competes for it.
  The layout is budgeted to fit 375×812 with no scroll.
- **Motion = change only.** Tile pop on a solve, shake on a reject, rise on the
  sheet. No idle ambience. `prefers-reduced-motion` kills all of it.

## Not built yet

Percentile / leaderboards, accounts and cross-device sync (add Supabase at that
point), definitions on tap, timed and endless modes, PWA manifest + service
worker, analytics instrumentation.
