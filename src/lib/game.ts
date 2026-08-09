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
export function puzzleForPlayer(
  file: PuzzleFile,
  warmupsDone: number,
  today: Date,
  offset: number
): { index: number; warmup: number | null } {
  const ladder = file.starters ?? [];

  // The warm-up is a sequence, so an explicit offset means the player has
  // navigated away from it and wants the normal rotation.
  if (offset === 0 && warmupsDone < ladder.length) {
    return { index: ladder[warmupsDone], warmup: warmupsDone + 1 };
  }

  const base = dailyIndex(today, file.puzzles.length);
  return {
    index: (base + offset + file.puzzles.length) % file.puzzles.length,
    warmup: null,
  };
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
  { name: 'Every Word', at: 1 },
] as const;

/** One line explaining what the ladder is actually counting. */
export const RANK_BASIS =
  'Ranks count every word the letters can make — not just the six rows.';

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

export function shareText(opts: {
  dayNumber: number;
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

  return [
    `Wordy #${opts.dayNumber} — ${opts.rank}`,
    shape,
    evidence,
    opts.url,
  ]
    .filter(Boolean)
    .join('\n');
}
