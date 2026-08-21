/**
 * The player's own record.
 *
 * Every number here is DERIVED, not stored — the same decision the hint
 * balance already makes, and for the same reason: a stored total is a second
 * source of truth that drifts from the first one silently. `words` already
 * holds every word ever banked, keyed by puzzle, so a best score is a
 * calculation over data we have rather than a counter we have to remember to
 * increment.
 *
 * Why this exists at all: the review board of 2026-08-21 scored the game 2/10
 * on this dimension, and it was the lowest score in that review — lower than
 * the leaderboard we decided not to build. The game computed a score on every
 * board and showed it for the CURRENT board only. Nothing kept a best, a
 * total, or any sense of how much of the catalogue was left. Every daily
 * leader looked at — Duolingo, Vocabulary, Me+, CapWords — shows a player
 * their own history. It was the cheapest gap on the list and the widest.
 *
 * Local, and that is the point: personal history is the version of "scores"
 * that needs no server, no account and no identity, so it changes nothing
 * about STORE_READINESS 1.5 or 1.6 and does not touch `connect-src 'self'`.
 */
import { scoreWord } from './game';
import type { Progress } from './storage';

/**
 * The streak milestones, and the next one a player is walking toward.
 *
 * Deepstash shows a 7 / 14 / 30 track; Finch throws a full celebration at
 * THREE days. We celebrated nothing until a board was complete, which means
 * the mechanic whose entire job is tomorrow had no visible middle — a player
 * on day four was told "4 days in a row" and given no reason to believe day
 * five mattered more than day four did.
 *
 * Three is deliberately the first rung and it is deliberately early. A
 * milestone a player cannot see the near edge of is not a milestone, it is a
 * distant fact, and the point of the first one is to arrive before anyone has
 * decided whether this is a habit.
 */
export const MILESTONES = [3, 7, 14, 30, 60, 100] as const;

export function nextMilestone(streak: number): { at: number; toGo: number } | null {
  for (const m of MILESTONES) {
    if (streak < m) return { at: m, toGo: m - streak };
  }
  /*
   * Past the last rung there is no next one, and inventing an endless ladder
   * would be the engagement-farming shape the restraint seat objects to. A
   * player at 100+ days is told what they have, not what they still owe.
   */
  return null;
}

/**
 * How much of a single board has been found — a real ratio, not a percentile.
 *
 * The competitive audit wanted the Vocabulary pattern: "you outrank 4% of
 * learners", a percentile against a population. That is not available here and
 * should not be faked. There is no server and no telemetry by design, so the
 * only way to print a percentile would be to invent a distribution and present
 * it as if it described other players — a fabricated statistic on a reward
 * surface, which is worse than showing nothing.
 *
 * This is the honest version of the same idea. Every board has a known,
 * finite answer set — six grid words plus its bonus list, 26 to 105 words
 * depending on the wheel — so "23 of 41" is a fact about the board rather than
 * a claim about anybody else. Spelling Bee prints exactly this, and it does
 * the same job: it tells a player how much is left, which is the part that
 * makes someone keep looking.
 *
 * It gives away no answers. A count is not a word.
 */
export function boardProgress(
  found: ReadonlySet<string>,
  grid: readonly string[],
  bonus: readonly string[]
): { found: number; total: number } {
  const findable = new Set<string>([...grid, ...bonus]);
  let hit = 0;
  for (const w of found) if (findable.has(w)) hit += 1;
  return { found: hit, total: findable.size };
}

export type PlayerRecord = {
  /** Boards whose grid has been fully cleared. */
  cleared: number;
  /** Boards in the catalogue, so `cleared` has a denominator. */
  total: number;
  /** The highest score reached on any single board. */
  bestScore: number;
  /** Every word ever banked, across every board. */
  wordsFound: number;
  /** Days the daily was played. Not the streak — the lifetime count. */
  daysPlayed: number;
  streak: number;
  bestStreak: number;
  /** Themed packs with at least one board cleared. */
  packsStarted: number;
  /** Themed packs cleared outright. */
  packsDone: number;
  /** Themed packs in the catalogue. */
  packsTotal: number;
};

export function playerRecord(
  p: Progress,
  wheelSize: number,
  /*
   * The whole catalogue, not just its length. Boards alone cannot answer
   * "how far into the packs am I" — that needs to know which board belongs to
   * which pack, and the packs are the half of this product with pricing
   * power. A player who has finished three of fourteen packs is told 21 of
   * 499 boards, which is true and says nothing about the thing they are
   * collecting.
   */
  puzzles: readonly { id: number; theme?: { id: string } | null }[]
): PlayerRecord {
  let bestScore = 0;
  let wordsFound = 0;

  for (const words of Object.values(p.words)) {
    /*
     * Per BOARD, not lifetime. A lifetime total would only ever go up and so
     * would say nothing about how well any one board went — and "best score"
     * has to mean a score that was actually on screen at some point, or it is
     * a number the player has never seen and cannot recognise.
     */
    let board = 0;
    for (const w of words) {
      board += scoreWord(w, wheelSize);
      wordsFound += 1;
    }
    if (board > bestScore) bestScore = board;
  }

  /*
   * Cleared ids are strings and puzzle ids are numbers; the comparison is by
   * STRING on purpose, because that is how clearedIds was written and a
   * silent type mismatch here would report every pack as unstarted.
   */
  const clearedSet = new Set(p.clearedIds.map(String));
  const packs = new Map<string, { total: number; done: number }>();
  for (const pz of puzzles) {
    const id = pz.theme?.id;
    if (!id) continue;
    const entry = packs.get(id) ?? { total: 0, done: 0 };
    entry.total += 1;
    if (clearedSet.has(String(pz.id))) entry.done += 1;
    packs.set(id, entry);
  }
  const packValues = [...packs.values()];

  return {
    cleared: p.clearedIds.length,
    total: puzzles.length,
    bestScore,
    wordsFound,
    daysPlayed: Object.keys(p.days).length,
    streak: p.streak,
    bestStreak: p.bestStreak,
    packsStarted: packValues.filter((v) => v.done > 0).length,
    packsDone: packValues.filter((v) => v.done === v.total).length,
    packsTotal: packValues.length,
  };
}
