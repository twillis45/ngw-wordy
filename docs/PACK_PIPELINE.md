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

## Keeping this current

Re-check the three live sources quarterly, and Year in Search each December.
When a signal looks promising, the order is always: draft ~140 words, run
`node scripts/viability.mjs`, and only then decide. Never the other way round —
that is what cost Laundry Day and Caribbean, both of which were authored,
shipped and then cut as unfixable.
