import { describe, expect, it } from 'vitest';
import {
  dailyIndex,
  dayKey,
  rankFor,
  scoreWord,
  shareText,
  shuffle,
  submit,
  type Puzzle,
} from './game';
import { touchStreak, type Progress } from './storage';

const puzzle: Puzzle = {
  id: 1,
  letters: ['a', 'c', 'e', 'l', 'r', 's'],
  base: 'clears',
  grid: ['clears', 'scale', 'clear', 'race', 'sale'],
  bonus: ['ale', 'car', 'ear', 'races'],
  maxScore: 100,
};

describe('scoreWord', () => {
  it('gives 3-letter words a flat point', () => {
    expect(scoreWord('ale', 6)).toBe(1);
  });

  it('scores 4+ letter words by length', () => {
    expect(scoreWord('race', 6)).toBe(4);
    expect(scoreWord('scale', 6)).toBe(5);
  });

  it('adds a wheel-size bonus for using every letter', () => {
    expect(scoreWord('clears', 6)).toBe(12);
  });
});

describe('submit', () => {
  const none = new Set<string>();

  it('accepts a grid word and flags the base', () => {
    expect(submit(puzzle, 6, 'clears', none)).toEqual({
      kind: 'grid',
      word: 'clears',
      points: 12,
      isBase: true,
    });
    expect(submit(puzzle, 6, 'race', none)).toMatchObject({
      kind: 'grid',
      isBase: false,
    });
  });

  it('accepts a bonus word', () => {
    expect(submit(puzzle, 6, 'races', none)).toMatchObject({ kind: 'bonus' });
  });

  it('rejects non-words', () => {
    expect(submit(puzzle, 6, 'zzz', none)).toMatchObject({ kind: 'invalid' });
  });

  it('reports duplicates rather than re-scoring them', () => {
    expect(submit(puzzle, 6, 'race', new Set(['race']))).toMatchObject({
      kind: 'duplicate',
    });
  });

  it('rejects words under the minimum length', () => {
    expect(submit(puzzle, 6, 'ac', none)).toMatchObject({ kind: 'too-short' });
  });

  it('normalizes case and whitespace', () => {
    expect(submit(puzzle, 6, '  RaCe ', none)).toMatchObject({ kind: 'grid' });
  });
});

describe('rankFor', () => {
  it('starts at Novice and tops out at Genius', () => {
    expect(rankFor(0, 100).name).toBe('Novice');
    expect(rankFor(100, 100).name).toBe('Genius');
  });

  it('reports the points needed for the next rank', () => {
    const r = rankFor(10, 100); // 10% -> Solid, next Sharp at 25%
    expect(r.name).toBe('Solid');
    expect(r.next).toBe('Sharp');
    expect(r.pointsToNext).toBe(15);
  });

  it('does not divide by zero on an empty puzzle', () => {
    expect(rankFor(0, 0).progress).toBe(0);
  });
});

describe('shuffle', () => {
  it('keeps the same letters', () => {
    const out = shuffle(['a', 'b', 'c', 'd']);
    expect([...out].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('never returns the identical order', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(shuffle(['a', 'b', 'c', 'd', 'e', 'f']).join('')).not.toBe('abcdef');
    }
  });
});

describe('dailyIndex', () => {
  it('is stable for the same date', () => {
    const a = dailyIndex(new Date(2026, 7, 8), 240);
    const b = dailyIndex(new Date(2026, 7, 8), 240);
    expect(a).toBe(b);
  });

  it('advances by one per day and wraps in range', () => {
    const a = dailyIndex(new Date(2026, 7, 8), 240);
    const b = dailyIndex(new Date(2026, 7, 9), 240);
    expect(b).toBe((a + 1) % 240);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(240);
  });
});

describe('shareText', () => {
  const tiles = (pattern: string) =>
    // b = base solved, x = solved, . = missed
    pattern.split('').map((c) => ({
      solved: c !== '.',
      isBase: c === 'b',
    }));

  it('reveals shape and rank but never a word', () => {
    const text = shareText({
      dayNumber: 12,
      rank: 'Fluent',
      score: 61,
      tiles: tiles('bx x..'.replace(' ', '')),
      bonusFound: 4,
      streak: 5,
      url: 'https://wordy.example',
    });
    expect(text).toContain('Wordy #12 — Fluent');
    // No answer from the puzzle may appear anywhere in the card.
    for (const answer of [...puzzle.grid, ...puzzle.bonus]) {
      expect(text.toLowerCase()).not.toContain(answer);
    }
  });

  it('marks the full-wheel word distinctly from the rest', () => {
    const text = shareText({
      dayNumber: 1,
      rank: 'Genius',
      score: 100,
      tiles: tiles('bxx'),
      bonusFound: 0,
      streak: 1,
    });
    expect(text).toContain('🟩🟦🟦');
  });

  it('shows misses', () => {
    const text = shareText({
      dayNumber: 1,
      rank: 'Solid',
      score: 8,
      tiles: tiles('.x.'),
      bonusFound: 0,
      streak: 1,
    });
    expect(text).toContain('⬛🟦⬛');
  });

  it('omits bonus, streak and url when they have nothing to say', () => {
    const text = shareText({
      dayNumber: 3,
      rank: 'Novice',
      score: 4,
      tiles: tiles('..'),
      bonusFound: 0,
      streak: 1,
    });
    expect(text).not.toContain('bonus');
    expect(text).not.toContain('streak');
    expect(text).not.toContain('http');
    expect(text.trim().split('\n')).toHaveLength(3);
  });

  it('includes bonus, streak and url when they do', () => {
    const text = shareText({
      dayNumber: 3,
      rank: 'Genius',
      score: 99,
      tiles: tiles('bxx'),
      bonusFound: 14,
      streak: 5,
      url: 'https://wordy.example',
    });
    expect(text).toContain('14 bonus · 99 pts · 5-day streak');
    expect(text.endsWith('https://wordy.example')).toBe(true);
  });
});

describe('touchStreak', () => {
  const base: Progress = {
    days: {},
    streak: 0,
    bestStreak: 0,
    lastPlayed: null,
    muted: false,
  };
  const today = new Date(2026, 7, 8);
  const yesterday = new Date(2026, 7, 7);
  const lastWeek = new Date(2026, 7, 1);

  it('starts a streak at 1', () => {
    expect(touchStreak(base, today).streak).toBe(1);
  });

  it('increments when the previous play was yesterday', () => {
    const p = { ...base, streak: 4, lastPlayed: dayKey(yesterday) };
    expect(touchStreak(p, today).streak).toBe(5);
  });

  it('resets after a gap', () => {
    const p = { ...base, streak: 9, lastPlayed: dayKey(lastWeek) };
    expect(touchStreak(p, today).streak).toBe(1);
  });

  it('is idempotent within the same day', () => {
    const p = { ...base, streak: 3, lastPlayed: dayKey(today) };
    expect(touchStreak(p, today)).toBe(p);
  });

  it('tracks the best streak across resets', () => {
    const p = { ...base, streak: 9, bestStreak: 9, lastPlayed: dayKey(lastWeek) };
    expect(touchStreak(p, today).bestStreak).toBe(9);
  });
});
