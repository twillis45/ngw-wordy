# Authoring themed puzzles

The binding spec for anyone — person or agent — writing clues for this game.
It produced the 300-board catalogue, and the rules at the bottom were bought
with mistakes rather than reasoned out in advance.

## What a puzzle is

A base word of six DISTINCT letters, plus five other words spellable from those
letters. Each of the six gets a one-line clue. The player sees the clues and
spells the words on a letter wheel.

## Never pick a base by hand

```bash
node scripts/vet-bases.mjs      # writes data/base-pool.json
```

That file lists ONLY bases the build will accept: right length, distinct
letters, in common use, answer count inside the 24–110 band, unclaimed, no
anagram collision — plus, for each one, **every common word that is legal as a
row**. Pick bases and rows from it and nothing you write can be rejected for
structure.

Authoring the first two packs without this cost seven full re-authors. Skipping
the anagram check cost fourteen more boards: a base is only ever six letters on
a dial, so `mantle`, `mantel`, `mental` and `lament` are one puzzle wearing four
names, and so are `ladies` and `ideals`.

## The clues

- 24–120 characters.
- A clue must NOT contain its own answer, nor the answer's first four characters
  anywhere in it. `plate` forbids "plat"; `late` forbids "late", which also
  rules out "plates" and "related". This is the most common failure.
- Write **a thing you can picture**, not a definition. The dictionary already
  supplies the unthemed boards; a themed clue earns its place by being specific
  and lived. "A flat dish for food" fails. "Twelve dollars. She set the price in
  2019 and has not moved it since." is the register.
- Vary sentence shape. Six clues all opening "What ..." reads as a machine — the
  suite caps that shape at a third of the corpus.
- No clue may repeat an image, object or joke used by another clue. No clue text
  may appear on two boards; the suite checks this too.
- Don't leak another row's answer inside a clue. It is not a build error, it
  just gives the board away.

### Name the record, with the answer blanked

A clue that points at a specific work must NAME it. Write the title out and put
`———` where the answer goes:

    end   Boyz II Men, 1992 — ——— of the Road, thirteen weeks at number one

not

    end   Boyz II Men held the number one spot thirteen weeks with it

The second one only works for a player who already knows the answer, which is
the one player who does not need a clue. It also throws away the citation: the
canon entry behind that row says "End of the Road ... 13 consecutive weeks at
number one", so the title was already researched, already verified, and simply
not on screen. Thirty-one clues in the Nineties pack were written the second
way.

Three mechanical traps, all of which fired on the first pass:

- **Blank the ANSWER, not the first word of the title.** `name` wants
  "Say My ———", not "——— My Name". Written the wrong way round it trips
  check-pack's own-answer rule, which is the thing that caught it.
- **The redactor matches INSIDE longer words.** `red` cannot appear in a clue
  containing "remembered". Check the whole sentence, not just the title.
- **A title that IS the answer gains nothing.** Jodeci's "Stay" for `stay`
  redacts to "———". Leave those clues pointing at the record from outside.

Writing the title in full and letting the build redact it is NOT available:
`check-pack` rejects a clue containing its own answer before the build ever
runs. So the `———` goes in the source, by hand.

## Standing requirements

- **Insider-accurate, never stereotype.** Specific beats general every time.
  Region, generation, class and denomination vary; a clue that flattens fails.
- **Dignity.** The bench's original finding was that across 59 clues, no woman
  had a role outside the kitchen, the receiving end of a plea, or throwing shade.
  Write women holding authority, money, records and decisions — not as a quota,
  but because in these settings they do. The corpus now runs 25% she/her against
  9% he/him; do not undo that.
- **No caricature.** If a clue would only land for someone outside the culture it
  depicts, cut it.

## Rules research bought

**A clue is a factual claim wearing a joke.** Twelve shipped clues were wrong —
General Order No. 3 has four sentences, not five; Xavier of Louisiana is not
Jesuit; a 90s R&B royalty was 56c an album, not a penny. Check before you write,
not after. `data/canon.json` holds what has been checked; `node scripts/canon.mjs
--open` holds what has not.

**Prefer the real number to the invented one.** It is almost always better. "A
penny a record" was invented to sound damning and the true figure was worse.

**Never clue absorbed slang as Black-coded.** AAVE diffuses through short-form
video, gets relabelled "Gen Z slang", and non-Black speakers adopt it at no cost
while Black speakers keep paying for it. *Finna, no cap, bussin, slaps, slay,
tea* have completed that crossing. Cluing them as in-group now reads as the game
learning the word from a brand account.

**Never put a count in a clue that a legislature can change.** "Thirty states
have a CROWN Act" becomes wrong without anyone touching the file. Same for
enrollment figures, prices and rosters.

**Topical material stays out of the evergreen catalogue.** See
`docs/research/current/README.md`. A player cannot tell a stale clue from a bad
one — they read both as the game being broken.

**Folklore is not fact, however often it is repeated.** Nothing places Granger on
the Ashton Villa balcony; the belief survives on an annual reenactment performed
there. Where a story is loved but unsourced, the honest move is a clue that does
not assert it — the red-drink clue does this well and should not be hardened.

## Output

A JSON array of `{ base, theme, clues: {...}, prefer: [...] }`, merged into
`data/themes.json`, then `npm run puzzles` and `npm test`.

## The limit

Per `docs/CULTURAL_BOARD.md`, this process catches flattening, absence and
cliché, and generates material at volume. It is not community consultation, and
research does not close that gap either — a citation can confirm the conk's
chemistry and cannot say whether the clue reads as respect or as novelty. Budget
a real reader per pack.

## General packs: the clue gate

The catalogue now includes themes that are not Black American cultural life —
The Road Trip, The Garden, Laundry Day. The combined board accepted that
decision and attached a gate to it, because a general theme is much easier to
write badly and the first draft will be generic.

**Every clue in a general pack must name a position, a time, or a person's
habit. Never a category.**

The test is not whether a clue is about the theme. It is whether it was written
from a fixed spot in a real moment:

> "What the mothers do after the benediction, seated, while the building
> empties around them."

That line is not warm because of whose church it is. It is warm because someone
stayed after and wrote from where they were standing. The technique travels:

- **Passes** — "The gas station you stop at not because you need gas."
- **Fails** — "A long drive with your family."

A general pack that produces one category-clue fails review and is re-authored.
General themes do not get a lower bar for being easier to write; they get the
same bar, which is the reason only three of them ship.

Two conditions travel with them, both from the bench, both binding:

- **The daily never serves a general pack.** Enforced in `dailyPoolSize` and
  asserted in the build, not left to authoring discipline — it is the condition
  on which the highest-paying seat is retained.
- **The same real-reader budget applies.** Lower standards on the general packs
  is how the cultural packs come to be read as the gimmick.

## Measure base density before you author a pack

A base is six letters on a dial. **Density** is how many words of the theme's
vocabulary those six letters can actually spell. It is the number that decides
a pack's on-theme rate, and it is decided before a single clue is written.

A board has five grid rows. So:

| density | best possible board | best possible pack |
|---|---|---|
| 2 on-theme rows | 0.40 | 0.40 |
| 3 | 0.60 | 0.60 |
| 4 | 0.80 | 0.80 |
| 5+ | 1.00 | 1.00 |

**A 2-density base caps the board at 0.40 no matter how good the clues are.**
No rewrite, no donor swap and no amount of care moves it. This was learned the
expensive way: The Road Trip and Laundry Day were authored by choosing bases
for how many IDEAS they carried, which is a different and weaker thing, and
both landed at 0.58 with no available repair. Rewriting rows was dead, base
swapping was dead, and cutting to four boards still only reached 0.70.

Rank candidate bases by density FIRST. Author the dense ones. A pack built
entirely on 4+ density bases starts at 0.80 and needs no rescue.

## Do not pad a vocabulary to move a number

The on-theme rate is only meaningful if the vocabulary is honest, and a
vocabulary is the easiest thing in this repo to quietly corrupt. Two ways it
has actually happened here:

1. **Adding a word because it appears in a shipped row.** `melts` and `pain`
   went into the laundry vocabulary for exactly this reason. That is writing
   the answer key after seeing the test.
2. **Adding generic words that fit any theme.** The laundry vocabulary reached
   100 words by admitting `mat`, `cap`, `bag`, `tag`, `brush`, `sink`,
   `shelf`, `board`, `lift`, `drop`, `set`, `stand`, `reach`, `bend`, `count`
   and `pick` — every one equally at home in a kitchen pack or a garage pack.

**The test: would this word be on-theme for a DIFFERENT pack?** If yes, it is
texture, not vocabulary. A word that fits the kitchen, the garage and the
laundry is doing no work in any of them.

Pruning laundry against that test took it from a reported 0.58 to a true 0.34,
and the quality suite immediately failed on three boards — one of which had
ZERO laundry rows. The padding had been hiding them. Backfilling a vocabulary
is legitimate when the word is genuinely of the theme and was simply missing;
it stops being legitimate the moment the metric is the reason.

Also: this product is written for a US audience. `peg` and `tap` were British
for clothespin and faucet, and both shipped.

## The prize word must be a word of the theme

The base is what the player is rewarded with. It is the last thing they find,
it is celebrated, and it goes on the share card. It should be a word that
belongs to the pack.

**Measured across the catalogue: 0 of 126 prize words were their own theme
word.** Not one. Laundry Day's prizes were PAINTS, PIANOS, SENIOR, ACTORS and
METALS; The Cookout's included CINEMA, CANDOR and DEPICT. The letters spelled
the theme and the word itself was a stranger to it.

This happened because base selection optimised for DENSITY — how many theme
words the six letters can spell — and nothing ever asked whether the base
belonged. Density is necessary and it is not sufficient.

It is also fixable, which is what makes it worth a rule. Legal on-theme bases
exist in quantity and were simply never used:

  church 15 (DEACON SERMON PASTOR EULOGY CASKET)   rnb90s 14 (BRANDY CHORUS)
  texas  13 (MARKET SHRIMP SMOKED PICKLE)          laundry 11 (WASHER BASKET
  cookout 8 (COUSIN AUNTIE FAMILY GATHER)          HAMPER BLEACH FABRIC HANGER)

Rank candidates by density, then prefer the ones that are themselves theme
words. A pack whose prizes are WASHER, BASKET, HAMPER and BLEACH is a
different object from one whose prizes are PAINTS, PIANOS and METALS, before a
single clue is written.

Note garden yields NONE, which is the honest signal that a theme can fail this
test outright — in which case say so rather than shipping strangers.

## Write US English

The audience is US. These shipped as British and had to be corrected: `tyre`
(tire), `kerb` (curb), `bonnet` (hood), `boot` (trunk), `peg` (clothespin),
`tap` (faucet). `flat` is kept because a flat tire and a flat note are both US.

### The prize-word rule collides with density, and the collision is the point

Measured immediately after writing the rule above, and it does not hold as
stated. A base that IS a theme word usually spells almost none of them:

  laundry   WASHER 1 on-theme row   BASKET 0   BLEACH 0   FABRIC 0   TUMBLE 0
  church    DEACON 0   PASTOR 0   EULOGY 0   BISHOP 0   but ANTHEM 4
  cookout   COUSIN 0   OLDEST 0   but GATHER 5, AUNTIE 3

So the two rules pull against each other. A dense base is a stranger to its
theme; an on-theme base spells nothing. The reason is arithmetic rather than
bad luck: a 55-word vocabulary gives any particular six letters a poor chance
of spelling four of them, and a word chosen for BEING vocabulary was never
chosen for spelling it.

The workable rule is therefore narrower than "the prize word must be a theme
word", which is unachievable, and stronger than ignoring it:

  Prefer bases that are theme words AND carry 3+ on-theme rows. They are rare
  — one to three per pack — and they are the best boards the pack can have.
  ANTHEM, GATHER, AUNTIE, PRAISE and CASKET are worth more than any dense
  stranger, and a pack should open on one.

And the diagnostic that matters more: **if a theme has NO base that satisfies
both, the theme is too narrow to carry a pack.** Laundry's best is WASHER at
one row. That is not an authoring problem to be solved with better clues, it
is the theme telling you it is a scene inside another pack rather than a pack.
