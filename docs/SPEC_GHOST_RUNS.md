# Spec — ghost runs

Written 2026-08-21, unbuilt. **All four questions ruled the same day** — see
each one below. The replay is now unblocked in principle and still deliberately
unbuilt: the codec is a day's work and the replay is new UI on a surface with
three interacting animation systems that were measured and guarded this week.
Build the codec first and budget the replay separately, as the cost section
below says. Companion to the chain ladder, which shipped the
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
2. ~~**Does a race belong in this game?**~~ **RULED 2026-08-21: not as a
   default, and not as anything that ticks at you.**

   Three seats on PLAYER_BOARD say a race drives them out, in their own words:
   Mr. Emory (74) — *"quiet pace, no clock, no punishment. Stops him: anything
   timed"*; Angela (52) — *"does not want a rank, a streak, or a decision …
   consequence-free"*; Tasha (31), playing in bed — *"quiet, dark, low-stakes …
   one loud chime at 11:40pm. That's a delete."*

   That is not a close call and it is not a matter of tuning. For those three,
   a visible opponent advancing while they think is the reason they stop
   playing, so a ghost that is on by default costs more players than it wins.

   What survives: a ghost is **off unless the player opens one**, opt-in per
   view rather than per setting, and **dismissible at any moment without
   losing the board**. The spec's own reading — a ghost is a clock, not a
   board — was right, and this adds the harder half: even as a clock it does
   not get to be there uninvited.
3. ~~**What happens when the ghost wins?**~~ **RULED 2026-08-21: nothing
   happens.** The marker reaches the end and stops. No modal, no "they beat
   you", no state change on the player's board, no sound.

   The temptation is a moment — a flourish, a "so close". For the three seats
   above, a *you lost* beat is precisely the thing that ends the relationship,
   and this game has no other loss state anywhere: you cannot fail a board,
   only not finish it yet. A ghost that introduces the first losing moment in
   the product would be importing a mechanic the rest of the design refuses.
4. ~~**Does it survive an interruption?**~~ **RULED 2026-08-21: yes, because
   the ghost's clock only advances while the player is actually on the board.**

   Not wall-clock time. The same rule the stall clock already follows, and for
   the same reason — it resets on `dialogOpen()` so that time spent in a sheet
   is not counted as being stuck, because *being stuck means staring at the
   board*. A ghost measured against wall-clock time punishes Devin's commute,
   Gloria's waiting room and Nia's interruptions for events that have nothing
   to do with how they played.

   This also removes the need for a pause control: there is nothing to pause,
   because the ghost is already stopped whenever the player is not playing.

## Cost, honestly

Recording and encoding are small — a day, with tests. The replay is not: it is
new UI on a surface with three interacting animation systems that were only
just measured and guarded. Budget the replay separately from the codec, and do
not start the replay until questions 1 and 2 above have answers.

## What NOT to do

Do not replay a ghost's solved WORDS onto the tray. It spoils the board, it
breaks the one-player-one-board invariant the tray rests on, and it makes
every animation state ambiguous about whose progress it is describing.
