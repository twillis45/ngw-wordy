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
};

export type PuzzleFile = {
  version: number;
  wheel: number;
  puzzles: Puzzle[];
};

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

/** Rank ladder, Spelling Bee style — a ladder reads better than a number. */
export const RANKS = [
  { name: 'Novice', at: 0 },
  { name: 'Solid', at: 0.1 },
  { name: 'Sharp', at: 0.25 },
  { name: 'Clever', at: 0.4 },
  { name: 'Fluent', at: 0.55 },
  { name: 'Wordsmith', at: 0.75 },
  { name: 'Genius', at: 1 },
] as const;

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
    pointsToNext: next ? Math.max(0, Math.ceil(next.at * maxScore) - score) : 0,
  };
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
 * Spoiler-free share card, Wordle grammar: shows shape and rank, never a word.
 * Grid words become filled squares; bonus words become dots.
 */
export function shareText(opts: {
  dayNumber: number;
  rank: string;
  score: number;
  gridFound: number;
  gridTotal: number;
  bonusFound: number;
}): string {
  const filled = '■'.repeat(opts.gridFound);
  const empty = '□'.repeat(Math.max(0, opts.gridTotal - opts.gridFound));
  const dots = opts.bonusFound > 0 ? `\n·${opts.bonusFound} bonus` : '';
  return `Wordy #${opts.dayNumber} — ${opts.rank} (${opts.score})\n${filled}${empty}${dots}`;
}
