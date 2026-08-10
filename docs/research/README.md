# Grounding research — cultural themes

## Why this exists

`docs/CULTURAL_BOARD.md` states one limit plainly, and every authoring wing
repeated it independently: the bench is a **structured-perspective exercise, not
community consultation.** It is good at catching flattening, absence and cliché,
and at generating candidate material at volume. It is not evidence.

300 themed puzzles and 1,798 hand-written clues now ship as the paid half of the
product. A clue is a factual claim wearing a joke — "Emancipation Park, bought by
freedmen in 1872" is either true or it is not, and "the fish is lake trout in
Baltimore" is either how people there talk or it is an outsider guessing. The
authoring agents flagged their own least-confident lines honestly; this directory
is where those flags get checked against sources.

## What this is NOT

This does not replace a paid community reader. Published sources can confirm a
date, a rule, a lineage or a practice; they cannot tell you whether a clue's
*tone* lands for the people it is about. The conk clue is the clearest case —
the history is documented and the question the bench actually asked ("does this
read as respect or as novelty?") is not answerable from a citation. Those stay
open and stay flagged.

## The standard for a finding

Every claim gets a source with a URL, and preference goes, in order:

1. Primary and archival — the text of General Order No. 3, a deed, a census, a
   university's own history page, an organisation's own site.
2. Scholarship and journalism of record — books, university presses, established
   outlets with named authors.
3. Community and practitioner writing — a barber, a stylist, a band alum, a
   local paper. Often the ONLY source for lived practice, and better than a
   national outlet writing about a community from outside.

Wikipedia is a starting point for finding sources, never the citation itself.

An unsourced correction is worth less than the clue it wants to replace. If a
detail cannot be sourced, the finding is "unverifiable" — which is itself useful,
because it tells the author the clue is resting on nothing.

## Output shape

One file per cluster, `docs/research/<cluster>.md`, containing:

- **VERIFIED** — the clue is right. Claim, source, and anything that sharpens it.
- **WRONG** — the clue is factually incorrect. What is true, the source, and a
  drop-in replacement clue that satisfies the authoring contract (24–120 chars,
  never contains its own answer or the answer's first four characters).
- **UNVERIFIABLE** — could not be sourced. Say what was searched.
- **TONE — NEEDS A HUMAN** — the honest residue. Research cannot settle it.
- **MATERIAL WE DON'T HAVE** — specific, sourced detail worth authoring toward.

Quote clues exactly as they appear in `data/themes.json`, with theme and base, so
a correction can be applied without hunting.
