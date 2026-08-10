<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Themed content is cited content

The paid half of this game is 300 hand-authored themed puzzles across 15
themes, and most of them describe Black American cultural life. Before writing,
changing or reviewing any of that content, read:

- `docs/CULTURAL_BOARD.md` — who reviews this material and the rules the bench
  runs under. It states one limit plainly and it is not negotiable: this is
  structured perspective, **not** community consultation, and a real reader is
  budgeted per pack before anything ships commercially.
- `docs/AUTHORING.md` — the binding spec for writing clues, including the rules
  that were bought with mistakes rather than reasoned out in advance.
- `docs/research/CANON.md` and `data/canon.json` — what the clues actually rest
  on. `node scripts/canon.mjs --open` lists the questions research could not
  settle, which are the only ones a human reader should be spending time on.

Two things that will bite you:

**A clue is a factual claim wearing a joke.** "Emancipation Park, bought by
freedmen in 1872" is either true or it is not. If you edit a clue that carries a
canon citation, the citation now vouches for text nobody checked — `npm test`
fails on that, deliberately. Update the canon entry in the same change.

**Author against the vetted pool, never against a hunch.** `node
scripts/vet-bases.mjs` writes `data/base-pool.json`: every base the build would
accept, with its legal common rows. Authoring the first two packs without it
cost seven full re-authors, and skipping the anagram check cost fourteen boards
— a base is only ever six letters on a dial, so `mantle` and `mental` are the
same puzzle wearing different names.
