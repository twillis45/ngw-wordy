# Commissioning the first three readers

The runbook for STORE_READINESS **1.10** — the one blocker no engineering closes,
and the only thing that moves the readiness audit's surface score off 2/10.

`AGENTS.md` budgets it plainly: *"a real reader is budgeted per pack before
anything ships commercially."* Store release is the definition of commercial. It
has not happened for any of the twelve culturally-specific packs.

## Why three, and why these three

1.10 is **per pack**, which is the way out. Twelve readers is not the ask; readers
for the packs you ship is. Clearing the three deepest packs buys a daily rotation
that survives a launch:

| clear | boards | daily pool | repeats after |
|---|---|---|---|
| cookout | 15 | 15 | 0.5 mo |
| + rnb90s | 12 | 27 | 0.9 mo |
| **+ church** | 12 | **39** | **1.3 mo** |
| all twelve | 98 | 98 | 3.2 mo |

The other nine packs stay in the repo behind a flag. They ship as they clear.

## The work being bought

| pack | boards | clues | packet |
|---|---|---|---|
| The Cookout | 15 | 90 | `docs/research/packets/cookout.md` |
| The Nineties | 12 | 72 | `docs/research/packets/rnb90s.md` |
| Sunday Service | 12 | 72 | `docs/research/packets/church.md` |
| | **39** | **234** | |

One reader per pack. **Do not give one person all three** — the packs are
different worlds, and the whole point is lived specificity rather than general
approval. A reader who grew up in the church may have nothing useful to say about
new jack swing, and should not be asked to pretend otherwise.

Each packet is self-contained: every board, every clue, the questions research
already flagged, and space to answer. Generated from `data/themes.json`, so a
packet cannot quote a clue that was replaced. Cited clues are flagged ⚑ — those
are factual claims with a source behind them, and correcting one costs a canon
update as well as an edit.

Regenerate with `node scripts/reader-packet.mjs <theme>` if the pack changes
before the reader starts.

## What you are buying, stated honestly

Not proofreading. `docs/CULTURAL_BOARD.md` says the limit out loud: the bench is
a **structured-perspective exercise, not community consultation**. It is good at
catching flattening, absence and cliché. It is not evidence, and it cannot tell
you whether a clue's tone lands for the people it is about.

The reader is the part that was missing. Say so in the ask. People can tell when
they are being used to rubber-stamp something, and a reader who thinks that is
the job will tell you it is fine.

**Estimated time:** 234 clues at a considered pace is 45–90 minutes per pack,
plus thinking time. Budget for judgment, not for reading speed.

**Rate:** pay a professional consulting rate for the hour, not a gift card. This
is expert work and the project's own doc calls it budgeted. If the number feels
uncomfortable, that is the correct signal that the review is real.

## Who to look for

Per pack, someone with lived proximity to the specific material:

- **The Cookout** — the food, the roles, who owns the grill, what gets said.
  Regional variation matters; a Carolina cookout and a Texas one are not the same
  event, and the pack should not read as though they are.
- **The Nineties** — someone who consumed the music as it came out, on the
  formats the clues name. The pack cites records, dates and chart runs; eight
  clues carry canon citations.
- **Sunday Service** — denomination is the axis that gets flattened. The board
  seated a church-mothers/usher-board voice specifically because the women who
  run it are usually written out.

Sourcing worth trying, in rough order of signal: people already in your network
who fit the pack; local institutions named in the packs themselves; culture
writers and community historians who publish on the subject; HBCU alumni
associations for the adjacent packs. Avoid generic freelance marketplaces for
this — you are buying specificity.

## The ask, ready to send

> I've written a word game whose puzzles are built around [pack subject]. Before
> it ships, I want someone who actually knows this material to read the clues and
> tell me where they're wrong, flat, or not how anyone talks.
>
> It's about 40 boards, roughly 90 short clues. Maybe an hour of real attention.
> I'd pay you [rate] for it.
>
> To be straight about what this is: the writing was done from research and a
> structured review process, not from community consultation. That's a real
> limit and you're the part that was missing. "It's fine" is a useful answer — so
> is "nobody says that." I'm not looking for approval, I'm looking for the things
> I can't see.

Adapt per pack. Name the pack's subject specifically; the generic version reads
as a form letter and will get a form answer.

## What happens to the findings

1. **Tone and phrasing** — edit the clue in `data/packs/<pack>.json`, re-merge,
   regenerate. `npm test` gates the corpus rules.
2. **A cited clue is wrong** — the canon entry that vouches for it must move in
   the same change. `npm test` fails otherwise, deliberately.
3. **A finding research already flagged** — update the entry in `data/canon.json`
   and its verdict. `node scripts/canon.mjs --open` lists what is still open.
4. **A gap: something missing** — that is a new board, not an edit. Run
   `node scripts/viability.mjs` before authoring it.

Record who read what and when. A pack's clearance is a fact about a specific
version of that pack, and a later rewrite does not inherit it.

## Definition of done for 1.10

Three packs, each read by one person with lived proximity, findings applied, and
the reader credited if they want to be. At that point the three packs may ship
commercially; the other nine may not, and the flag is what enforces it.
