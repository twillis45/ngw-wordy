import { describe, expect, it } from 'vitest';
import { playerRecord } from './record';
import type { Progress } from './storage';

const base = (over: Partial<Progress> = {}): Progress => ({
  words: {},
  reveals: {},
  days: {},
  clearedIds: [],
  streak: 0,
  bestStreak: 0,
  freezes: 0,
  lastPlayed: null,
  bonusTotal: 0,
  spent: 0,
  muted: true,
  clueMode: true,
  escalating: true,
  seenIntro: false,
  warmupsDone: 0,
  lastBackup: null,
  offeredBackup: false,
  ...over,
});

describe('playerRecord', () => {
  it('is all zeroes for a player who has never banked a word', () => {
    const r = playerRecord(base(), 6, 499);
    expect(r).toMatchObject({ cleared: 0, bestScore: 0, wordsFound: 0, daysPlayed: 0 });
    expect(r.total).toBe(499);
  });

  it('takes the best score PER BOARD, not the lifetime total', () => {
    /*
     * The distinction this asserts is the whole design: a lifetime sum only
     * ever rises and describes no single session, and a "best" the player has
     * never seen on screen is a number they cannot recognise as theirs.
     */
    const r = playerRecord(
      base({
        words: {
          '1': ['crafty'], // 6 letters on a 6-wheel: 6 + 6 bonus = 12
          '2': ['cart', 'tray', 'cry'], // 4 + 4 + 3 = 11
        },
      }),
      6,
      499
    );
    expect(r.bestScore).toBe(12);
    expect(r.wordsFound).toBe(4);
  });

  it('counts days played as a lifetime figure, separate from the streak', () => {
    const r = playerRecord(
      base({ days: { a: true, b: true, c: true }, streak: 1, bestStreak: 3 }),
      6,
      499
    );
    expect(r.daysPlayed).toBe(3);
    expect(r.streak).toBe(1);
    expect(r.bestStreak).toBe(3);
  });

  it('reports cleared against the catalogue it was given', () => {
    const r = playerRecord(base({ clearedIds: ['1', '2'] }), 6, 499);
    expect(r.cleared).toBe(2);
    expect(r.total).toBe(499);
  });
});
