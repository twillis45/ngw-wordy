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
