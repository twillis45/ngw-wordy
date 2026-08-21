import { describe, expect, it } from 'vitest';
import { boardProgress, nextMilestone, playerRecord } from './record';
import type { Progress } from './storage';

const base = (over: Partial<Progress> = {}): Progress => ({
  words: {},
  reveals: {},
  days: {},
  clearedIds: [],
  streak: 0,
  bestStreak: 0,
  freezes: 0,
  vacationSince: null,
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

/*
 * A small catalogue standing in for the real one: two packs of two boards
 * each, plus an unthemed board, so pack counting has something to be wrong
 * about. Board 5 belongs to no pack and must never be counted toward one.
 */
const CATALOGUE = [
  { id: 1, theme: { id: 'pit' } },
  { id: 2, theme: { id: 'pit' } },
  { id: 3, theme: { id: 'shop' } },
  { id: 4, theme: { id: 'shop' } },
  { id: 5 },
];

describe('playerRecord', () => {
  it('is all zeroes for a player who has never banked a word', () => {
    const r = playerRecord(base(), 6, CATALOGUE);
    expect(r).toMatchObject({ cleared: 0, bestScore: 0, wordsFound: 0, daysPlayed: 0 });
    expect(r.total).toBe(CATALOGUE.length);
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
      CATALOGUE
    );
    expect(r.bestScore).toBe(12);
    expect(r.wordsFound).toBe(4);
  });

  it('counts days played as a lifetime figure, separate from the streak', () => {
    const r = playerRecord(
      base({ days: { a: true, b: true, c: true }, streak: 1, bestStreak: 3 }),
      6,
      CATALOGUE
    );
    expect(r.daysPlayed).toBe(3);
    expect(r.streak).toBe(1);
    expect(r.bestStreak).toBe(3);
  });

  it('reports cleared against the catalogue it was given', () => {
    const r = playerRecord(base({ clearedIds: ['1', '2'] }), 6, CATALOGUE);
    expect(r.cleared).toBe(2);
    expect(r.total).toBe(CATALOGUE.length);
  });
});

describe('playerRecord — packs', () => {
  it('counts a pack as STARTED on one board and DONE only on all of them', () => {
    const r = playerRecord(base({ clearedIds: ['1'] }), 6, CATALOGUE);
    expect(r.packsStarted).toBe(1);
    expect(r.packsDone).toBe(0);
    expect(r.packsTotal).toBe(2);
  });

  it('counts a pack done when every board in it is cleared', () => {
    const r = playerRecord(base({ clearedIds: ['1', '2'] }), 6, CATALOGUE);
    expect(r.packsDone).toBe(1);
  });

  it('never counts an unthemed board toward a pack', () => {
    const r = playerRecord(base({ clearedIds: ['5'] }), 6, CATALOGUE);
    expect(r.packsStarted).toBe(0);
    expect(r.cleared).toBe(1);
  });
});

describe('nextMilestone', () => {
  it('points at the first rung early, before a habit has formed', () => {
    expect(nextMilestone(0)).toEqual({ at: 3, toGo: 3 });
    expect(nextMilestone(2)).toEqual({ at: 3, toGo: 1 });
  });

  it('moves to the next rung once one is reached', () => {
    expect(nextMilestone(3)).toEqual({ at: 7, toGo: 4 });
    expect(nextMilestone(7)).toEqual({ at: 14, toGo: 7 });
  });

  it('stops rather than inventing an endless ladder', () => {
    /*
     * The restraint seat's objection made concrete: a player at 100+ days is
     * told what they have, not what they still owe.
     */
    expect(nextMilestone(100)).toBeNull();
    expect(nextMilestone(500)).toBeNull();
  });
});

describe('boardProgress', () => {
  const grid = ['crafty', 'cart', 'tray'];
  const bonus = ['arty', 'cat', 'far'];

  it('counts against the board’s real answer set', () => {
    const r = boardProgress(new Set(['crafty', 'cat']), grid, bonus);
    expect(r).toEqual({ found: 2, total: 6 });
  });

  it('ignores words that are not on this board', () => {
    /*
     * Found words are stored per puzzle, but a caller passing the wrong set
     * would otherwise inflate the numerator past the denominator and print
     * "7 of 6", which reads as a bug to a player and is one.
     */
    const r = boardProgress(new Set(['crafty', 'zebra']), grid, bonus);
    expect(r.found).toBe(1);
  });

  it('does not double-count a word that is both grid and bonus', () => {
    /* crafty, cart, tray, cat — four distinct, not five. */
    const r = boardProgress(new Set(['cart']), grid, ['cart', 'cat']);
    expect(r.total).toBe(4);
    expect(r.found).toBe(1);
  });
});
