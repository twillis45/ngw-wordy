# Spec — ghost runs

Written 2026-08-21, unbuilt. Question 1 ruled the same day; 2, 3 and 4 are
still open, and the replay must not start until 2 has an answer. Companion to the chain ladder, which shipped the
same day.

**The idea.** A shared link replays a friend's solve against yours — not their
score, their *run*: which word they found first, how long the six-letter base
held out, where they stalled. A ladder says who won. A ghost says how.

**Why this is a spec and not a branch.** The ladder was an extension of a
mechanic that already existed: a codec change, a state field, and a card.
This is a feature with new stored state, a new encoding, and a renderer that
has to share a timeline with animations that were retuned this week. It should
be decided on before it is started, not discovered halfway.

---

## What has to exist that does not

### 1. A recorded run

Nothing today records ORDER. `Progress.words` is a `Record<puzzleId, string[]>`
and the array is append-ordered by accident of insertion, not by contract —
nothing asserts it and a restore from backup could reasonably reorder it. There
is no timing at all.

A run needs, per board: each word in the order it was banked, and a coarse
offset from the start. Coarse on purpose — second resolution is enough to
replay a race and is far less identifying than milliseconds.

This is the first thing in this codebase that would store a **timeline of user
behaviour**. Everything stored today is state (what you have, what you set).
That is a real line to cross and it should be crossed deliberately:

- It is still local and still never transmitted except in a link the player
  themselves sends. That keeps 1.5 and 1.6 accurate as written.
- But a run is more personal than a score. It shows how someone thinks.
- **It must be opt-in per share, never recorded silently.** Record on the
  board being played, keep it in memory, and persist only if the player
  chooses to share a ghost.

### 2. An encoding that fits in a URL

Six words plus offsets. Naively — `crafty:12,cart:31,tray:48,cry:70,fat:88,fry:95`
— is ~55 characters before escaping, which is fine. But the words are already
known to the receiver: they are the board's own grid. So a ghost needs only
**indices into the grid plus offsets**, e.g. `0.12-3.31-1.48`, which lands
around 25 characters and stays sendable.

The chain and the ghost must coexist in one hash without either growing
unbounded. `CHAIN_MAX` is 12 for that reason; a ghost should carry ONE run,
not a history of them.

### 3. A replay that shares the board with a live game

The hard part, and the reason for the spec.

The tray, the dial detent, the letter flight and the fold all currently
describe ONE player's progress. A ghost has to occupy the same board without
lying about whose progress is whose:

- The dial detent advances per solved row. Whose rows? A ghost solving row
  three cannot turn the player's dial.
- A folded row shows the word. If the ghost has solved a row the player has
  not, showing it spoils the puzzle outright.
- `justSolved` gates the landing animation on this session's solves. A ghost's
  solves are neither this session's nor restored.

The only reading that survives all three: **a ghost is a clock, not a board.**
It says "they had four rows by now" without saying which four. That preserves
the puzzle, keeps one board owned by one player, and needs no new tray states —
a marker against the rank bar, moving in replayed time.

---

## Proposed shape

- **Recording:** in memory during play; per board; word index plus second
  offset. Persisted only on an explicit "share a ghost".
- **Encoding:** `ghost=` in the hash, grid indices and offsets, one run.
- **Replay:** a second marker on the existing RankBar, advancing on the
  ghost's timeline while the player plays. No tray changes, no dial changes.
- **Controls:** start on first letter placed; the ghost is a race the player
  can ignore, never a countdown that pressures. It must be dismissible.

## What must be decided before building

1. ~~**Is a behavioural timeline something we are willing to store at all**,
   even locally and even opt-in?~~ **RULED 2026-08-21: yes, on the narrowest
   terms — recorded in memory while playing, persisted ONLY if the player
   chooses to share a ghost, never transmitted except in a link they send
   themselves.** Silent recording is not authorised and neither is persisting
   a run the player did not choose to share. STORE_READINESS 1.5 and 1.6 stay
   accurate as written and `connect-src 'self'` is untouched.
2. **Does a race belong in this game?** The Wardle lens on that board opposed
   mechanics that make the game about other people. A ladder is asynchronous
   and ignorable; a ghost ticking beside you is not obviously either.
3. **What happens when the ghost wins?** Every existing completion state
   assumes the player finished. A ghost that finishes first needs an answer
   that is not a loss screen.
4. **Does it survive an interruption?** The interrupted-player seat is the one
   most likely to be harmed here: a race that cannot be paused is a race that
   punishes a commute.

## Cost, honestly

Recording and encoding are small — a day, with tests. The replay is not: it is
new UI on a surface with three interacting animation systems that were only
just measured and guarded. Budget the replay separately from the codec, and do
not start the replay until questions 1 and 2 above have answers.

## What NOT to do

Do not replay a ghost's solved WORDS onto the tray. It spoils the board, it
breaks the one-player-one-board invariant the tray rests on, and it makes
every animation state ambiguous about whose progress it is describing.
