# Pack pipeline — candidate themes and where each one stands

Working tracker for new packs. Updated 2026-08-12.

## Where this list came from — read this first

The candidates below now come from named trend sources, listed in the next
section, and each row records which signal it came from. What they are NOT is
a ranking: none of these sources measures demand for a WORD GAME PACK, and no
source consulted publishes anything like that. They measure what people are
searching, pinning and taking up as hobbies. Treating "camping is up" as
"a camping pack will sell" is a leap, and it is the reader's leap to make
knowingly.

The first version of this file was drafted from editorial judgement alone and
said so. The trend sourcing is new; the honest caveat survives it.

What IS measured, by us, is the right-hand side: whether a theme can carry a
pack at all. That is the column to trust without qualification.

## Resources — where to check what is trending

Free unless noted. The first three are the ones worth a recurring look.

| source | what it is good for | cadence |
|---|---|---|
| [Google Trends](https://trends.google.com/trends/) | search interest for any term, by region and over time. The baseline check before committing to a theme | live |
| [Google Year in Search](https://trends.withgoogle.com/year-in-search/) | curated annual trending lists across 47 categories. Explicitly *trending*, not *most searched* — generic evergreen terms are filtered out ([methodology](https://trends.withgoogle.com/year-in-search/data-methodology/)) | annual, December |
| [Pinterest Predicts](https://business.pinterest.com/pdf/pinterest-predicts/2026-trend-report/) | forward-looking; Pinterest's trend data tends to surface months before interest peaks elsewhere. Strongest for food, home, aesthetic and entertaining | annual + [live trends tool](https://business.pinterest.com/blog/pinterest-predicts-2026-turn-trends-into-unlimited-possibilities/) |
| [Exploding Topics](https://explodingtopics.com/) | early-stage trends 6–24 months out, drawn from search, social, forums, news and e-commerce | live, freemium |
| [TikTok Creative Center](https://ads.tiktok.com/business/creativecenter/) | real-time engagement and emerging formats | live |
| [Glimpse](https://meetglimpse.com/trends/hobbies-activities-trends/) | hobby and activity trend data with volumes; good for the leisure categories this game lives in | live, freemium |
| [Statista Consumer Trends](https://statista.com/study/206237/consumer-trends-2026/) / [Euromonitor](https://www.businesswire.com/news/home/20251105486775/en/Euromonitor-International-unveils-Global-Consumer-Trends-for-2026) | annual consumer-behaviour reports; slower and broader than the rest | annual, paid |

Signals these produced for 2026, and what came of each, are in the table below.

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

## Provenance — checked against primaries, and it did not all survive

The candidate sources were first written from SEARCH-RESULT SUMMARIES. Two
primaries were then fetched directly (2026-08-12) and two claims did not
hold. Every candidate now carries a tier in its `# source:` header.

**Tier A — confirmed in the primary, with figures.** Three of thirteen.

| theme | the actual claim |
|---|---|
| pickleball | Glimpse: pickleball `8.4M Volume, +42% Growth`; pickleball paddle `571K Volume, +49% Growth` |
| camping | Glimpse: "58 million U.S. households to camp in the past year, generating an estimated revenue of almost $44 billion in 2023" |
| farmmarket | Pinterest Predicts 2026: **Cabbage Crush** is a named 2026 trend. No growth figure is published for it |

**Tier B — a summary said it; the primary does not.** Six.

- `dinnerparty` was filed as Pinterest's "hostess era". **Pinterest's own 2026
  report contains no dinner-party, hosting, entertaining or tablescaping
  trend.** The framing came from third-party write-ups. It is unsourced.
- `craft` (knitting/crochet/embroidery) is not among the 13 data-backed trends
  on Glimpse's hobbies page; it came from listicle summaries.
- `gym` rests on the phrase "fitness and wellness hobbies such as pickleball
  and yoga are booming" — no figure, not a row in Glimpse's data.
- `bookclub`, `potluck`, `gamenight`, `karaoke` are all extrapolations from
  one summary phrase about community-based and analog hobbies rising. No named
  trend, no figure, no primary.

**Tier C — no trend provenance at all.** Four. `tailgate` is my own
seasonality call on the NFL calendar. `nailsalon` is adjacency to the shipped
Beauty Supply pack. `fishfry` and `gogo` come from the repo's own bench
sign-off list, which is an internal document and not a trend signal.

### What this means for the ranking

**Nothing in this table ranks the packs.** Every ordering in this file is by
DENSITY, which is our own measurement of whether a theme can carry a pack. No
popularity figure feeds it. A theme with `8.4M Volume, +42%` behind it and one
extrapolated from a stray phrase sit in the same list, ordered by a number
that knows nothing about either.

### Data-backed trends deliberately not pursued

Glimpse's list also contains padel (`336K, +56%`), sim racing (`36K, +18%`),
golf simulator (`1.1M, +30%`) and wingfoil (`87K, +23%`) — all better
evidenced than most of what is queued above. They are absent because they are
narrow equipment vocabularies rather than places with things in them. Padel
and golf are the two worth a draft if the shelf question ever loosens.

## Expanded sweep — sourced candidates, measured at comparable depth

Drafted at ~75–90 usable words each so the comparison is between THEMES rather
than between how long I spent on each. `tailgate` is included as a control: it
is the pack being authored, and it appears here at its ~86-word draft and in
the status table at its finished 207-word depth.

| theme | density | shelf | trend signal it came from |
|---|---|---|---|
| bookclub | **148** | Elsewhere | community-based hobbies, social reading (Glimpse) |
| gamenight | **122** | The Block | analog/social hobbies as counterbalance to digital saturation (Glimpse) |
| pickleball | **100** | Elsewhere | pickleball boom (Glimpse, Accio) |
| nailsalon | **93** | The Block | adjacent to the shipped Beauty Supply pack |
| *tailgate (control @86w)* | *75* | *The Table* | *seasonal — NFL kickoff* |
| camping | **60** | The Long Way | camping renaissance, 58M US households (Glimpse/Accio) |
| dinnerparty | **40** | The Table | Pinterest Predicts 2026 "hostess era" — dinner parties, tablescaping |
| farmmarket | **35** | The Table | Pinterest 2026 food + fermentation trend |
| craft | **31** | Elsewhere | knitting/crochet/embroidery boom (Rest Less, Glimpse) |
| potluck | **29** | The Table | community-based hobbies (Glimpse) |
| karaoke | **24** | The Soundtrack | social/community hobby resurgence |

**Every one of these clears the gate of 12 at this depth**, which is the real
headline: viability has stopped being the constraint. The control row is how
to read the numbers — tailgate scores 75 here and **453** at full depth, so
expect roughly a 6x lift on anything deepened to ~140 words. A theme at 24 is
not marginal; it is under-drafted.

What actually decides the order now is shelf fit, the cultural gate, and
authoring cost — not whether the theme works.

Signals deliberately NOT pursued, and why: the poet aesthetic, field jackets,
Scotland highlands and ethereal places (all Pinterest 2026) have no short
concrete vocabulary — a theme needs 3–6 letter common nouns, and an aesthetic
mood does not have them. Sensory/fidget products and golf simulators, same
problem. Cabbage and fermentation fold into `farmmarket` rather than carrying
a pack alone.

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
3. **gamenight** (The Block) and **dinnerparty** (The Table) — both sourced,
   both on shelves that exist, neither cultural. The strongest next two.
4. **camping** (The Long Way) — that shelf currently holds two packs and has
   room; strong outdoor signal.
5. **gym** — densest candidate measured, still blocked on having no shelf.
6. Cultural queue (fishfry, gogo, reunion, salon) behind the bench.

`bookclub` and `pickleball` score highest in the sweep and are both parked in
Elsewhere. Worth a ruling: they are good packs with no home, and the shelf
ceiling is the thing standing between the catalogue and its two densest
sourced candidates.

## What the radar found on its first run

Recorded because it is a backlog that existed before anyone wrote it down, and
because it says something about where effort should go.

**Six shipped packs are carrying vocabularies under 100 words** — sitcom 50,
spades 52, juneteenth 52, beautysupply 75, garden 82, steppers 89 — against
the ~140 that the packs reaching 0.80 carry. Those six are also, in almost the
same order, the six lowest densities in the catalogue: steppers 30,
beautysupply 49, spades 52, sitcom 60, juneteenth 61, garden 88.

That is the same finding as the candidate sweep, seen from the other end.
Depth is the lever, and it is as true of a shipped pack as of a draft.
Deepening those six vocabularies is likely worth more than a new pack: it
raises density, which raises the boards available, which raises the on-theme
rate, and it needs no new shelf, no bench sitting and no new clues.

Both `ready` findings are the ones to clear first, though — a theme with a
vocabulary and no boards is work already paid for and not collected.

## The process — run this, in this order

Two halves that fail differently, which is why they are separate commands.
The trend half needs the web and a judgement call. The measuring half is
arithmetic over files already in the repo and always has an answer, so a
sweep with no network still produces the list of what to build.

### 1. Standing check — no network, run any time

```
node scripts/pack-radar.mjs
```

Reports every shipped theme against the three floors — density 12, four
boards, on-theme 0.60 — and names what to do. It found, on its first run: two
themes ready to author, and six shipped packs carrying vocabularies under 100
words when the packs that reach 0.80 carry ~140. It reports and never gates,
because a check that blocks a build for saying "stoop has no boards" gets
muted within a week.

### 2. Sweep the sources — quarterly, plus Year in Search each December

Work the table above. What you are looking for is not "is this popular" but
**does this have short concrete nouns** — a theme lives or dies on common 3-6
letter words, which is why the poet aesthetic and Scotland highlands were
dropped despite being genuine 2026 trends.

### 3. Draft the candidate — cheap, reversible, never touches the catalogue

Write `data/candidates/<id>.txt`:

```
# shelf: The Long Way
# source: Glimpse - camping renaissance, 58M US households
tent pole stake rope tarp ...
```

**Draft ~140 words.** Not 40. The single most expensive mistake available here
is judging a theme on a thin draft: every candidate ever drafted at ~35 words
has failed, and the same themes at ~140 all passed. Tailgate scored 11 at 46
words and 453 at 207 — the theme never changed.

### 4. Score it

```
node scripts/candidate.mjs            # everything, ranked
node scripts/candidate.mjs camping    # one
```

The gate is density >= 12. Drafts under 120 words are flagged as advisory,
because at that depth the number is describing the draft.

### 5. Promote a winner

```
node scripts/candidate.mjs --promote camping
```

Refuses below the floor, and refuses to overwrite an existing theme. It lands
the words in `theme-vocab.json` as one undifferentiated `named` tier — split
into named/said/voice by hand before authoring, then:

```
node scripts/theme-yield.mjs --json
node scripts/pack-draft.mjs camping 20
```

### 6. Author, check, merge

`check-pack` is a gate and `merge-pack` refuses on its failure. Cultural packs
stop here until the bench has signed the vocabulary and a community reader is
booked.

### The rule this whole process exists to enforce

Measure, then author. Never the other way round. Laundry Day and Caribbean
were authored, shipped, and only then measured — both were unviable at any
wheel size, no rewrite could save either, and both were cut. Ten minutes of
`candidate.mjs` is the whole cost of not repeating that.
