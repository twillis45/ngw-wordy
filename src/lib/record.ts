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
};

export function playerRecord(
  p: Progress,
  wheelSize: number,
  total: number
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

  return {
    cleared: p.clearedIds.length,
    total,
    bestScore,
    wordsFound,
    daysPlayed: Object.keys(p.days).length,
    streak: p.streak,
    bestStreak: p.bestStreak,
  };
}
