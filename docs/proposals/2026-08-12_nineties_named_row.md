# Draft: act-name rows for the five blocked Nineties boards

For the bench. **Nothing here is applied.** `check-pack` fails five boards in
`data/packs/nineties.json` with "no `named` row", which blocks `merge-pack` and
therefore blocks the clue-citation rewrite sitting in that pack.

## The gate is currently rejecting the pack's best boards

Measured across all twelve, on-theme rows out of five, and how many of those
rows are act names:

| board  | on-theme | act rows | gate |
|--------|----------|----------|------|
| DEARLY | **5/5**  | 0        | FAIL |
| NICKED | **5/5**  | 0        | FAIL |
| SWEATY | 5/5      | 1        | ok   |
| DERAIL | 5/5      | 1        | ok   |
| MAIDEN | 4/5      | 0        | FAIL |
| NIGHTS | 4/5      | 0        | FAIL |
| ASPECT | 4/5      | 1        | ok   |
| INMATE | 4/5      | 1        | ok   |
| BARING | 3/5      | 0        | FAIL |
| CRIPES | 3/5      | 2        | ok   |
| SUGARY | 3/5      | 1        | ok   |
| VASTLY | 3/5      | 1        | ok   |

Both 5/5 boards fail. Three 3/5 boards pass. The rule measures COMPOSITION —
does a board contain an artist name — and on this pack that runs opposite to
strength. DEARLY and NICKED are built entirely of song titles, which is what
their scenes are for ("Records that open by addressing somebody", "Protect ya
neck").

## No swap is available

Not one of the 40 words in the `acts` tier is spellable from any of the five
bases. This cannot be fixed by exchanging a row for an existing act word — the
tier would have to GROW. Below is every candidate the legal pool offers, drawn
from words that are in ENABLE1, in popular.txt, 3–6 letters, all-distinct, and
spellable from that base.

| board  | candidate | act it would stand for | note |
|--------|-----------|------------------------|------|
| DEARLY | `ray`     | Ray J — *Everything You Want*, 1997; Brandy's younger brother | best of the five |
| NICKED | `kid`     | Kid Capri (Def Jam's tour DJ) or Kid 'n Play, *House Party* | workable |
| BARING | `big`     | The Notorious B.I.G. — *Ready to Die*, 1994 | strong name, generic word |
| MAIDEN | `man`     | Method Man — *Bring the Pain*, 1994 | weak; "man" is a word first |
| NIGHTS | **none**  | — | pool is gist/hint/sight/sting/thin/this/tin… no act exists |

NIGHTS has no candidate at any price. Its base cannot spell an act name.

## Why I am not proposing we just add these four

They fail the pack's own second rule — *never pad a vocabulary to move a
number*, whose test is "would this word be on-theme for a DIFFERENT pack?"
`ray`, `kid`, `big` and `man` are all ordinary words that would sit as
comfortably in a cookout, a garden or a barbershop. Adding them to `acts` to
clear a gate is the exact move that rule was written to stop, and it would
inflate the on-theme rate while making the vocabulary weaker.

## The three real options

1. **Rule the title-only board legitimate.** Require ≥1 on-theme row of ANY
   tier, and keep the act requirement at the PACK level rather than the board
   level — the pack has 9 act rows across 12 boards. This is one line in
   `check-pack.mjs` and it clears all five without touching the vocabulary.
   It is also the option that stops the gate from failing 5/5 boards.
2. **Re-base the five boards.** Honest, and expensive: five re-authors, and
   density has to be measured first per the density rule.
3. **Accept the four pads and re-base NIGHTS.** Cheapest to execute, and the
   one that costs the vocabulary its meaning. Not recommended.

My recommendation is 1. The bench set the act requirement to stop boards that
were about nothing; DEARLY at 5/5 titles is not that board, and the rule as
written cannot tell the difference.
