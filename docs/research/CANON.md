# The canon — grounded facts behind the themed clues

`data/canon.json` is the durable store. `docs/research/*.md` are the working
notes that produced it; the canon is what survives them.

## Why a file and not a document

Six prose research files are read once. The problem they exist to solve is
ongoing: 300 themed boards make roughly 1,800 factual assertions, and a year
from now nobody will remember which of them were checked, which were guesses
that survived, and which were corrected and why. A clue that was verified looks
exactly like a clue that was never examined.

So the canon is machine-readable and **keyed to the clues it grounds**. `npm test`
fails if an entry points at a clue that no longer exists, which means editing a
clue out from under its citation is caught rather than silently orphaning the
research that justified it.

## Entry shape

```json
{
  "id": "juneteenth-general-order-3-date",
  "cluster": "juneteenth",
  "claim": "General Order No. 3 was issued at Galveston on 19 June 1865.",
  "verdict": "verified",
  "detail": "Issued by Maj. Gen. Gordon Granger. The 'read from a balcony' detail is traditional rather than documented; the order was posted and read at several sites.",
  "sources": [
    { "title": "…", "url": "https://…", "kind": "primary" }
  ],
  "clues": [{ "theme": "juneteenth", "base": "herald", "word": "read" }],
  "replacement": null
}
```

- **`verdict`** is one of:
  - `verified` — the clue's claim holds. The entry records what it rests on.
  - `corrected` — the clue was wrong and has been changed. `replacement` carries
    the new text, and `detail` says what was wrong. **The old clue stays quoted
    in `detail`**, because a correction nobody can see is a correction nobody can
    check.
  - `unverifiable` — could not be sourced. `detail` says what was searched. This
    is a real finding: it means the clue rests on nothing, and whether that is
    acceptable is a judgement call rather than an oversight.
  - `tone` — research cannot settle it. Reserved for questions about how a clue
    *reads* to the people it is about, which is a human's call and stays open.
- **`kind`** on a source is `primary`, `scholarship` or `community`, in the
  order of preference set out in the README. `community` is not a lesser tier —
  for lived practice it is frequently the only accurate source, and better than
  a national outlet describing a community from outside.
- **`clues`** may be empty for a `tone` entry that covers a whole pack.

## Using it

```bash
node scripts/canon.mjs                 # summary by cluster and verdict
node scripts/canon.mjs juneteenth      # everything grounding one cluster
node scripts/canon.mjs --open          # only what still needs a human
node scripts/canon.mjs --check         # validate refs, sources, schema
```

## What the canon does not do

It does not make the content safe to ship commercially on its own. Per
`docs/CULTURAL_BOARD.md`, budget a real community reader per pack. The canon's
job is to make that reader's time expensive-well-spent: everything a citation
could settle is already settled and written down, so the reader is asked only
the questions that actually need them — which are collected under
`node scripts/canon.mjs --open`.
