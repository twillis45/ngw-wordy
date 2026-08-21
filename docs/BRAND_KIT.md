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
**Domain:** sixonthedial.com — **registered 2026-08-21** at Cloudflare, with
sixonthedial.app held defensively. The purchase deliberately preceded the
attorney clearance that STORE_READINESS 1.11 still owes; see DOMAIN_MIGRATION.md
for why. Clearance blocks launch, not registration.
**Working title, retired 2026-08-17:** Wordy — replaced because WORDY is a
live third-party trademark in Class 009 for exactly this product category
(mobile application software, Wordy Plus LLC). The rename shipped in PR #20:
the in-app UI, manifest, metadata and store screenshots all read Six on the
Dial now.

**The repo followed on 2026-08-19:** `ngw-wordy` is now `sixonthedial`,
matching the chosen domain rather than hyphenating it. GitHub redirects the
old path, and the Pages deploy derives its `basePath` from the repo name, so
the live URL moved to `https://twillis45.github.io/sixonthedial/` with no
config edit. Doing it pre-launch was the point: the manifest `id` resolves
against the URL, so the rename resets installed-app identity — a real cost
after launch, and none before it.

**Storage keys keep the old slug on purpose.** `ngw-wordy/v2` and its
siblings are storage addresses, not labels; renaming one orphans the data
behind it rather than moving it. The PBKDF2 salt in `sync.ts` is the sharpest
case — it feeds the derived account id. See the note in `storage.ts`.

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

The line this rule draws is identity vs. *surface*: a full-width filled
strip of steel is surface usage, which is why the rank bar's fill is its own
token (`--color-rank-fill`, resolving to steel-muted) and Studio Matte —
the one theme with a fully neutral ramp — overrides it to a luminance-
matched neutral (`#808286`) rather than painting a blue bar across a
de-blued screen.

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

**The board has its own scale**, because a tile is not a paragraph. These
resolve through three branches — a fluid clamp, a pinned branch for short
wide windows, and a roomy one — and the branch is chosen by WIDTH as much as
height: past ~744px the dial has reached its 340px cap, so vertical space
above it stops being contested and the tray can take it.

| Token | Range | Use |
|---|---|---|
| `--slot-h` | 19–46px | Tray tile height. Capped to protect the dial. |
| `--slot-h-base` | 22–54px | The six-letter prize row |
| `--slot-text` | 14–31px | The letter, ~0.72 of its tile |
| `--tile-glyph-x` | 1.3 | Horizontal scale on the glyph |

**Tiles are wider than tall — 5:4.** Height is the axis the dial competes
for; width is free. Measured before this was fixed, the six-letter row used
157 of 342 available pixels on a phone and the letter filled 47–56% of its
tile. The glyph is now ~72% of the tile's height and stretched 1.3× to spend
the width the tile already has.

**Height cannot be bought.** Raising `--slot-h` on the shared fluid ramp was
tried and reverted: the dial is sized from what is left over, so every extra
pixel of row came straight out of it — 235 to 193 on a phone, failing five of
eight viewports. `scripts/check-tiles.mjs` asserts the dial has not shrunk at
19 viewports.

---

## Motion

Retuned 2026-08-21 against numbers read from the leaders' shipped CSS, not
from taste. Wordle's tile pop is 100ms and its reveal is a two-phase 250+250ms
flip; Spelling Bee staggers its letter wave at `calc(383ms + var(--letterIndex)
* 77ms)` and animates in `em` so the motion scales with the type; Connections
runs its shake for 1.5 iterations rather than a whole number of them.

**Timings.** The ladder is deliberately spaced — nothing sits between 140 and
180, or between 220 and 340, so two beats never read as one.

| Animation | Duration | Beat |
|---|---|---|
| `tile-pop` | 140ms | a letter registered |
| `tick` | 180ms | a wheel tile under the finger |
| `rise` | 220ms | a panel arriving |
| `shake` | 340ms | the word was rejected |
| `land` + `land-ring` | 420 + 520ms | a letter arriving in the tray |
| `dial-turn` | 420ms | the wheel turning on a shuffle |
| `fill-up` | 620ms | the correct-word gradient |
| `sweep` | 700ms | light across a completed row |
| `float-up` | 900ms | points rising and fading |
| `rank-banner` | 2200ms | a rank earned |

**Distances are in `em`, never px.** A tile is four sizes across our
breakpoints — 19px on a short laptop, 26 on a phone, 33 on a tablet, 46 on a
desktop — so a fixed 7px shake is a third of the small tile and a seventh of
the large one: a hard knock on one screen and a twitch on another. `em`
resolves against the tile's own type, so the gesture scales with the thing
moving.

**Stagger is 77ms per tile.** Below about 60 the far end of a row starts
before the near end has settled and six tiles landing read as noise rather
than one wave crossing the word.

**The dial is the signature.** Each solved row advances the wheel one sixth of
a turn, so a finished board turns it exactly once — six rows, six tiles, six
positions. It is the one motion here that cannot be copied by anything that is
not also six-and-six. Three rotations share the object on separate CSS
properties so none overwrites another: the tile's `transform` is its parallax,
the tile's `rotate` cancels the detent, and the glyph's `transform` cancels the
shuffle.

**Reduced motion removes the MOVEMENT, not the MESSAGE.** The blanket
0.01ms kill is the floor, but signals that carry meaning get a substitute that
does not travel — opacity and colour are not vestibular triggers, translation
and scale are. The sharp case is the shake: a rejected word is announced by a
haptic tap, which a desktop does not have, and the shake. Kill both and a
reduced-motion player on a laptop submits a wrong word and receives nothing.
`scripts/check-motion.mjs` emulates the media feature and fails the build if
any meaning-bearing signal is silenced or still moves.

---

## Using the mark — the governing half

Added 2026-08-21. The board found the kit documented assets but did not govern
them: no clear space, no minimum size, no misuse rules, no one-ink version, no
favicon or social spec. A kit without these is a folder, and every one of the
rules below exists because the mark can be got wrong in that specific way.

### The three files, and when each is correct

| File | Use at | Why it exists |
|---|---|---|
| `mark.svg` | **32px and up** | The full mark: accent tile at six o'clock, centre puck |
| `mark-small.svg` | **16–24px** | Puck dropped, tiles enlarged, ring pulled in |
| `mark-mono.svg` | **32px and up**, one ink | Stamps, embroidery, single-colour partner footers |

`npm run check:marks` rasterises each at its minimum and counts the separable
shapes. **A mark that reads as five dots is not the mark**, and this is the
only thing standing between the geometry and someone changing it without
rechecking the sizes.

### Minimum size, and why 16px needs its own file

At 16px the full mark fails, and the arithmetic says why. Neighbouring tiles
sit 60° apart, so the distance between their centres is exactly the ring
radius (2·r·sin30° = r). Staying separable needs

    radius > tile + roughly one pixel of clear air

At 16px the full mark's ring gives 5.2px centres against 3.4px tiles and a
puck that renders under one pixel — the middle muddies and the ring closes.
`mark-small.svg` drops the puck and trades ring radius for tile size to hold
a 1.5px gap. **Never scale `mark.svg` below 32px; use the small file.**

### Clear space

**One tile-width on every side**, measured from the outermost tile edge — 21%
of the mark's width. Nothing sits inside it: no type, no rule, no other logo.
The mark is a ring with a hole, so it reads as open; crowding it closes the
shape and it stops being a dial.

### Misuse — the specific ways this mark gets broken

- **Do not scale below the minimums above.** This is the one that has already
  happened.
- **Do not recolour the accent tile.** It is the only element carrying
  position, and it is what makes this a *dial* and not a loading spinner.
- **Do not rotate.** The accent sits at six o'clock; rotating it makes the
  mark read as a different rank, now that the rank marks are the same
  geometry with lit positions.
- **Do not add a seventh element**, including a centre puck on the small
  variant. Six is the product's whole premise.
- **Do not place the full mark on a busy image.** It has a hole; a photograph
  fills it.
- **Do not outline it or add a drop shadow.** The rank marks were rendered
  once and it cost the ladder its ordering — see below.

### Lockups

Two, both shipped: `wordmark-horizontal.svg` and `wordmark-stacked.svg`. The
mark and the wordmark are **not** to be re-spaced by hand — use the lockups.
Horizontal is the default; stacked is for square-ish spaces (store tiles,
avatars) where horizontal would force the wordmark below its own minimum.

### Favicon and app icon

- **Favicon** — `mark-small.svg` at 16 and 32. Not `mark.svg`.
- **App icon** — `icon.svg`, which is the mark on a filled tile because both
  stores composite onto their own shapes and a transparent mark loses its
  ring. Smallest rendered use is 29px (iOS Settings).
- **Maskable** — the icon already carries safe padding for Android's mask;
  do not re-crop it.

### Social and Open Graph

1200×630, mark left, wordmark right, on `--color-carbon-body`. The mark sits
at least two tile-widths from any edge — the extra clear space is because
social crops are unpredictable and a mark clipped at the ring reads as broken
rather than as cropped.

---

## Rank marks

Redrawn 2026-08-21 after the board scored the previous ladder **1/10**. Built
by `npm run ranks`, guarded by `npm run check:ranks`.

**The mark IS the ladder.** The game is six letters on a dial and six rows to
fill, so a rank mark is the dial and rank is how many of the six are lit —
Novice none, Complete all six. That comes from the rules rather than from
taste, which is why it cannot be borrowed by anything that is not also
six-and-six, and why the ranks and the app mark are finally one object instead
of two visual languages shipping together.

**Three redundant channels, ordered:**

| Channel | Carries |
|---|---|
| Count | how many dots are lit — ordered by construction |
| Value | lit dots brighten up the ladder, 46.8 → 147.1 of 255 |
| Size | lit dots are fractionally larger — the last thing legible at 16px |

**What the old ladder did wrong**, kept here because it is the reason for
every rule above. Seven photorealistic renders, measured at 32px: luminance
ran 31.6, 49.7, 47.5, 47.9, 40.8, 62.1, 57.7. Three adjacent pairs under 5 of
255 apart, and NOT monotonic — a player climbing from Solid to Fluent watched
their mark get darker. Form differed but did not order either. The whole
ladder spanned 30.5 of 255; this one spans 100.3, and holds its order with hue
removed.

**Never encode a rank in hue alone.** Roughly 8% of men have colour-vision
deficiency, and the reward surface is the last place to spend that.

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
