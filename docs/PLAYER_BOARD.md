# Player Board — Wordy

Seated 2026-08-10. Companion to `docs/REVIEW_BOARD_GAME_WING.md` (the stars)
and `docs/CULTURAL_BOARD.md` (the culture bench). **This bench is not experts.
It is players.** 26 seats.

## An honest limit, stated once — same as the cultural bench

These are **structured personas, not real user research.** No human played this
build. This exercise is good at surfacing the demands a segment reliably makes,
the moment a segment reliably quits, and the price a segment reliably refuses.
It is worthless as evidence that any actual person will do any of it. Nothing
here is a substitute for putting the build in ten real hands and watching. A
persona cannot rage-quit, and so a persona cannot tell you the truth about
retention.

## Rules this bench runs under

- **Lens-not-literal.** No fabricated quotes, no claim any real person played it.
- **Brutal, not consensus.** A 9 is not a 10. "Almost" is a fail.
- **No praise sandwiches.** If a persona deletes it in 30 seconds, that is the
  finding, with the timestamp.
- **The bench can BLOCK.**
- **"Grandmother" holds a veto**, cross-listed from the game wing.

## What was reviewed

`data/themes.json` — 397 themed puzzles across 20 themes, plus 123 generated
practice boards. `src/components/Game.tsx` (1,902 lines), `LetterWheel.tsx`,
`src/lib/hints.ts`, `src/lib/storage.ts`. Scores as of `docs/review-tracker.html`.

Shipping mechanics, as actually found in code:

- Six-letter base, six target words on a dial. Extra words score as **bonus**
  but sit outside the grid rank (`Game.tsx:308–321`).
- **Clue mode defaults ON** (`storage.ts:76`) — every themed board carries
  hand-written clues.
- **Hint economy**: every third bonus word earns one token; a letter costs 1, a
  whole word costs 3 (`hints.ts:12–13`, `Game.tsx:497–503`).
- **Daily puzzle + streak.** Only offset 0 touches the streak; practice and
  warm-ups deliberately never do (`Game.tsx:398–407`).
- Share text, shuffle, full-screen, tap-**or**-drag input (both first-class,
  `LetterWheel.tsx:106`), live-region announcements of rank/score.
- **No accounts. No server. Progress and streak live in localStorage.**
- No timer. No difficulty setting. No leaderboard. No head-to-head.
- No text-size, dyslexia-face, or colour-vision setting was found in
  `storage.ts`'s preference shape.

---

# The bench

Every seat answers three things: **STICKY** (what brings them back tomorrow,
what makes them stop — named mechanic, not "more content"), **TO 10+** (one or
two named changes), **PAY** (model and an actual dollar number, or "never").

---

## WING A — ABILITY

### 1. Never played a word game — Marisol, 34, first word game of her life
Opens it. Six letters in a ring, a row of blanks, a sentence about a cousin
nobody can chart. She does not know she is supposed to spell a **six-letter**
word, or that the short words are the same letters. She drags two letters, gets
nothing, and the board looks identical.
**Verdict: gone at 0:40.** The board never says *what the goal is* in words.
- **STICKY** — the first board completing itself in front of her: a guided
  first puzzle that spells one row *for* her and names what just happened.
  Stops her: any board where she taps four times and the screen does not change.
- **TO 10+** — (1) a scripted first board that cannot be lost, with the target
  count said out loud ("six words, all from these six letters"); (2) an
  always-visible "what am I doing" line, not a menu item.
- **PAY** — **Never.** She will not pay for a thing she never understood.

### 2. Casual daily-puzzle player — Dee, 41, does Wordle + Connections at coffee
The daily lands well. One board, a rank, a share string, done in six minutes.
- **STICKY** — the **streak** and the single daily. Stops her: the day she
  clears her browser or gets a new phone and a 60-day streak is gone, because
  it lives in localStorage with no account. That is not a bug to her, it is a
  betrayal, and she does not come back.
- **TO 10+** — (1) streak backup / restore, by any means, even an export code;
  (2) an **archive** she can dip into on a bored Sunday without it feeling like
  cheating.
- **PAY** — **$2.99/mo** or **$24.99/yr**, subscription, *only* for the archive.
  Will not pay for the daily.

### 3. Crossword veteran — Walter, 58, NYT daily solver since the Maleska era
He reads the clues and respects them: they are real clues, not filler. Then
notices the clues are **on by default** and there is no toggle he found without
digging, and that the wheel gives him the letters — which removes the retrieval
that is the whole pleasure of a crossword.
- **STICKY** — a **clueless mode with a rank penalty**: prove you didn't need
  them. Stops him: the hint economy paying out automatically for bonus words he
  found anyway. It hands him help he did not ask for.
- **TO 10+** — (1) clue mode OFF as a *first-run choice*, not a buried setting;
  (2) a "solved clean" mark on the share card and the rank.
- **PAY** — **$14.99 one-time unlock**, full catalogue. Refuses subscriptions
  on principle.

### 4. Competitive Scrabble club player — Renée, 47, rated, studies word lists
Six letters is a *rack*. She wants the anagram space, and she is furious the
bonus words score into a separate pot that does not move her rank
(`Game.tsx:311–321`). "You told me extras count and then you told me they
don't."
- **STICKY** — bonus words counting toward a **real** ceiling, and a full
  post-board word list showing everything she missed. Stops her: bonus points
  that are decorative.
- **TO 10+** — (1) show the complete legal word set at board end with a
  found/missed percentage; (2) one honest number — words found / words possible.
- **PAY** — **$9.99 one-time**, no subscription. Would pay $19.99 if there were
  a rated ladder.

### 5. Speedrunner — Kai, 22, runs Wordle in under 20s, posts times
There is **no timer anywhere.** For Kai the product does not exist as a game.
**Verdict: closed in under a minute, no malice, just nothing to optimise.**
- **STICKY** — a per-board timer, a personal best, and a seeded "everyone gets
  the same board today" race. Stops him: no clock.
- **TO 10+** — (1) millisecond timer with PB and a share string that carries the
  time; (2) a no-clue speed mode so the run is pure.
- **PAY** — **$4.99 one-time** for a timed/ranked mode. Free otherwise.

### 6. Word-search / low-effort player — Angela, 52, plays to switch her brain off
She does not want a rank, a streak, or a decision. She wants to keep tapping.
The daily-one-and-done shape is wrong for her; she'll play four boards or none.
- **STICKY** — the practice set being unlimited and consequence-free. Stops
  her: any nudge back toward the daily, or a screen that says "come back
  tomorrow".
- **TO 10+** — (1) an endless mode that never gates; (2) let her turn the rank
  strip and streak **off** entirely.
- **PAY** — **Ad-supported, free.** Would tolerate an interstitial every 3
  boards. Cash: $0.

---

## WING B — AGE

### 7. Teen — Jaylen, 15
Plays what his group chat plays. The share string is text-only and looks like
nothing; there is no image, no colour block, nothing that reads on a story.
- **STICKY** — a share card people react to, and a "beat my score on today's
  board" link. Stops him: nobody else has it.
- **TO 10+** — (1) an image/emoji-grid share card; (2) a challenge link that
  opens the exact same board.
- **PAY** — **Never.** Free with ads or not at all.

### 8. Twenties — Simone, 26, plays on the train, 12 minutes each way
Six minutes a board is right. She wants a second one and there isn't a clean
"next" that feels sanctioned.
- **STICKY** — a two-board daily ritual sized to a commute. Stops her: the
  practice boards feeling like the B-team, because they carry no clues and no
  theme (`Game.tsx:571` — themes only exist on themed boards).
- **TO 10+** — (1) "Daily + one" as a named, blessed ritual; (2) clues on the
  practice set too, or stop calling it practice.
- **PAY** — **$3.99/mo** bundled with nothing else. Has 6 subscriptions and
  churns one a quarter; this would be first out.

### 9. Thirties–forties, parent — Nia, 38
Plays in the ten minutes after bedtime. The night board is a bright white
screen in a dark room in her memory of it, and she wants the whole thing
dimmable without the OS.
- **STICKY** — the themed clues. She recognises the fish fry and it lands.
  Stops her: getting interrupted mid-board and losing her place — she needs it
  to be exactly where she left it, every time.
- **TO 10+** — (1) an in-app dim/night setting independent of OS theme;
  (2) guaranteed resume mid-board.
- **PAY** — **$19.99 one-time** for the full themed catalogue. This is the
  bench's most willing one-time buyer.

### 10. Fifties–sixties — Cheryl, 61
The clues are the product for her; they read like people she knows. Two
problems: text is small on the dial, and a drag on a phone is fiddly.
- **STICKY** — the cultural clue writing. Stops her: mis-taps that submit a
  word she did not mean.
- **TO 10+** — (1) a text-size control in-app; (2) an explicit submit control so
  a word is never committed by an accidental gesture.
- **PAY** — **$12.99 one-time**. Will not subscribe to a game, ever.

### 11. Seventies-plus — Mr. Emory, 74
Plays on an iPad, one finger, glasses on. Gets it faster than expected because
tap-to-select exists (`LetterWheel.tsx:183–197`) — that path is the reason he
is still here at minute five.
- **STICKY** — quiet pace, no clock, no punishment. Stops him: anything timed,
  and any screen that flashes.
- **TO 10+** — (1) much larger default type; (2) a visible undo that is labelled
  "undo", not an icon.
- **PAY** — **$9.99 one-time**, and only if his daughter sets it up.

---

## WING C — CONTEXT

### 12. Commuter, one hand on a pole — Devin, 29
Thumb-only, phone at chest height. The wheel sits where the layout puts it;
if any control is top-of-screen he cannot reach it standing.
- **STICKY** — being able to finish a board one-handed, in a jolt, without
  losing input. Stops him: a mis-drag on a bump that submits garbage.
- **TO 10+** — (1) every interactive control inside the bottom-third thumb arc;
  (2) forgiving hit targets and a cheap undo.
- **PAY** — **$0.** Ads fine.

### 13. In bed, lights off — Tasha, 31
Last thing before sleep. Any sound or haptic wakes the person beside her; the
code separates sound and haptics as channels (`Game.tsx:688`), which is right,
but she needs them off **by default at night**, not after she's been startled.
- **STICKY** — a quiet, dark, low-stakes board. Stops her: one loud correct-word
  chime at 11:40pm. That's a delete.
- **TO 10+** — (1) sound and haptics default OFF; (2) a true dark/dim board.
- **PAY** — **$2.99/mo**, subscription, if it stayed this calm.

### 14. Lunch break at a desk — Omar, 36, plays on the web build
Keyboard, mouse. Hover-to-trace exists on pointer devices, which he likes.
- **STICKY** — a board that fits in 20 minutes with a scoreable end. Stops him:
  finishing the daily by 12:07 with nothing sanctioned to do next.
- **TO 10+** — (1) type-the-word entry, not just trace; (2) an archive.
- **PAY** — **$29.99/yr** subscription, if the archive is real.

### 15. Waiting room — Gloria, 55, no signal, 40 minutes to kill
Offline works (service worker ships). She'll play eight boards. Then she is out
of themed content in the theme she liked.
- **STICKY** — theme *binging*: pick "Sunday Service" and play the whole set.
  Stops her: getting shuffled out of the theme she chose.
- **TO 10+** — (1) play-a-theme-through mode; (2) a per-theme completion meter.
- **PAY** — **$14.99 one-time** for all 20 themes.

### 16. 900-day Wordle streak — Priya, 44
Reads the streak line, then reads that it lives in localStorage with no account
and no export. **She will not start a streak she can lose to a browser
setting.** Plays the daily as a one-off and does not adopt.
**Verdict: does not commit, ever, until the streak is durable.**
- **STICKY** — a streak she can trust. Nothing else matters to her.
- **TO 10+** — (1) account or export/import code for streak + history;
  (2) one streak freeze a month, honestly labelled.
- **PAY** — **$4.99/mo** for durable history and archive. She already pays NYT.

### 17. Parent playing with a child — Marcus, 43, with his 9-year-old
Two problems at once. The clues assume adult cultural memory, and there is no
two-player or hand-off shape, so it's one person driving and one watching.
- **STICKY** — a turn-taking or "you find one, I find one" mode. Stops them:
  the kid getting bored in three minutes while dad reads a clue about a repast.
- **TO 10+** — (1) an easy/family board set with plain clues; (2) a pass-the-
  phone turn mode.
- **PAY** — **$9.99 one-time** for a family pack, if it existed. Won't pay for
  the adult catalogue.

---

## WING D — ACCESSIBILITY

### 18. Low vision — Bea, 66, uses 200% system text
No in-app text-size control was found in the preference shape
(`storage.ts:40–76`). A dial of six letters is a fixed geometric layout; system
Dynamic Type will not save it. She zooms, the wheel clips, she leaves.
**Verdict: out in about 90 seconds.**
- **STICKY** — legibility. There is no other hook until she can read it.
- **TO 10+** — (1) an in-app type-scale that actually reflows the dial;
  (2) a high-contrast board.
- **PAY** — **$4.99 one-time** if it were readable. $0 as shipped.

### 19. Colour-vision-deficient — Tom, 39, deuteranopia
The correct/incorrect and locked/available states need a non-hue signal. If
"found" is carried by green alone anywhere on the tray or rank strip, he is
guessing.
- **STICKY** — unambiguous state. Stops him: two tiles that look identical to
  him and different to everyone else.
- **TO 10+** — (1) shape or fill-pattern paired with every colour-coded state;
  (2) a text label on the rank strip, not just a colour bar.
- **PAY** — **$9.99 one-time**. Would pay; expects to be designed for.

### 20. One-handed / motor-limited — Jess, 33, limited fine motor in one hand
The tap path is the reason this is playable at all — drag-to-connect is a
fine-motor gesture she cannot reliably produce. But she needs to know the tap
path exists; nothing on screen advertises it.
- **STICKY** — a genuinely drag-free full path with generous targets. Stops
  her: a drag threshold that eats her taps as micro-drags
  (`LetterWheel.tsx:93`).
- **TO 10+** — (1) surface "tap the letters" in the first board;
  (2) an adjustable drag threshold, or a hard tap-only mode.
- **PAY** — **$0**, on principle: access is not a feature to sell.

### 21. Screen-reader user — Andre, 30, VoiceOver
Live-region announcements exist and are terse and useful (`Game.tsx:326–332`).
That is above average. But a circular wheel with no linear reading order and no
spoken statement of the goal leaves him building a mental model from nothing.
- **STICKY** — being told where he is: "letter 3 of 6, C". Stops him: a rank
  announcement with no announcement of the board's *shape*.
- **TO 10+** — (1) a spoken board overview on entry (letters, rows, lengths);
  (2) a text-entry alternative so he does not have to navigate geometry at all.
- **PAY** — **$4.99 one-time**. Low, and he means it: he pays less because he
  gets less.

### 22. Dyslexic player — Corey, 27
Six scrambled letters and clue text in an unadjustable face is the hardest
possible presentation. Clue mode ON actually **helps** him — it converts a
letter-recall task into a meaning task.
- **STICKY** — the clues. Genuinely the best thing here for him. Stops him:
  long clue sentences in tight leading.
- **TO 10+** — (1) letter-spacing / line-height / font-choice control;
  (2) no penalty and no timer, ever, on clue use.
- **PAY** — **$7.99 one-time** for the accessibility settings bundle — and he
  notes, correctly, that charging for that is ugly.

---

## WING E — WORD-GAME DEMOGRAPHICS, HONESTLY

### 23. NYT Games subscriber — Ellen, 49, pays $6/mo, plays five games daily
Benchmarks everything against Spelling Bee, and Wordy is structurally close to
it: a letter set, a target set, bonus words, a rank ladder. Her question is
blunt — *why would I add a sixth game*? The answer is the clues and the
cultural specificity, and that answer only works if it is on the front door.
- **STICKY** — one distinctive daily she cannot get in her bundle. Stops her:
  it reading as a Spelling Bee variant.
- **TO 10+** — (1) lead with the theme, not the wheel — the theme name and clue
  voice are the differentiator; (2) an archive, because she is a completionist.
- **PAY** — **$4.99/mo or $39.99/yr**. Highest-paying seat on the bench.

### 24. Wordscapes / Word Cookies player — Latoya, 45, plays 40 min/day, ad-tolerant
This is the biggest real market on the bench and the one this build serves
worst. She expects: hundreds of levels in a visible run, coins, a daily reward,
a map, and ads she trades for hints. She gets: one board a day and a hint
economy that pays out at every third bonus word — which she likes, but the
faucet is far too slow.
- **STICKY** — a visible level run with a progress map, and coins she can also
  *earn by watching an ad*. Stops her: a daily gate. She plays in 40-minute
  sessions and this gives her six minutes.
- **TO 10+** — (1) a long, numbered, uninterrupted level path across the 397
  themed boards; (2) rewarded video for hint tokens.
- **PAY** — **$0 cash, ad-supported**, occasionally **$2.99** for a coin pack
  when stuck. She is the volume, and she is the ad revenue.

### 25. Words With Friends player — Rob, 51
Plays word games because they're **social**. There is no asynchronous opponent,
no friend list, no head-to-head. There is a share string.
**Verdict: leaves inside two minutes. Nothing to play *with*.**
- **STICKY** — an opponent. Nothing else.
- **TO 10+** — (1) async head-to-head on the same daily board with a score
  compare; (2) a friend leaderboard.
- **PAY** — **$0** solo. **$2.99/mo** ad-free if there were opponents.

### 26. Scrabble club member — Harold, 63
Wants provable legality. Which dictionary, which word list, is `cons` in it,
and can he challenge. Wordlist provenance is settled in the repo — but it is
not settled *on screen* for him.
- **STICKY** — an in-board definition and a stated word list. Stops him: one
  rejected word he knows is legal, with no explanation. One is enough.
- **TO 10+** — (1) name the dictionary in-app; (2) a "why was this rejected"
  path.
- **PAY** — **$9.99 one-time.**

### 27. ESL learner — Anh, 24, uses word games to build vocabulary
Definitions exist in the codebase (`src/lib/definitions.ts`) and that is the
single most valuable thing here for her. But the **themed clues are the hardest
possible English** — idiomatic, elliptical, culturally loaded. "Nobody can chart
it and nobody asks" is not parsable for her. The 123 practice boards are her
real product and they are labelled as the warm-up.
- **STICKY** — definitions on every found word, and a saved word list she can
  review. Stops her: clue text she cannot decode, which makes her feel stupid
  rather than taught.
- **TO 10+** — (1) a review list of every word she's found, with definitions;
  (2) promote the practice set to a first-class "plain clues" mode.
- **PAY** — **$4.99/mo** — she pays for language tools, not games, and would
  file this under language tools if it had the word list.

### 28. Non-Black player meeting the packs — Karen S., 57, suburban Ohio
Twenty of twenty themes are Black American cultural life. She hits "Repast" and
"The Line Forms" and does not know the referents. Two failure modes, and the
build currently invites the wrong one: she can experience it as *learning
something*, or as *being locked out*. With no framing on the board and a clue
she cannot solve, she gets locked out.
- **STICKY** — clues that are solvable from the letters even when the reference
  is new, plus a one-line "what this is" that teaches rather than tests. Stops
  her: three unsolvable boards in a row.
- **TO 10+** — (1) a short theme note on entry, in the same voice, that gives
  the outsider a handhold without apologising to the insider; (2) a difficulty
  signal so she can choose a board she can finish.
- **PAY** — **$9.99 one-time.** She'd buy it as a *cultural* product; she will
  not subscribe.

---

## WING F — SPENDERS AND NON-SPENDERS

### 29. Never paid for an app — Terrell, 28
Has installed 300 apps and paid for zero. Will watch any number of ads.
- **STICKY** — free forever with no wall. Stops him: a paywall on day 3.
- **TO 10+** — a free tier that is a real game, not a demo.
- **PAY** — **$0. Ever.** Says so plainly.

### 30. Six subscriptions — Priya (cross-listed, seat 16) and Marla, 39
Marla pays for Duolingo, NYT, Calm, Spotify, iCloud, Strava, and audits them
every January. A seventh must survive that audit.
- **STICKY** — daily use she can see in a stats screen when she audits. Stops
  her: any month she opens it fewer than eight times.
- **TO 10+** — (1) a personal stats page that proves usage; (2) annual pricing
  so the decision is once, not twelve times.
- **PAY** — **$29.99/yr**, annual only.

### 31. One-time unlocks only — Greg, 46
Buys premium unlocks, refuses recurring billing categorically. Also refuses
consumables — "coins are a subscription with extra steps".
- **STICKY** — owning the whole catalogue and never being asked again.
- **TO 10+** — (1) one "unlock everything" SKU, permanent, restorable;
  (2) no coin packs anywhere near it.
- **PAY** — **$19.99 one-time**, and he'd pay it today at 397 puzzles.

---

# SYNTHESIS

## Retention mechanics the bench most wants, ranked

1. **A durable streak and history — an account, or at minimum an export/import
   code.** Named by seats 2, 16, 30. It is the #1 *blocker* below as well as the
   #1 want; localStorage-only progress is the thing that stops committed daily
   players from ever committing.
2. **An archive / level run through the 397 themed boards.** Named by 2, 6, 14,
   15, 23, 24. The catalogue is the asset and the daily gate hides ~53 hours of
   it behind a one-a-day drip.
3. **Bonus words that count for something real.** Named by 4, 24, 26. The code
   deliberately splits grid score from total score (`Game.tsx:311–321`) and the
   bench reads that as a broken promise. Give bonus words a visible ceiling and
   an end-of-board "found N of M".
4. **Per-theme play-through with completion meters.** Named by 15, 23, 24.
   Twenty named themes are already an obvious progression spine.
5. **A social hook — challenge link, friend compare, async head-to-head.** Named
   by 7, 25, and it is the whole product for 25.
6. **Definitions + a saved word list.** Named by 21, 26, 27. Cheap; already half
   built in `src/lib/definitions.ts`.
7. **A timer / speed mode (opt-in).** Named by 5, 14. Small segment, absolute
   requirement within it.

## The single most-named blocker

**Progress is not durable.** No account, no sync, no export — streak, history
and hint balance live in localStorage. Seats 2, 16 and 30 all refuse to invest
because of it, and those are exactly the seats that pay. The second-most-named
is the **daily gate on a 397-puzzle catalogue** (seats 6, 15, 23, 24) — the
build's largest asset is its least reachable.

Runner-up, and it is close: **no first-run teaching.** Seat 1 leaves at 40
seconds without ever learning the goal, and the tracker already scores
onboarding 8 with "not yet watched by a real first-timer." The bench agrees with
the tracker and says the missing thing is specific — the *number of target
words and their source* is never stated in plain language on the board.

## Price recommendation

**What the bench actually said:**

- **Never / $0** — 6 seats (1, 7, 12, 20, 24-cash, 29)
- **One-time** — 12 seats, range **$4.99–$19.99**, median **$9.99**
  (3: $14.99 · 4: $9.99 · 5: $4.99 · 9: $19.99 · 10: $12.99 · 11: $9.99 ·
  15: $14.99 · 17: $9.99 · 18: $4.99 · 19: $9.99 · 21: $4.99 · 22: $7.99 ·
  26: $9.99 · 28: $9.99 · 31: $19.99)
- **Subscription** — 7 seats, **$2.99–$4.99/mo**, **$24.99–$39.99/yr**
  (2, 8, 13, 14, 16, 23, 27, 30)
- **Ad-supported with occasional consumable** — seat 24, the largest real-world
  segment, at ~$2.99 impulse.

**Recommendation: a $14.99 one-time "full catalogue" unlock, with a
$29.99/year subscription offered only for the things that genuinely recur** —
durable history/sync, and new themed packs. Do **not** ship both a coin economy
and an unlock (seat 31 walks, and seat 3 walks louder). $14.99 sits at the top
of the one-time cluster and is defensible against 397 hand-authored puzzles; the
tracker already moved paid readiness up on catalogue size, and this bench agrees
the catalogue now supports an ask.

**What the free tier must contain for the paid tier to sell:**

- The **daily, forever, free**, with a real streak. It is the acquisition
  channel and every seat that pays found the product through it.
- **All 123 practice boards, unlimited**, with clues. Seats 1, 6, 27 live here
  and only convert after weeks.
- **At least two full themed packs free** — enough to prove the clue writing is
  the product, since the clue voice is what seats 9, 10, 23 and 28 are buying.
- **Every accessibility setting free.** Not negotiable, see BLOCKS.
- Free must never be a demo. Seats 24 and 29 are the volume and they never pay
  cash; they must have a game.

## What the bench BLOCKS

1. **BLOCK — charging for accessibility.** Seat 22 named a "$7.99 accessibility
   bundle" and then condemned it; seat 20 refuses to pay for access at all.
   Type size, contrast, tap-only input, motion and sound controls ship in the
   free tier or the bench blocks the paywall entirely.
2. **BLOCK — shipping a paid tier before an in-app first-run teach.** Seat 1
   leaves at 0:40 without ever learning the rules; you cannot sell to people who
   never understood the game. **"Grandmother" veto is exercised here.**
3. **BLOCK — any timed or streak-punishing mechanic applied by default.** Seats
   11, 18, 22 and 6 are damaged by it. Timers ship opt-in only (seat 5 gets his
   mode, nobody else gets a clock).
4. **BLOCK — sound and haptics defaulting ON.** Seat 13 is a same-night delete.
   Default both off; the channel separation at `Game.tsx:688` is already the
   right architecture for it.
5. **BLOCK — shipping the themed catalogue as paid without a theme-entry note.**
   Seat 28 gets locked out rather than taught, and seat 17's child can't play at
   all. The cultural bench's dignity findings and this bench's outsider seat
   point at the same missing artefact: one line of framing per theme, in voice.

## Honest scores from this bench

| Dimension | Score | Why |
|---|---|---|
| First-run comprehension | **3/10** | Seat 1 leaves at 0:40. The goal is never stated. |
| Day-2 return | **5/10** | Streak exists; it is not durable, so it is not trusted. |
| Day-30 return | **4/10** | 397 puzzles behind a one-a-day gate, no archive, no run. |
| Accessibility as a player experiences it | **4/10** | No type scale, no contrast mode, tap path unadvertised. Screen-reader announcements are the one bright spot. |
| Willingness to pay | **6/10** | Real one-time demand at ~$10–15; nothing to sell to the biggest segment. |
| Social | **1/10** | Nothing. Seat 25 leaves in two minutes. |

**Surface score = lowest dimension = 1/10.**

Again: **structured personas, not real user research.** The scores above are a
model of demand, not a measurement of it.
