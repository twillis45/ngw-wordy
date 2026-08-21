import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { activeLetters } from './game';

/**
 * Can every board actually be FINISHED in escalating mode?
 *
 * This test exists because the answer was no for 187 of 499 boards, in the
 * mode that ships ON by default, and nothing in the repo could tell. The
 * generator laid down the shortest word's letters and then the rest of the
 * wheel in arbitrary order, which guarantees row one is solvable and says
 * nothing about row two. `castle` opened on s·e·t, you spelled SET, it
 * unlocked C, and nothing in CASTLE, SLATE, LACE, SALE or SEAT can be spelled
 * from s·e·t·c. The player held five letters, had no legal move, and the game
 * never said why.
 *
 * The invariant is the mechanic itself: letters unlock one per row, so after
 * k rows a player holds `startActive + k` of them, and at least one unsolved
 * word must be spellable from exactly those. Anything else is a dead board.
 *
 * Run against the SHIPPED file rather than a fixture, because a fixture would
 * have passed the whole time this was broken.
 */
const file = JSON.parse(
  readFileSync(new URL('../../public/data/puzzles.json', import.meta.url), 'utf8')
);
const puzzles: {
  base: string;
  grid: string[];
  letters: string[];
  unlockOrder: string[];
  startActive: number;
}[] = file.puzzles ?? file;

const canSpell = (word: string, pool: readonly string[]) => {
  const left = new Map<string, number>();
  for (const ch of pool) left.set(ch, (left.get(ch) ?? 0) + 1);
  for (const ch of word) {
    const n = left.get(ch) ?? 0;
    if (n === 0) return false;
    left.set(ch, n - 1);
  }
  return true;
};

/** Play the board greedily. Returns the row it stalls at, or null if it clears. */
const stallsAt = (p: (typeof puzzles)[number]) => {
  const done = new Set<string>();
  for (let guard = 0; guard <= p.grid.length; guard++) {
    if (done.size === p.grid.length) return null;
    /*
     * Through `activeLetters`, not a local copy of the rule. A test that
     * reimplements the thing it is testing can agree with itself while both
     * are wrong.
     */
    const active = activeLetters(p as never, done.size, true);
    const next = p.grid.find((w) => !done.has(w) && canSpell(w, active));
    if (!next) return done.size;
    done.add(next);
  }
  return done.size === p.grid.length ? null : done.size;
};

describe('escalating wheel', () => {
  it('every shipped board can be cleared one row at a time', () => {
    const dead = puzzles
      .filter((p) => p.unlockOrder)
      .map((p) => ({ base: p.base, at: stallsAt(p) }))
      .filter((r) => r.at !== null);

    expect(
      dead,
      dead.length
        ? `${dead.length} board(s) deadlock: ${dead
            .slice(0, 8)
            .map((d) => `${d.base} stalls at ${d.at} rows`)
            .join('; ')}`
        : ''
    ).toEqual([]);
  });

  it('opens with a word the player can actually spell', () => {
    /*
     * The narrower half of the same failure: a board that opens with no legal
     * move at all. Five shipped that way once before, when a doubled letter
     * was counted twice in `startActive`.
     */
    const mute = puzzles
      .filter((p) => p.unlockOrder)
      .filter((p) => {
        const active = activeLetters(p as never, 0, true);
        return !p.grid.some((w) => canSpell(w, active));
      })
      .map((p) => p.base);
    expect(mute).toEqual([]);
  });

  it('never claims a letter the wheel does not have', () => {
    const wrong = puzzles
      .filter((p) => p.unlockOrder)
      .filter((p) => {
        const wheel = [...p.letters].sort().join('');
        const unlock = [...p.unlockOrder].sort().join('');
        return wheel !== unlock;
      })
      .map((p) => p.base);
    expect(wrong).toEqual([]);
  });
});
