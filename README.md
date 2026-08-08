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
| `npm run icons` | Regenerate app icons (needs Python + Pillow) |
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

### Themes

Dark is the identity; **light exists because the dark UI is unreadable in
sunlight** — a screen can't out-emit the sun, so dark-on-dark collapses outdoors.
The header toggle cycles auto → light → dark and is one tap away on purpose:
needing it is a moment, not a setting.

Light follows the OS by default (`prefers-color-scheme`), and an explicit choice
wins in both directions. A tiny inline script in `<head>` applies the stored
choice before first paint, or light-mode players get a dark flash on every load.

The parent design system's locked light palette was authored for indoor use and
four of its tokens measured **below AA** on the light body (secondary 4.36,
muted 4.24, success 3.54, steel-muted 3.77). Sunlight needs more than AA, so
those are darkened within the same hues. Measured in the browser afterwards:
**every text element ≥ 6.4:1**, most far above.

**Structural contrast was the real bug.** The first light pass fixed *text* and
left every boundary failing: card-vs-page measured **1.12:1** against a 3:1
minimum, tile-vs-card 1.24, borders 1.68–1.88 — and dark was worse (1.06–1.51).
The letters were legible and the *shapes* were not, so in bright light the board
dissolved into one field. `--color-edge` (`#6b8399` light / `#647181` dark) is
the functional boundary, ≥3:1 against every surface it sits on, used on tiles,
the wheel disc, cards and controls. `carbon-border` stays the decorative
hairline for dividers that carry no meaning.

Shadows, the reveal sweep and the modal scrim are theme variables
(`--tile-shadow`, `--sweep-color`, `--scrim`) rather than hardcoded values — a
white sweep is invisible on white.

### Design rules

- **One accent moment.** `--color-success` marks a found word. Nothing else on
  the screen is saturated. The rank bar is steel, never green.
- **Banned, as in the parent design system:** `#1a6fba`, `#14b8a6`, `#f0bc44`,
  `#e08c38`. No warm gold as a hierarchy accent.
- **Thumb zone.** Wheel in the bottom third on phone; the grid never competes
  for it. The layout is budgeted to fit 375×812 with no scroll.
- **The board never stretches.** It stays a bounded column at every width.
  Extra width goes to the evidence rail or stays deliberately empty — it never
  inflates the game. Wheel geometry is percentage-based so it scales with its
  breakpoint class and hit-testing follows automatically.
- **Motion = change only.** Tile pop on a solve, shake on a reject, rise on the
  sheet. No idle ambience. `prefers-reduced-motion` kills all of it.

## Definitions

Tap any solved row — or any word chip in the rail — for a definition. Words with
no entry are **not tappable**, so a tap never comes back empty.

`scripts/build-definitions.mjs` filters a 22MB bulk dictionary down to only the
words the puzzle set can produce: **3,337 entries, 392KB, 80% coverage** (871 of
those resolved through a lemmatiser, because the source lists *acorn* but not
*acorns*). Coverage will never be 100% — see the caveat below.

The file is larger than the puzzles, so it is **not** bundled or inlined. It is
fetched once after first paint and then cached by the service worker: off the
critical path, still available offline later.

```bash
curl -sL https://raw.githubusercontent.com/matthewreagan/WebstersEnglishDictionary/master/dictionary_compact.json -o data/webster.json
npm run definitions
```

`data/webster.json` is gitignored — it's a regenerable build input.

Definitions are **hybrid**:

1. **Bundled floor** — Webster's Unabridged (1913), public domain, offline. It is
   Victorian: on its own it defines *linker* as "a torch made of tow and pitch".
2. **Modern upgrade** — fetched per word from dictionaryapi.dev on demand and
   cached in localStorage (capped at 600 entries, confirmed misses remembered so
   we don't re-ask). *linker* becomes "That which links."

The sheet shows the floor **instantly** and upgrades in place, so there is never
a spinner in front of content the player could already be reading. The source is
labelled either way. If the network is gone or the API dies, the feature degrades
to archaic-but-present rather than broken — which is the point of keeping a
bundled floor at all.

`parseModern` is pure and defensively tested against malformed payloads, because
it parses a third-party shape we don't control.

## Breakpoints

| Width | Layout |
| --- | --- |
| `< 768` | One column. Wheel bottom-anchored in the thumb zone; rail reachable via the bonus-words line, which opens a sheet. |
| `>= 768` | Board scales up (bigger wheel and tiles); rail drops in below it. |
| `>= 1024` | Rail moves beside the board; board centers vertically in its cell. |
| `>= 1536` | Wider measure, wider rail, and the how-to-play card appears. |

The rail (`Rail.tsx`) is one copy of markup — the grid parent decides whether it
sits below or beside. How-to visibility is a CSS class, not a measured
breakpoint, so there's no hydration-unsafe guess about viewport width.

What's in the rail was already in the engine but invisible: **which** words you
found (previously only a count), the full rank ladder, and a 7-day streak strip.

## Hosting

The build is a **static export** (`output: 'export'`), so any file host works.

**GitHub Pages** (temporary dev host) — `.github/workflows/pages.yml` builds and
deploys on every push to `main`. Enable it once in the repo: *Settings → Pages →
Source: GitHub Actions*. Note that Pages from a **private** repo requires GitHub
Pro; on a free account the repo must be public.

**Render** (eventual home) — a Static Site, not a Web Service: nothing needs a
Node process.

| Setting | Value |
| --- | --- |
| Build command | `npm ci && npm run build` |
| Publish directory | `out` |
| Env | `NEXT_PUBLIC_SHARE_URL=https://<your-domain>` |

Leave `NEXT_PUBLIC_BASE_PATH` unset on Render — it serves from the root.

### The base-path trap

Pages serves a project repo from `/<repo>`, not `/`. Next rewrites its own
links and assets, but **not** hand-authored paths, so three places go through
`withBase()` in [`src/lib/basePath.ts`](src/lib/basePath.ts): the manifest's
`start_url`/`scope`/icons, the `<link rel=icon>` tags, and the service-worker
registration (script URL *and* scope). The worker itself derives its base from
its own `location.pathname`, so one static file works at any mount point.

`out/.nojekyll` is also required — without it Pages runs Jekyll, which deletes
every underscore-prefixed directory, i.e. all of `_next`. The site loads with no
CSS or JS.

## Installable + offline

`src/app/manifest.ts` and `public/sw.js` make this a real PWA — installable to
a home screen and playable with no connection.

The service worker splits strategy on purpose: **navigations are network-first**
so a deploy is picked up on the next online visit, and **everything else is
cache-first** because Next fingerprints its assets, making a cached URL
immutable. Precache covers `/`, the puzzle file and the manifest; hashed build
chunks are cached lazily on first use. Bump `CACHE` in `sw.js` on any change to
it. It registers in production only — in dev it would serve stale bundles.

Icons are generated by `scripts/build-icons.py`: the mark is six tiles in a
ring with one lit in steel-blue, i.e. the game itself.

### The share card

Set `NEXT_PUBLIC_SHARE_URL` at deploy time. Without it the card falls back to
`window.location.origin` rather than a guessed domain.

```
Wordy #34 — Clever
🟩🟦🟦🟦🟦🟦
3 bonus · 58 pts · 5-day streak
https://your-domain
```

Squares are in tray order, so the shape a reader sees is the shape the player
saw. The six-letter word gets its own glyph — "did they get the long one" is
the whole story of a solve. Nothing that could spoil an answer is included, and
a test asserts it. Bonus, streak and URL drop out entirely when they have
nothing to say.

## Not built yet

Percentile / leaderboards, accounts and cross-device sync (add Supabase at that
point), definitions on tap, timed and endless modes, analytics instrumentation.
