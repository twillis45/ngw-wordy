import { describe, expect, it } from 'vitest';
import { FREEZE_EVERY, FREEZE_MAX, touchStreak } from './storage';
import type { Progress } from './storage';

const day = (iso: string) => new Date(`${iso}T12:00:00`);
const p = (over: Partial<Progress> = {}): Progress => ({
  words: {}, reveals: {}, days: {}, clearedIds: [],
  streak: 0, bestStreak: 0, freezes: 0, vacationSince: null, lastPlayed: null,
  bonusTotal: 0, spent: 0, muted: true, clueMode: true, escalating: true,
  seenIntro: false, warmupsDone: 0, lastBackup: null, offeredBackup: false,
  ...over,
});

describe('streak freezes', () => {
  it('covers ONE missed day and spends the freeze', () => {
    const before = p({ streak: 40, freezes: 2, lastPlayed: '2026-08-19' });
    const after = touchStreak(before, day('2026-08-21'));
    expect(after.streak).toBe(41);
    expect(after.freezes).toBe(1);
  });

  it('does NOT cover two missed days — a freeze is a near-miss, not an absence', () => {
    const before = p({ streak: 40, freezes: 3, lastPlayed: '2026-08-18' });
    const after = touchStreak(before, day('2026-08-21'));
    expect(after.streak).toBe(1);
    expect(after.freezes).toBe(3); // not spent on something it cannot fix
  });

  it('does not spend a freeze when the streak never broke', () => {
    const before = p({ streak: 5, freezes: 2, lastPlayed: '2026-08-20' });
    const after = touchStreak(before, day('2026-08-21'));
    expect(after.streak).toBe(6);
    expect(after.freezes).toBe(2);
  });

  it('breaks the streak when a day is missed with no freeze held', () => {
    const before = p({ streak: 40, freezes: 0, lastPlayed: '2026-08-19' });
    const after = touchStreak(before, day('2026-08-21'));
    expect(after.streak).toBe(1);
  });

  it(`earns one every ${FREEZE_EVERY} days`, () => {
    const before = p({ streak: FREEZE_EVERY - 1, freezes: 0, lastPlayed: '2026-08-20' });
    const after = touchStreak(before, day('2026-08-21'));
    expect(after.streak).toBe(FREEZE_EVERY);
    expect(after.freezes).toBe(1);
  });

  it('stops earning at the cap, so a freeze never covers simply not playing', () => {
    const before = p({
      streak: FREEZE_EVERY - 1,
      freezes: FREEZE_MAX,
      lastPlayed: '2026-08-20',
    });
    const after = touchStreak(before, day('2026-08-21'));
    expect(after.freezes).toBe(FREEZE_MAX);
  });

  it('preserves bestStreak across a covered gap', () => {
    const before = p({ streak: 40, bestStreak: 40, freezes: 1, lastPlayed: '2026-08-19' });
    const after = touchStreak(before, day('2026-08-21'));
    expect(after.bestStreak).toBe(41);
  });
});

describe('vacation', () => {
  it('holds the streak across a gap no number of freezes could cover', () => {
    const before = p({ streak: 40, freezes: 0, lastPlayed: '2026-08-01', vacationSince: '2026-08-02' });
    const after = touchStreak(before, day('2026-08-21'));
    expect(after.streak).toBe(40);
  });

  it('does not GROW the streak while paused — that would be a lie about their record', () => {
    const before = p({ streak: 12, lastPlayed: '2026-08-10', vacationSince: '2026-08-11' });
    const after = touchStreak(before, day('2026-08-21'));
    expect(after.streak).toBe(12);
  });

  it('ends when the player plays, without asking them to say so', () => {
    const before = p({ streak: 5, lastPlayed: '2026-08-10', vacationSince: '2026-08-11' });
    expect(touchStreak(before, day('2026-08-21')).vacationSince).toBeNull();
  });

  it('does not spend a freeze on a gap the pause already covered', () => {
    const before = p({ streak: 9, freezes: 2, lastPlayed: '2026-08-19', vacationSince: '2026-08-20' });
    expect(touchStreak(before, day('2026-08-21')).freezes).toBe(2);
  });

  it('cannot resurrect a streak that was already gone', () => {
    const before = p({ streak: 0, lastPlayed: '2026-07-01', vacationSince: '2026-07-02' });
    expect(touchStreak(before, day('2026-08-21')).streak).toBe(1);
  });
});
