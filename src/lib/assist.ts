/**
 * Do It For Me — stall detection.
 *
 * The hint system makes you diagnose your own problem: pick a row, decide what
 * to spend. That is the right default, but it is exactly wrong at the moment a
 * player is stuck, because being stuck means you do not know which row to pick.
 *
 * So when the game can tell you have stalled, it offers to act rather than
 * advise. Pure and deterministic — no timers, no React — so the rule can be
 * tested rather than eyeballed.
 */

export type StallInput = {
  /** ms since the last word was banked. */
  idleMs: number;
  /** Rejected submissions since the last banked word. */
  missesSinceProgress: number;
  /** Rows still unsolved. */
  rowsLeft: number;
  /** Hints the player can afford. */
  tokens: number;
  /** Already offered for this stall — don't nag. */
  alreadyOffered: boolean;
};

export const STALL_IDLE_MS = 45_000;
export const STALL_MISSES = 4;

/**
 * A stall is either kind of stuck: staring at it, or guessing wrong repeatedly.
 * Both mean the same thing — the player has run out of ideas, not patience.
 */
export function isStalled(s: StallInput): boolean {
  if (s.alreadyOffered) return false;
  if (s.rowsLeft <= 0) return false;
  return s.idleMs >= STALL_IDLE_MS || s.missesSinceProgress >= STALL_MISSES;
}

export type Assist =
  | { kind: 'open-word'; word: string; cost: number }
  | { kind: 'reveal-letter'; word: string; cost: number }
  | { kind: 'free-letter'; word: string; cost: 0 };

/**
 * What to actually do about it.
 *
 * Picks the SHORTEST unsolved row, because the cheapest possible win is what
 * restarts momentum — the goal is to get the player moving again, not to
 * maximise what they extract from a hint.
 *
 * A player with no tokens is the one most likely to quit, so they get a letter
 * free. Charging at the exact moment someone is about to leave is backwards.
 */
export function assistFor(
  unsolved: string[],
  tokens: number,
  costLetter: number,
  costWord: number
): Assist | null {
  if (unsolved.length === 0) return null;

  const target = [...unsolved].sort(
    (a, b) => a.length - b.length || a.localeCompare(b)
  )[0];

  if (tokens >= costWord) return { kind: 'open-word', word: target, cost: costWord };
  if (tokens >= costLetter)
    return { kind: 'reveal-letter', word: target, cost: costLetter };
  return { kind: 'free-letter', word: target, cost: 0 };
}
