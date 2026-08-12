/**
 * Pure game engine. No React, no DOM, no storage — every function here is
 * deterministic so the rules can be tested without rendering anything.
 */

export type Puzzle = {
  id: number;
  letters: string[];
  base: string;
  grid: string[];
  bonus: string[];
  maxScore: number;
  /** Redacted definition per grid word — the clue-mode question. */
  clues: Record<string, string>;
  /**
   * Escalating wheel: letters in unlock sequence, and how many start active.
   * Computed at build time because it must guarantee the opening rows are
   * solvable with the letters available.
   */
  unlockOrder: string[];
  startActive: number;
  /** How hard this puzzle is, 0 (kindest) to 1. Drives the warm-up ladder. */
  difficulty: number;
  /** Authored theme, when one claims this puzzle's base word. */
  theme: {
    id: string;
    name: string;
    blurb: string;
    /** The tradition, when the theme's name does not say it. */
    category?: string | null;
    /** What THIS board is about — see build-puzzles.mjs for why. */
    scene?: string | null;
  } | null;
};

/**
 * Which wheel letters are live, given how many rows are done.
 *
 * Escalating mode starts with only the letters of the shortest target word and
 * unlocks one per cleared row, so the search space grows as you play and the
 * last word is a different problem from the first.
 */
export function activeLetters(
  puzzle: Puzzle,
  rowsDone: number,
  escalating: boolean
): string[] {
  // An ARRAY, so a repeated letter's two copies stay two entries. A Set here
  // was correct only for as long as every base had six distinct letters.
  if (!escalating) return [...puzzle.letters];
  const n = Math.min(
    puzzle.unlockOrder.length,
    puzzle.startActive + Math.max(0, rowsDone)
  );
  return puzzle.unlockOrder.slice(0, n);
}

/**
 * The row a clue is currently pointing at, cycling through unsolved rows.
 *
 * `reachable` matters when escalating mode is also on: pointing at a word
 * whose letters are still locked poses a question that cannot be answered.
 * Falls back to the unreachable rows only when nothing is reachable, so the
 * clue card never goes blank mid-puzzle.
 */
export function clueTarget(
  grid: string[],
  done: (w: string) => boolean,
  cursor: number,
  reachable: (w: string) => boolean = () => true
): string | null {
  const open = grid.filter((w) => !done(w));
  if (open.length === 0) return null;
  const pool = open.filter(reachable);
  const list = pool.length > 0 ? pool : open;
  return list[((cursor % list.length) + list.length) % list.length];
}

/**
 * Can `word` be spelled from `letters`, CONSUMING each tile at most once?
 *
 * A multiset question, not a set question. While every base was six distinct
 * letters the two were accidentally equivalent — you can never need a letter
 * twice because you never have it twice — and every check in this engine took
 * the cheaper form. Allowing a repeated letter in a base (COTTON, CHURCH,
 * POTATO, COFFEE) ends that equivalence, and in the dangerous direction: a set
 * check says TOTTER is spellable from COTTON, because both T and O are
 * "present". They are present twice and TOTTER wants three.
 *
 * That is the same class of bug as the bitmask which once counted `cool` and
 * `total` as spellable from six distinct letters, inflating a measurement from
 * 45 boards to 118 and producing LOCUST. See multiset.test.ts, where LOCUST is
 * kept as a named regression case.
 */
export function canSpell(word: string, letters: string): boolean {
  const pool = new Map<string, number>();
  for (const ch of letters) pool.set(ch, (pool.get(ch) ?? 0) + 1);
  for (const ch of word) {
    const left = pool.get(ch) ?? 0;
    if (left === 0) return false;
    pool.set(ch, left - 1);
  }
  return true;
}

/**
 * Can this word be spelled with the letters currently unlocked?
 *
 * Takes an ARRAY rather than a Set, because with a repeated base letter the
 * two copies unlock separately and a Set cannot hold that: unlocking "T" would
 * silently unlock both tiles, and the escalating wheel would offer a word the
 * player cannot yet spell.
 */
export function isReachable(word: string, active: readonly string[]): boolean {
  return canSpell(word, active.join(''));
}

export type PuzzleFile = {
  version: number;
  wheel: number;
  /** Indices of the kindest puzzles, easiest first — the warm-up ladder. */
  starters: number[];
  puzzles: Puzzle[];
};

/**
 * Which puzzle a player should be on.
 *
 * A first game currently landed on whatever the date happened to pick, and
 * measuring the set showed the grid is only 51% common words on average — the
 * day-1 puzzle was 33%, four of six rows obscure. Competitors do not open that
 * way: Wordscapes starts on short, common words and ramps, because a first
 * level that reads as impossible is where onboarding dies.
 *
 * So new players get a short warm-up on the kindest puzzles in the set before
 * joining the daily. It is stated plainly in the UI rather than hidden.
 */
/**
 * Storage key for a puzzle's found words.
 *
 * Plain puzzle ids meant a player who got all the way round the catalogue was
 * served their own completed board. The cycle number makes lap two a genuinely
 * fresh sheet without duplicating any content, and lap zero keeps the bare id
 * so no migration is needed for anyone playing today.
 */
export function progressKey(puzzleId: string | number, cycle = 0): string {
  return cycle === 0 ? String(puzzleId) : `${puzzleId}#${cycle}`;
}

/**
 * The stable half of a progress key: the BASE WORD, never the numeric id.
 *
 * `puzzle.id` is `puzzles.length + 1` at generation time, so it is an array
 * POSITION wearing an identifier's name. Cutting two packs renumbered every
 * board generated after them, and the saved progress — keyed by id — stayed
 * pointing at whatever board inherited the number. Observed in a real save:
 * key `63#206` held CRAFTY's seventeen words while id 63 had become INSTEP.
 * `clearedIds` is keyed the same way, and the daily SKIPS cleared boards, so
 * a shift can also hide boards a player never finished.
 *
 * The base word is unique across the catalogue — a base is six letters on a
 * dial, and the suite already asserts no two boards share a letter-set — so
 * it identifies a board by what the board IS rather than where it landed.
 */
export function puzzleKeyFor(puzzle: { base: string }, cycle = 0): string {
  return progressKey(puzzle.base, cycle);
}

/**
 * How many puzzles the daily actually rotates through.
 *
 * The authored catalogue, when there is one. This has to be a single exported
 * definition because TWO things depend on it and they must agree: the daily's
 * seed, and the lap counter that keys stored progress. When the daily was
 * narrowed to authored boards only, the lap counter was still counting laps of
 * the whole 520-board set — so a player who cleared all 397 would be served
 * their own solved boards for up to 123 days before the cycle ticked over and
 * gave them fresh storage keys. That is the day-241 bug again, wearing
 * different numbers, which is exactly why the value now has one home.
 */
/**
 * Themes that are NOT drawn from Black American cultural life.
 *
 * The owner ruled that not every theme will be that material. The combined
 * board accepted the decision and attached one hard requirement to it, from the
 * highest-paying seat: THE DAILY ALWAYS PULLS FROM A CULTURAL PACK, and general
 * packs are reachable only through the picker.
 *
 * Her reasoning is the whole business case. She adds a sixth daily word game
 * for the one thing her existing bundle cannot produce; a daily that can serve
 * The Garden is a daily she can get elsewhere. So this is not a taste setting —
 * it is the difference between a distinctive daily and a Spelling Bee variant,
 * and it is enforced in `puzzleForPlayer` rather than left to authoring
 * discipline.
 *
 * Listing the GENERAL ones rather than the cultural ones is deliberate: a new
 * theme added without touching this file defaults to cultural, and therefore to
 * the daily. Forgetting to update a list should never be able to quietly
 * demote the material the product is built on.
 */
const GENERAL_THEMES = new Set<string>(['roadtrip', 'garden', 'diner', 'hardware']);

/** Is this theme part of the daily rotation? */
export function isDailyEligible(themeId: string | null | undefined): boolean {
  return !themeId || !GENERAL_THEMES.has(themeId);
}

/**
 * Put the answer back into a clue that was written around it.
 *
 * Clues carry their citation with the answer blanked — "Boyz II Men, 1992 —
 * ——— of the Road, thirteen weeks at number one" — because naming the record
 * is what makes the clue worth reading, and printing the word would hand over
 * the row. Once the row is SOLVED that trade is over: the player has earned the
 * word, and the blank is now just the sentence withholding its own point.
 *
 * Only ever call this for a solved row. The marker is a run of three or more
 * em dashes, which is what redactAnswer writes; a lone em dash is ordinary
 * punctuation in these clues ("1992 — ———") and must survive untouched.
 */
export function fillClue(clue: string, word: string): string {
  return clue.replace(/—{3,}/g, word.toUpperCase());
}

/**
 * Which TILE POSITIONS are unlocked, resolved against the letters actually on
 * the dial.
 *
 * The wheel locks by INDEX, not by letter, because `active` is a multiset: a
 * base with two T's can have one unlocked and one not, and collapsing that to a
 * Set would light both tiles and let the player tap a locked one.
 *
 * Which makes the ORDER passed in load-bearing, and that is the bug this
 * function exists to make impossible. Indices were resolved against
 * `puzzle.letters` — the original, unshuffled order — and then handed to a
 * wheel rendering the SHUFFLED array. Position 3 is a different letter in the
 * two orders, so every shuffle silently changed which letters were available
 * to play. Pass the letters that are on screen.
 *
 * This is the second time this pair has drifted. The first was a puzzle-id
 * desync that left an unplayable two-letter board; the fix keyed the shuffle by
 * id and did not notice that ORDER was the other half of the same coupling.
 */
export function unlockedIndices(
  letters: readonly string[],
  active: readonly string[]
): Set<number> {
  const pool = new Map<string, number>();
  for (const ch of active) pool.set(ch, (pool.get(ch) ?? 0) + 1);
  const out = new Set<number>();
  letters.forEach((ch, i) => {
    const left = pool.get(ch) ?? 0;
    if (left > 0) {
      pool.set(ch, left - 1);
      out.add(i);
    }
  });
  return out;
}

export function dailyPoolSize(file: PuzzleFile): number {
  /*
   * Only DAILY-ELIGIBLE themed boards, which excludes the general packs.
   *
   * The seed is an index into the head of the array, so this works only while
   * build-puzzles.mjs emits daily-eligible boards first, general themed boards
   * next, and generated practice last. That ordering is asserted in the build
   * and in a test, because the invariant is invisible from here and breaking it
   * would silently put The Garden in the daily rotation.
   */
  const eligible = file.puzzles.filter((p) => p.theme && isDailyEligible(p.theme.id)).length;
  if (eligible > 0) return eligible;
  const themed = file.puzzles.filter((p) => p.theme).length;
  return themed > 0 ? themed : file.puzzles.length;
}

/** How many complete laps of the catalogue have elapsed. */
export function dailyCycle(date: Date, total: number): number {
  const epoch = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000
  );
  return Math.max(0, Math.floor(epoch / total));
}

export function puzzleForPlayer(
  file: PuzzleFile,
  warmupsDone: number,
  today: Date,
  offset: number,
  /** Puzzle ids already finished — the daily skips them. */
  cleared: ReadonlySet<string> = new Set()
): { index: number; warmup: number | null } {
  const ladder = file.starters ?? [];

  // The warm-up is a sequence, so an explicit offset means the player has
  // navigated away from it and wants the normal rotation.
  if (offset === 0 && warmupsDone < ladder.length) {
    return { index: ladder[warmupsDone], warmup: warmupsDone + 1 };
  }

  /*
   * The daily is drawn from the AUTHORED catalogue only.
   *
   * The board's ruling on the generated boards is that they are a commodity —
   * fine as free practice, never billable — and the set is 397 authored against
   * 123 generated. Seeding the daily across all 520 meant a dictionary
   * definition was the day's puzzle roughly one day in four: "(used of persons
   * or the military) characterized by having or bearing arms" landing in the
   * same slot as a hand-written clue about a treasurer counting a shirt order.
   * That is the "two different products" complaint, and shipping both under one
   * rotation is what made it a liability rather than a bonus.
   *
   * build-puzzles.mjs places authored boards FIRST, so the themed catalogue is
   * the contiguous head of the array and its length is the whole seed space.
   * The generated boards stay reachable — the puzzle picker walks the full set —
   * they are just never what a player is served as today's game.
   *
   * Falls back to the full set if nothing is authored, so a build with an empty
   * themes.json still produces a playable daily rather than dividing by zero.
   */
  const total = file.puzzles.length;
  const dailyPool = dailyPoolSize(file);
  const seed = dailyIndex(today, dailyPool);

  // An explicit offset is the player steering; never second-guess it.
  if (offset !== 0) {
    return { index: (seed + offset + total) % total, warmup: null };
  }

  /*
   * The daily is the first UNCLEARED puzzle from today's seed, not the seed
   * itself.
   *
   * `dailyIndex` is `epochDay % total`, and found words are keyed by puzzle,
   * so the plain seed serves a board the player has already finished. That is
   * usually described as a day-241 problem, but it starts on day TWO: the
   * theme picker lets anyone jump to any index, and the ten themed puzzles are
   * exactly the ones a new player seeks out first — so every one of them is
   * scheduled to come back as a "daily" that is already solved.
   *
   * Walking forward keeps it deterministic and serverless, and makes browsing
   * the themes free rather than a way to poison your own calendar.
   */
  for (let step = 0; step < dailyPool; step += 1) {
    const i = (seed + step) % dailyPool;
    if (!cleared.has(String(file.puzzles[i].id))) {
      return { index: i, warmup: null };
    }
  }

  // Everything is cleared. Cycle-keyed storage makes the replay a fresh board.
  return { index: seed, warmup: null };
}

/** Every theme in the set, with the puzzles that carry it. */
export type ThemeGroup = {
  id: string;
  name: string;
  blurb: string;
  indices: number[];
};

/**
 * Four places, not fifteen tiles.
 *
 * Twelve themes was already dense and the catalogue is heading past fifteen.
 * The combined board ruled BROWSABLE GROUPS rather than labels on a flat list,
 * because a labelled flat list still puts fifteen tiles on one screen, which is
 * the actual complaint. Grandmother's test for the structure was that it be
 * four things she can each picture as a place — and she holds a BLOCK on any
 * thirteenth theme shipping before this exists.
 *
 * A theme with no home here still appears, under `elsewhere`, rather than
 * vanishing from the picker — a missing entry in this table must never be able
 * to hide content from a player.
 */
export type ShelfId = 'table' | 'sunday' | 'block' | 'soundtrack' | 'longway' | 'elsewhere';


export type Shelf = {
  id: ShelfId;
  name: string;
  /** What the group is, in the player's words rather than a taxonomy. */
  blurb: string;
  themes: ThemeGroup[];
};

const SHELF_OF: Record<string, ShelfId> = {
  cookout: 'table',
  texas: 'table', // Barbecue
  sunday: 'table', // Sunday Dinner
  church: 'sunday', // Sunday Service
  hbcu: 'sunday', // Homecoming Weekend
  juneteenth: 'sunday', // The Nineteenth
  barbershop: 'block', // The Shop
  spades: 'block', // The Card Table
  beautysupply: 'block',
  // The general packs the board approved, absorbed where they fit and shelved
  // together where they do not. A hardware store is on the block; a diner is a
  // table. Only the un-absorbable three get the fifth shelf, and FIVE is the
  // ceiling — Grandmother exercises her veto on a sixth.
  hardware: 'block',
  diner: 'table',
  roadtrip: 'longway',
  garden: 'longway',
  rnb90s: 'soundtrack', // The Nineties
  steppers: 'soundtrack', // The Floor
  sitcom: 'soundtrack', // Rerun Season
};

const SHELVES: { id: ShelfId; name: string; blurb: string }[] = [
  { id: 'table', name: 'The Table', blurb: 'Everything that comes off a fire and everything eaten around it.' },
  { id: 'sunday', name: 'Sunday', blurb: 'The service, the weekend, and the days that get their own clothes.' },
  { id: 'block', name: 'The Block', blurb: 'The chair, the card table, and the stretch of pavement outside.' },
  { id: 'soundtrack', name: 'The Soundtrack', blurb: 'What was playing while all of the above was happening.' },
  {
    id: 'longway',
    name: 'The Long Way',
    blurb: 'The drive, the garden, and the hour nobody watches.',
  },
  { id: 'elsewhere', name: 'Elsewhere', blurb: 'Everything that has not found its shelf yet.' },
];

/** Themes arranged on shelves, in the order the shelves are declared. */
export function themeShelves(file: PuzzleFile): Shelf[] {
  const groups = themeGroups(file);
  return SHELVES.map((s) => ({
    ...s,
    themes: groups.filter((g) => (SHELF_OF[g.id] ?? 'elsewhere') === s.id),
  })).filter((s) => s.themes.length > 0);
}

export function themeGroups(file: PuzzleFile): ThemeGroup[] {
  const byId = new Map<string, ThemeGroup>();
  file.puzzles.forEach((p, i) => {
    if (!p.theme) return;
    const g = byId.get(p.theme.id) ?? {
      id: p.theme.id,
      name: p.theme.name,
      blurb: p.theme.blurb,
      indices: [],
    };
    g.indices.push(i);
    byId.set(p.theme.id, g);
  });
  /*
   * Sort on the name WITHOUT its leading article, the way a shelf does.
   *
   * A plain localeCompare filed "The Cookout" under T — below "In the Kitchen"
   * and near the bottom of the list — so the theme the game is built around
   * read as an afterthought. The same bug now hits The Beauty Shop, The Card
   * Table, The Line Forms and The Nineteenth, which is four of fifteen themes
   * clustered under one letter that carries no information about any of them.
   */
  const sortKey = (name: string) => name.replace(/^(the|a|an)\s+/i, '');
  return [...byId.values()].sort((a, b) =>
    sortKey(a.name).localeCompare(sortKey(b.name))
  );
}

/**
 * The offset that lands on an absolute puzzle index.
 *
 * Navigation is expressed as an offset from today so the daily stays the
 * anchor, but a theme picker needs to jump to a specific puzzle — this
 * converts one to the other, wrapping rather than going out of range.
 */
export function offsetForIndex(
  file: PuzzleFile,
  today: Date,
  index: number
): number {
  /*
   * The base must be the SAME seed the daily resolves from.
   *
   * `puzzleForPlayer` seeds with `dailyIndex(today, dailyPoolSize(file))` —
   * the authored catalogue — and then applies an offset across the whole
   * file. This computed its base from `dailyIndex(today, file.puzzles.length)`
   * instead, so the two disagreed by however far those two indices had drifted
   * apart, and every theme card in the picker landed on the WRONG pack:
   * clicking "The Cookout" opened The Beauty Shop.
   *
   * That is the third bug from one cause — the daily pool size being computed
   * in more than one place. The lap counter was the first, the wheel's letters
   * the second. `dailyPoolSize` is the single definition; this was the last
   * caller still doing its own arithmetic.
   */
  const n = file.puzzles.length;
  const base = dailyIndex(today, dailyPoolSize(file));
  return ((index - base) % n + n) % n;
}

export type SubmitResult =
  | { kind: 'grid'; word: string; points: number; isBase: boolean }
  | { kind: 'bonus'; word: string; points: number }
  | { kind: 'duplicate'; word: string }
  | { kind: 'too-short'; word: string }
  | { kind: 'invalid'; word: string };

export const MIN_WORD_LENGTH = 3;

/** 3 letters -> 1pt, 4+ -> length, full-wheel word -> + wheel size. */
export function scoreWord(word: string, wheelSize: number): number {
  const base = word.length === MIN_WORD_LENGTH ? 1 : word.length;
  return base + (word.length === wheelSize ? wheelSize : 0);
}

/**
 * Classify a submission. `found` is every word already banked this puzzle,
 * so replaying a word is a distinct, non-punishing outcome.
 */
export function submit(
  puzzle: Puzzle,
  wheelSize: number,
  raw: string,
  found: ReadonlySet<string>
): SubmitResult {
  const word = raw.trim().toLowerCase();

  if (word.length < MIN_WORD_LENGTH) return { kind: 'too-short', word };
  if (found.has(word)) return { kind: 'duplicate', word };

  const points = scoreWord(word, wheelSize);

  if (puzzle.grid.includes(word)) {
    return { kind: 'grid', word, points, isBase: word === puzzle.base };
  }
  if (puzzle.bonus.includes(word)) {
    return { kind: 'bonus', word, points };
  }
  return { kind: 'invalid', word };
}

/**
 * The rank ladder.
 *
 * Ranks measure how much of the WHOLE puzzle you've found — every word the six
 * letters can make, not just the six target rows. That's ~44 words, so the
 * targets alone are a small fraction of the total.
 *
 * The thresholds used to run 0/10/25/40/55/75/100, which put Genius at 100% —
 * find every last obscure bonus word. That is Spelling Bee's *Queen Bee*, not
 * its Genius (70%), and it meant the top of the ladder was effectively
 * unreachable while the names implied cleverness rather than exhaustiveness.
 *
 * Recalibrated so Genius is a good day's play and completionism gets its own
 * name above it.
 */
export const RANKS = [
  { name: 'Novice', at: 0 },
  { name: 'Solid', at: 0.08 },
  { name: 'Sharp', at: 0.18 },
  { name: 'Clever', at: 0.3 },
  { name: 'Fluent', at: 0.45 },
  { name: 'Wordsmith', at: 0.6 },
  { name: 'Genius', at: 0.75 },
  { name: 'Complete', at: 1 },
] as const;

/** One line explaining what the ladder is actually counting. */
export const RANK_BASIS =
  'Ranks track the six rows. Extra words still score, and every 3 earns a hint.';

/**
 * The points available from the SIX ROWS, which is what ranks measure.
 *
 * They used to measure `maxScore` — every word the six letters can make, ~44
 * of them. Measured across the shipped set, the grid is worth a mean 27.4% of
 * that. So a player did exactly what the game told them to do ("fill every row
 * to finish the puzzle"), cleared it, and was shown "Sharp" — rank 3 of 8 —
 * with five greyed-out ranks above them, gated on ~37 bonus words they were
 * never shown and never asked for.
 *
 * A scoring system that grades you against an unstated denominator is the
 * shape of a manipulative one even when the intent is generous. The stated
 * goal and the reward now measure the same thing; bonus words keep their own
 * track, which already pays out in hints.
 */
export function gridMaxScore(puzzle: Puzzle, wheelSize = 6): number {
  return puzzle.grid.reduce((sum, w) => sum + scoreWord(w, wheelSize), 0);
}

export type Rank = {
  name: string;
  index: number;
  progress: number;
  next: string | null;
  pointsToNext: number;
};

export function rankFor(score: number, maxScore: number): Rank {
  const ratio = maxScore > 0 ? score / maxScore : 0;

  let index = 0;
  for (let i = 0; i < RANKS.length; i += 1) {
    if (ratio >= RANKS[i].at) index = i;
  }

  const next = index < RANKS.length - 1 ? RANKS[index + 1] : null;

  return {
    name: RANKS[index].name,
    index,
    progress: Math.min(1, ratio),
    next: next ? next.name : null,
    pointsToNext: next
      ? Math.max(0, thresholdPoints(next.at, maxScore) - score)
      : 0,
  };
}

/**
 * Points needed to reach a threshold.
 *
 * Naive Math.ceil(fraction * max) is wrong: 0.55 * 100 is 55.00000000000001 in
 * binary floating point, so it ceils to 56 and the player is told a rank costs
 * a point more than it does. Scrub the dust before rounding up.
 */
function thresholdPoints(fraction: number, maxScore: number): number {
  return Math.ceil(Number((fraction * maxScore).toFixed(6)));
}

export type LadderStep = {
  name: string;
  /** Points this rank starts at, for this puzzle's ceiling. */
  at: number;
  reached: boolean;
  current: boolean;
  /** Points still needed. 0 once reached. */
  toGo: number;
};

/**
 * The rank ladder in POINTS, not percentages.
 *
 * "Clever at 40%" is unusable while playing — you can't act on a percentage of
 * a total you don't know. Resolving each threshold against this puzzle's
 * ceiling turns the ladder into something you can aim at: what a rank cost,
 * and what the next one costs from here.
 */
export function rankLadder(score: number, maxScore: number): LadderStep[] {
  let currentIndex = 0;
  const ratio = maxScore > 0 ? score / maxScore : 0;
  for (let i = 0; i < RANKS.length; i += 1) {
    if (ratio >= RANKS[i].at) currentIndex = i;
  }

  return RANKS.map((r, i) => {
    const at = thresholdPoints(r.at, maxScore);
    return {
      name: r.name,
      at,
      reached: i <= currentIndex,
      current: i === currentIndex,
      toGo: i <= currentIndex ? 0 : Math.max(0, at - score),
    };
  });
}

/** Shuffle the wheel without ever returning the same order twice running. */
export function shuffle(letters: string[]): string[] {
  if (letters.length < 2) return [...letters];
  const original = letters.join('');
  let out = [...letters];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    if (out.join('') !== original) return out;
    out = [...letters];
  }
  return out;
}

/**
 * The daily puzzle: pure date -> index, so every player on a given day gets
 * the same letters without a server. Uses local calendar date on purpose —
 * "today" should mean the player's today.
 */
export function dailyIndex(date: Date, total: number): number {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const epoch = Date.UTC(y, m - 1, d) / 86400000;
  return ((Math.floor(epoch) % total) + total) % total;
}

export function dayKey(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/**
 * Spoiler-free share card, Wordle grammar: shape and rank, never a word.
 *
 * The squares are in tray order (longest first), so the shape a reader sees
 * is the shape the player saw. The six-letter word gets its own glyph — it's
 * the prize, and "did they get the long one" is the whole story of a solve.
 *
 * Emoji squares rather than ■/□ on purpose: they survive every platform's
 * font stack at a readable size, which is exactly why Wordle's card travels.
 */
const SQ_BASE = '🟩'; // the full-wheel word — matches its green ring in-app
const SQ_SOLVED = '🟦';
const SQ_MISSED = '⬛';

export type ShareTile = { solved: boolean; isBase: boolean };

/**
 * The share card.
 *
 * This used to lead with "Wordy #205" and a strip of shape tiles — Wordle
 * grammar. But Wordle's card works because its secret was the ANSWER, so the
 * shape is all you can safely show. Wordy's secret is the CLUE, and the clues
 * are the only part of this game nobody else can generate. Emitting shape-only
 * meant the one asset with pricing power never left the app.
 *
 * The day number is also gone rather than fixed: it read `index + 1`, so a
 * player still in the warm-up ladder shared "#1" on the same calendar day
 * everyone else shared "#205" — a handshake that didn't shake. And now that
 * the daily walks past puzzles you have already cleared, there is no shared
 * number left to claim honestly.
 *
 * A clue is only ever shared from a row the player SOLVED, so this can never
 * spoil a puzzle for the person reading it.
 */
export function shareText(opts: {
  /** The pack this board came from, when it has one. */
  theme?: string | null;
  /** A clue from a row the player solved — the thing worth quoting. */
  clue?: string | null;
  rank: string;
  score: number;
  tiles: ShareTile[];
  bonusFound: number;
  streak: number;
  /**
   * The shared referent, and ONLY for the daily board.
   *
   * A day number was shipped once and deleted, because a warm-up player was
   * posting "#1" the day everyone else posted "#205" — it named a board nobody
   * else could see. That was the wrong number, not a wrong idea: Wordle's
   * "#1234" is the entire reason two strangers know they solved the same
   * puzzle, and a daily ritual without a shared referent is just a scoreboard.
   *
   * So it comes back, restricted to the one board that IS the same for
   * everybody. Practice and warm-up pass null and print no number at all,
   * which is honest — those genuinely are not a shared thing.
   */
  dayNumber?: number | null;
  /** Was the escalating wheel on for this board? */
  escalating?: boolean;
  /** Where to play. Omitted entirely rather than guessed. */
  url?: string;
  /** Leave the URL out of the text, because the caller is passing it separately. */
  omitUrl?: boolean;
}): string {
  const shape = opts.tiles
    .map((t) =>
      !t.solved ? SQ_MISSED : t.isBase ? SQ_BASE : SQ_SOLVED
    )
    .join('');

  // Evidence line — only the parts that actually happened.
  const evidence = [
    opts.bonusFound > 0 ? `${opts.bonusFound} bonus` : null,
    `${opts.score} pts`,
    opts.streak > 1 ? `${opts.streak}-day streak` : null,
    /*
     * The escalating wheel is the one structurally novel thing in this game —
     * the search space GROWS as you clear rows, so row six is a different
     * problem from row one — and nothing outside the app has ever named it.
     * A mechanic nobody can describe is a mechanic nobody talks about.
     *
     * Named here rather than explained, because the share card is where a game
     * gets described to someone who has not played it, and three words that
     * raise a question do more than a sentence that answers one.
     */
    opts.escalating ? 'escalating wheel' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const name = opts.dayNumber != null ? `Wordy #${opts.dayNumber}` : 'Wordy';
  const heading = opts.theme
    ? `${name} — ${opts.theme} · ${opts.rank}`
    : `${name} — ${opts.rank}`;

  return [
    heading,
    // The line is the product. It goes above the tiles, because a reader
    // scanning a feed sees the first line and nothing else.
    opts.clue ? `"${opts.clue}"` : null,
    shape,
    evidence,
    // Omitted when the caller is going to hand the URL to the share sheet as
    // its own field — see shareParts.
    opts.omitUrl ? null : opts.url,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * The share card split the way `navigator.share` wants it.
 *
 * A URL buried inside `text` is just characters: iMessage, Slack and WhatsApp
 * all unfurl a link passed as the `url` FIELD and none of them reliably unfurl
 * one found inside a text blob. So the card that had a link on its last line
 * was quietly throwing away every Open Graph tag the app ships — the preview
 * card, the image, the theme name — and arriving as a grey string.
 *
 * Clipboard fallback still gets the URL inline, because a clipboard has no
 * fields and a pasted card with no link is a dead end.
 */
export function shareParts(opts: Parameters<typeof shareText>[0]): {
  text: string;
  url?: string;
  full: string;
} {
  return {
    text: shareText({ ...opts, omitUrl: true }),
    url: opts.url,
    full: shareText(opts),
  };
}
