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
  theme: { id: string; name: string; blurb: string } | null;
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
): Set<string> {
  if (!escalating) return new Set(puzzle.letters);
  const n = Math.min(
    puzzle.unlockOrder.length,
    puzzle.startActive + Math.max(0, rowsDone)
  );
  return new Set(puzzle.unlockOrder.slice(0, n));
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

/** Can this word be spelled with the letters currently unlocked? */
export function isReachable(word: string, active: ReadonlySet<string>): boolean {
  for (const ch of word) if (!active.has(ch)) return false;
  return true;
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
export function dailyPoolSize(file: PuzzleFile): number {
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
  const n = file.puzzles.length;
  const base = dailyIndex(today, n);
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
  /** Where to play. Omitted entirely rather than guessed. */
  url?: string;
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
  ]
    .filter(Boolean)
    .join(' · ');

  const heading = opts.theme
    ? `Wordy — ${opts.theme} · ${opts.rank}`
    : `Wordy — ${opts.rank}`;

  return [
    heading,
    // The line is the product. It goes above the tiles, because a reader
    // scanning a feed sees the first line and nothing else.
    opts.clue ? `"${opts.clue}"` : null,
    shape,
    evidence,
    opts.url,
  ]
    .filter(Boolean)
    .join('\n');
}
