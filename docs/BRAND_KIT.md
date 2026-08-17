# Six on the Dial Brand Kit

Modeled on the Opal brand kit (brandkit.opal.so) — same shape: identity,
color, material, motion, and a gradient-usage rule stated as plainly as
theirs. The difference is where this one gets its numbers: every value below
is copied from `src/app/globals.css` and `src/app/layout.tsx`, not invented
for this document. If a value here disagrees with the code, the code is
right and this file is stale — update this file, not the other way around.

A generated webpage version of this doc is published as a Claude Artifact;
regenerate it after any edit here so the two never drift.

---

## Identity

**Name:** Six on the Dial
**Domain:** sixonthedial.com (decided 2026-08-17; purchase gated on the
attorney closing STORE_READINESS 1.11)
**Working title being retired:** Wordy — replaced because WORDY is a live
third-party trademark in Class 009 for exactly this product category
(mobile application software, Wordy Plus LLC). The in-app UI, store
screenshots and code still carry the working title until the rename ships
as its own change.

**What the name means:** the *dial* is the game's own letter wheel — six
letter tiles around a center puck, the thing a player spins and drags to
spell. It is not a clock, a watch, or a radio tuner, and brand imagery must
never reach for those. *Six* is the number of letters on the dial.

**Description** (the one sentence used for `<meta name="description">`,
`og:description` and `twitter:description` — written once in
`src/app/layout.tsx` so it can't drift across the three):

> A six-letter word game with hand-authored puzzles. Find every word on the
> wheel, then read the clue behind the board — written from inside Black
> American cultural life, across fifteen themes, plus a few packs from the
> long way home. Boards, every one about something.

**Positioning ruling**, not a style choice — decided by the review board and
enforced in the metadata code itself: the cultural specificity leads, the
general packs trail as a subordinate clause, and a puzzle count never leads
a sentence. *"A blurb reading 'N puzzles across many themes' removes the only
reason anybody chooses this over a free alternative."* A number is the one
claim every competitor can beat; specificity is not.

**Rank ladder** (the game's own voice for progress, low to high): Novice,
Solid, Sharp, Clever, Fluent, Wordsmith, Complete. Internal to the UI copy —
plain, no jargon, no gamification lingo like "level" or "XP."

---

## Logos

Four files, all SVG, in `docs/brand/`:

| File | What it is |
|---|---|
| `wordmark-horizontal.svg` | Primary wordmark — lowercase "six on the dial," the o in *on* drawn as the six-tile wheel |
| `wordmark-stacked.svg` | Stacked caps variant — "SIX ON / THE DIAL," same wheel-O |
| `mark.svg` | Standalone wheel mark — transparent background, off-white tiles |
| `icon.svg` | App icon — the wheel on a carbon rounded square with hairline edge |

**Provenance:** letterforms generated with Recraft V4.1 (vector mode) against
the locked palette; the wheel in every file was then rebuilt in code —
generation kept miscounting tiles (5 in one pass, 8 in another), and the
wheel is pure geometry, so it is constructed, not drawn. Six tiles at exact
60° intervals (90°, 30°, −30°, −90°, −150°, 150°), amber pinned at −90°.

**Rules the marks carry:**
- The wheel always has exactly six tiles. Never redraw it with any other
  count — six is the name.
- The amber tile sits at six o'clock and is the composition's one accent
  moment (same rule as the UI).
- The dial is the game's letter wheel. No clock hands, no tick marks, no
  radio-tuner imagery, ever.
- The wordmark SVGs carry their own near-black ground; light-background
  variants are derived as single-ink versions, not recolored.

---

## Color

### The carbon ramp — dark is the default identity

| Token | Dark | Light |
|---|---|---|
| `--color-carbon-body` | `#07080a` | `#f2f3f5` |
| `--color-carbon-panel` | `#141517` | `#ffffff` |
| `--color-carbon-surface-2` | `#1a1b1d` | `#e6e7e9` |
| `--color-carbon-border` | `#27282a` | `#bcbdbf` |
| `--color-carbon-strong` | `#2f3032` | `#a2a3a5` |

**Rule: flat, not climbing.** De-blued 2026-08-17. The defect this fixed
wasn't the tint, it was the *gradient* — blue-over-red used to climb with
elevation (2 → 14 in dark, up to +43 in light), so a surface read cooler the
higher it sat and elevation was quietly encoding temperature as well as
lightness. Every surface now sits at a flat **+3 blue-over-red** — measured
against 8 dark-mode leaders and 6 light-mode leaders on Mobbin, none of which
climb cool with elevation. Elevation means one thing: lightness.

### Functional edge vs. decorative hairline

`--color-edge` (`#d2d4d8` dark / `#24333f` light) is the boundary a shape is
*identified by* — lit to ~13:1 on dark, ~11:1 on light, deliberately extreme
so shapes survive direct sunlight. De-blued 2026-08-17 from `#ccd6e4`
(24 blue-over-red) at held luminance, after the neutral surfaces left the
old edge reading as the blue in the interface; the ratio is pinned in
`contrast.test.ts`. `--color-carbon-border` is decorative
only (a hairline at 1.24–1.35:1) and never carries meaning on its own; it
was mistakenly flagged as a WCAG 1.4.11 gap once and the finding was
retracted after checking actual usage (66 real uses of the functional edge
against 1 non-identifying use of the hairline).

### Steel — identity, not surface

`--color-steel` (`#4e6877`, +41 blue-over-red) is locked across every mode,
including Studio Matte. It is the one place blue is allowed to be blue on
purpose — mixed into the liquid-glass material (`--glass-body`,
`--glass-tint`) so the *lens* carries a signature cast even where the
*carbon underneath it* is neutral. Do not de-blue steel; that would be
removing the identity color, not fixing a defect.

### One accent moment

> "One accent moment: the success color marks a found word. Nothing else
> on the screen is saturated." — `globals.css`, top of file

- `--color-success` — `#e08c38` orange, the shipped default since 2026-08-17
  (the accent axis resolves unset to `matte` in `lib/accent.ts`; light matte
  splits the value, `#ef8f2a` chromatic / `#9c4a06` text). Green `#4fae7a`
  (dark) / `#186438` (light) stays selectable as the opt-in alternate — same
  rule honored a different way, never both accents live at once.
- `--color-select` — `#f2831c`, amber. The single deliberate break from the
  palette's blue-grey hue family (~202°), reserved for "this tile is picked."
  Chosen at a near-complement angle (28°) because a same-hue fill (steel)
  read as merely "lighter," not as a different state.
- `--color-danger` — `#f27a70`. Never a fill, only ever a word in the toast
  slot — kept apart from the selection amber (which sits close on the wheel)
  by lightness and by never appearing as text.

**Banned, explicitly, as a hierarchy accent:** `#1a6fba`, `#14b8a6`,
`#f0bc44`, `#e08c38` (outside its sanctioned accent role above) — no
warm gold competing with the one accent moment. This is a confidence-
hierarchy rule, not a taste rule: warmth must never compete with the single
saturated thing on screen.

---

## Gradients

**Reserved for one milestone moment. Never a background.** This is the game's
version of Opal's own rule (*"gradients are reserved for in-app milestone
moments — never as backgrounds or dominant elements"*) — arrived at
independently, the hard way:

- **Off, as of 2026-08-17:** the top-left specular wash that used to sit on
  every `.liquid` panel (29 surfaces — the board, the clue box, every chip)
  via `--glass-specular`. Author's call after looking at it live: a gradient
  that sits on everything permanently reads as a smudge, not as light.
  Zeroed as a token rather than deleted, so restoring it is one value.
- **On, and the only surface gradient left in the file:** `.anim-land::after`
  — a green fill that rises from the bottom of a tile the instant a word is
  confirmed correct, then fades within 620ms. Transient, tied to a single
  event, gone in under a second. `background: linear-gradient(to top,
  var(--color-success) 0%, transparent 85%)`, animated with
  `transform-origin: bottom; transform: scaleY(0) → scaleY(1)`.

If a future design wants a new gradient anywhere in the product, the
question to ask first is the one this rule already answers: is it marking a
moment, or decorating a surface. Only the first is allowed.

---

## Material — liquid glass

Tokenized so the pointer, cards and panels can't drift apart, and so a matte
theme can turn the whole material off in one place:

`--glass-tint`, `--glass-body(-raised)`, `--glass-fill(-raised)`,
`--glass-rim-light(-strong)`, `--glass-rim-dark(-strong)`,
`--glass-caustic(-strong)`, `--glass-specular(-strong)`, `--glass-contact
(-strong)`, `--glass-blur`, `--glass-saturate`.

Studio Matte turns every one of these to `transparent`/`0`/`1` — "no
specular, no rim light, no caustic, no backdrop blur" — proving the material
is fully optional rather than baked into components.

### Radius, by role

| Token | Value | Role |
|---|---|---|
| `--radius-panel` | 24px | Top-level surface, sits on the page |
| `--radius-card` | 16px | Nested inside a panel |
| `--radius-inset` | 12px | Control-sized block inside a card |
| `--radius-row` | 8px | A list row |

A nested radius is always smaller than its parent's.

---

## Typography

System stack, no webfont: `ui-sans-serif, -apple-system, BlinkMacSystemFont,
"Segoe UI", ...`.

| Token | Size | Use |
|---|---|---|
| `--text-kicker` | 11px | Uppercase labels only |
| `--text-meta` | 12px | Captions, counts, secondary detail |
| `--text-body` | 15px | Running text, list-item titles |
| `--text-item` | 17px | Card and section titles |
| `--text-title` | 22px | Modal titles |
| `--text-hero` | 32px | The one set-piece per screen |

---

## Motion

Keyframe vocabulary, all disabled wholesale under `prefers-reduced-motion:
reduce`:

- `tick` — a wheel tile confirming a letter under the finger
- `land` + `land-ring` — a letter arriving in the tray, with impact
- `fill-up` — the correct-word gradient (see Gradients, above)
- `sweep` — light passing across a just-completed row
- `float-up` — points earned, rising and fading
- `tile-pop`, `shake`, `rise` — entrance, error, and settle primitives

---

## Accessibility commitments

- Every pinned contrast ratio lives in `src/lib/contrast.test.ts`, which
  reads the actual CSS tokens rather than trusting a comment — a retune that
  crosses a threshold fails the build, not a design review.
- State is never hue-only. The selection amber is a different hue *and* a
  different lightness *and* an inverted (dark-on-light) tile, because a
  same-hue fill measured as merely "lighter" under protanopia.
- Reduced motion is a hard stop (`animation-duration: 0.01ms !important`),
  not a preference nudge.
