import { describe, expect, it } from 'vitest';
import {
  activeLetters,
  clueTarget,
  dailyIndex,
  isReachable,
  dayKey,
  rankFor,
  rankLadder,
  puzzleForPlayer,
  themeGroups,
  offsetForIndex,
  scoreWord,
  shareText,
  shuffle,
  submit,
  type Puzzle,
  dailyCycle,
  progressKey,
  gridMaxScore,
} from './game';
import { EMPTY, migrateV1, touchStreak, type Progress } from './storage';
import {
  bonusToNextToken,
  COST_LETTER,
  COST_WORD,
  EMPTY_REVEAL,
  revealedCount,
  revealLetter,
  revealWord,
  STARTING_TOKENS,
  tokenBalance,
} from './hints';
import { parseModern } from './definitions';
import { assistFor, isStalled, STALL_IDLE_MS, STALL_MISSES } from './assist';

const puzzle: Puzzle = {
  id: 1,
  letters: ['a', 'c', 'e', 'l', 'r', 's'],
  base: 'clears',
  grid: ['clears', 'scale', 'clear', 'race', 'sale'],
  bonus: ['ale', 'car', 'ear', 'races'],
  maxScore: 100,
  clues: { clears: 'Makes free of obstruction.' },
  unlockOrder: ['a', 'c', 'e', 'l', 'r', 's'],
  startActive: 4,
  difficulty: 0.4,
  theme: null,
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
  it('starts at Novice and tops out at Complete', () => {
    expect(rankFor(0, 100).name).toBe('Novice');
    expect(rankFor(100, 100).name).toBe('Complete');
  });

  it('makes clearing the grid the TOP rank, not rank 3 of 8', () => {
    /*
     * The regression this guards: ranks measured every word the letters can
     * make, and the six rows are worth a mean 27.4% of that — so doing exactly
     * what the UI asks ("fill every row") showed "Sharp", with five ranks
     * greyed out above it, gated on bonus words the player was never shown.
     */
    const puzzle = {
      grid: ['faucet', 'facet', 'cafe', 'fact', 'ace', 'cut'],
    } as unknown as Parameters<typeof gridMaxScore>[0];
    const max = gridMaxScore(puzzle, 6);
    expect(rankFor(max, max).name).toBe('Complete');
    // And a half-cleared grid lands mid-ladder, not near the bottom.
    const half = rankFor(Math.round(max * 0.5), max);
    expect(half.index).toBeGreaterThanOrEqual(4);
  });

  it('counts only the six rows toward rank', () => {
    const puzzle = { grid: ['cafe', 'ace'] } as unknown as Parameters<
      typeof gridMaxScore
    >[0];
    // 4 + 1 = 5. Bonus words are deliberately absent from this number.
    expect(gridMaxScore(puzzle, 6)).toBe(5);
  });

  it('puts Genius within reach rather than at perfection', () => {
    // 75% is a good day; 100% is a different achievement with its own name.
    expect(rankFor(75, 100).name).toBe('Genius');
    expect(rankFor(99, 100).name).toBe('Genius');
    expect(rankFor(100, 100).name).toBe('Complete');
  });

  it('reports the points needed for the next rank', () => {
    const r = rankFor(10, 100); // 10% -> Solid, next Sharp at 18%
    expect(r.name).toBe('Solid');
    expect(r.next).toBe('Sharp');
    expect(r.pointsToNext).toBe(8);
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
      rank: 'Fluent',
      score: 61,
      tiles: tiles('bx x..'.replace(' ', '')),
      bonusFound: 4,
      streak: 5,
      url: 'https://wordy.example',
    });
    expect(text).toContain('Wordy — Fluent');
    // No answer from the puzzle may appear anywhere in the card.
    for (const answer of [...puzzle.grid, ...puzzle.bonus]) {
      expect(text.toLowerCase()).not.toContain(answer);
    }
  });

  it('marks the full-wheel word distinctly from the rest', () => {
    const text = shareText({
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

  it('leads with the clue, because that is the part worth quoting', () => {
    const text = shareText({
      theme: 'The Cookout',
      clue: 'Dug out the couch when you heard the truck turn onto the street.',
      rank: 'Clever',
      score: 40,
      tiles: tiles('bxx'),
      bonusFound: 0,
      streak: 1,
    });
    const lines = text.split('\n');
    expect(lines[0]).toBe('Wordy — The Cookout · Clever');
    // Above the tiles: a reader scanning a feed sees line one and nothing else.
    expect(lines[1]).toContain('Dug out the couch');
    expect(lines[2]).toContain('🟩');
  });

  it('still names the game when a board has no theme', () => {
    const text = shareText({
      rank: 'Solid',
      score: 8,
      tiles: tiles('x'),
      bonusFound: 0,
      streak: 1,
    });
    expect(text.split('\n')[0]).toBe('Wordy — Solid');
  });

  it('includes bonus, streak and url when they do', () => {
    const text = shareText({
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
  const base: Progress = { ...EMPTY };
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

describe('hint economy', () => {
  it('grants a starting balance so hints are usable immediately', () => {
    expect(tokenBalance({ bonusTotal: 0, cleared: 0, spent: 0 })).toBe(
      STARTING_TOKENS
    );
  });

  it('earns a token every 3 bonus words', () => {
    expect(tokenBalance({ bonusTotal: 2, cleared: 0, spent: 0 })).toBe(3);
    expect(tokenBalance({ bonusTotal: 3, cleared: 0, spent: 0 })).toBe(4);
    expect(tokenBalance({ bonusTotal: 9, cleared: 0, spent: 0 })).toBe(6);
  });

  it('earns a token per cleared puzzle', () => {
    expect(tokenBalance({ bonusTotal: 0, cleared: 2, spent: 0 })).toBe(5);
  });

  it('never goes negative', () => {
    expect(tokenBalance({ bonusTotal: 0, cleared: 0, spent: 99 })).toBe(0);
  });

  it('reports bonus words needed for the next token', () => {
    expect(bonusToNextToken(0)).toBe(3);
    expect(bonusToNextToken(2)).toBe(1);
    expect(bonusToNextToken(3)).toBe(3);
  });
});

describe('revealLetter', () => {
  const base = { ...EMPTY_REVEAL };

  it('reveals one more leading letter', () => {
    const r = revealLetter(base, 'linker', { solved: false, balance: 3 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(revealedCount(r.reveal, 'linker')).toBe(1);
      expect(r.cost).toBe(COST_LETTER);
    }
  });

  it('accumulates across spends', () => {
    let reveal = base;
    for (let i = 0; i < 3; i += 1) {
      const r = revealLetter(reveal, 'linker', { solved: false, balance: 9 });
      if (r.ok) reveal = r.reveal;
    }
    expect(revealedCount(reveal, 'linker')).toBe(3);
  });

  it('refuses to reveal the final letter for a letter price', () => {
    const reveal = { letters: { race: 3 }, words: [] };
    expect(revealLetter(reveal, 'race', { solved: false, balance: 9 })).toEqual({
      ok: false,
      reason: 'nothing-left',
    });
  });

  it('refuses without tokens', () => {
    expect(revealLetter(base, 'linker', { solved: false, balance: 0 })).toEqual({
      ok: false,
      reason: 'no-tokens',
    });
  });

  it('refuses on a solved word', () => {
    expect(revealLetter(base, 'linker', { solved: true, balance: 9 })).toEqual({
      ok: false,
      reason: 'already-solved',
    });
  });
});

describe('revealWord', () => {
  it('fills the whole word and costs more', () => {
    const r = revealWord(EMPTY_REVEAL, 'linker', {
      solved: false,
      balance: 3,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cost).toBe(COST_WORD);
      expect(revealedCount(r.reveal, 'linker')).toBe(6);
    }
  });

  it('refuses when the balance is short', () => {
    expect(
      revealWord(EMPTY_REVEAL, 'linker', { solved: false, balance: 2 })
    ).toEqual({ ok: false, reason: 'no-tokens' });
  });

  it('will not double-spend on the same word', () => {
    const reveal = { letters: {}, words: ['linker'] };
    expect(revealWord(reveal, 'linker', { solved: false, balance: 9 })).toEqual({
      ok: false,
      reason: 'already-solved',
    });
  });
});

describe('migrateV1', () => {
  const legacy = {
    days: { '2026-08-07': ['linker', 'kiln'], '2026-08-08': ['race'] },
    streak: 4,
    bestStreak: 9,
    lastPlayed: '2026-08-08',
    muted: true,
  };

  it('preserves the streak, which is the part that matters', () => {
    const p = migrateV1(legacy, () => null);
    expect(p.streak).toBe(4);
    expect(p.bestStreak).toBe(9);
    expect(p.lastPlayed).toBe('2026-08-08');
    expect(p.muted).toBe(true);
  });

  it('marks every legacy day as played even when unattributable', () => {
    const p = migrateV1(legacy, () => null);
    expect(p.days).toEqual({ '2026-08-07': true, '2026-08-08': true });
    expect(p.words).toEqual({});
  });

  it('re-keys words by puzzle when the day can be attributed', () => {
    const p = migrateV1(legacy, (k) => (k === '2026-08-07' ? '33' : null));
    expect(p.words).toEqual({ '33': ['linker', 'kiln'] });
  });

  it('starts the hint ledger clean', () => {
    const p = migrateV1(legacy, () => null);
    expect(p.bonusTotal).toBe(0);
    expect(p.spent).toBe(0);
    expect(p.clearedIds).toEqual([]);
  });
});

describe('touchStreak day marking', () => {
  it('records the day as played so the strip and streak agree', () => {
    const p = touchStreak({ ...EMPTY }, new Date(2026, 7, 8));
    expect(p.days['2026-08-08']).toBe(true);
    expect(p.streak).toBe(1);
  });
});

describe('parseModern', () => {
  const payload = [
    {
      word: 'linker',
      meanings: [
        {
          partOfSpeech: 'noun',
          definitions: [
            { definition: 'That which links.' },
            { definition: 'A computer program that assembles objects.' },
          ],
        },
      ],
    },
  ];

  it('takes the first usable sense with its part of speech', () => {
    expect(parseModern(payload)).toEqual({
      d: 'That which links.',
      p: 'noun',
    });
  });

  it('skips empty or too-short definitions', () => {
    expect(
      parseModern([
        {
          meanings: [
            {
              partOfSpeech: 'verb',
              definitions: [{ definition: '  ' }, { definition: 'To bind.' }],
            },
          ],
        },
      ])
    ).toEqual({ d: 'To bind.', p: 'verb' });
  });

  it('falls through to a later meaning when the first has none', () => {
    expect(
      parseModern([
        {
          meanings: [
            { partOfSpeech: 'noun', definitions: [] },
            { partOfSpeech: 'verb', definitions: [{ definition: 'To link.' }] },
          ],
        },
      ])
    ).toEqual({ d: 'To link.', p: 'verb' });
  });

  it('omits part of speech when the source does not give one', () => {
    expect(
      parseModern([{ meanings: [{ definitions: [{ definition: 'A thing.' }] }] }])
    ).toEqual({ d: 'A thing.', p: undefined });
  });

  // It parses a third-party shape, so every level has to survive garbage.
  it('returns null for malformed payloads rather than throwing', () => {
    for (const bad of [
      null,
      undefined,
      {},
      [],
      'nope',
      [{}],
      [{ meanings: 'no' }],
      [{ meanings: [{}] }],
      [{ meanings: [{ definitions: 'no' }] }],
      [{ meanings: [{ definitions: [{}] }] }],
      [{ meanings: [{ definitions: [{ definition: 42 }] }] }],
    ]) {
      expect(parseModern(bad)).toBeNull();
    }
  });
});

describe('activeLetters', () => {
  const p: Puzzle = {
    ...puzzle,
    unlockOrder: ['s', 'a', 'l', 'e', 'c', 'r'],
    startActive: 4,
  };

  it('is the whole wheel when escalating is off', () => {
    expect(activeLetters(p, 0, false).size).toBe(6);
  });

  it('starts with only the opening letters', () => {
    expect([...activeLetters(p, 0, true)]).toEqual(['s', 'a', 'l', 'e']);
  });

  it('unlocks one letter per cleared row', () => {
    expect(activeLetters(p, 1, true).size).toBe(5);
    expect(activeLetters(p, 2, true).size).toBe(6);
  });

  it('never exceeds the wheel', () => {
    expect(activeLetters(p, 99, true).size).toBe(6);
  });

  it('tolerates a negative row count', () => {
    expect(activeLetters(p, -3, true).size).toBe(4);
  });
});

describe('clueTarget', () => {
  const grid = ['clears', 'scale', 'race'];
  const none = () => false;

  it('points at the first unsolved row', () => {
    expect(clueTarget(grid, none, 0)).toBe('clears');
  });

  it('cycles through the unsolved rows', () => {
    expect(clueTarget(grid, none, 1)).toBe('scale');
    expect(clueTarget(grid, none, 3)).toBe('clears');
  });

  it('skips rows already done', () => {
    expect(clueTarget(grid, (w) => w === 'clears', 0)).toBe('scale');
  });

  it('handles a negative cursor', () => {
    expect(clueTarget(grid, none, -1)).toBe('race');
  });

  it('returns null when everything is done', () => {
    expect(clueTarget(grid, () => true, 0)).toBeNull();
  });
});

describe('clueTarget with locked letters', () => {
  const grid = ['heriot', 'their', 'rote'];
  const none = () => false;
  // 'i' is the only locked letter, so heriot and their are out and rote is in.
  const active = new Set(['h', 'e', 'r', 'o', 't']);
  const reachable = (w: string) => isReachable(w, active);

  it('skips words whose letters are still locked', () => {
    // heriot and their both need i, which is locked.
    expect(clueTarget(grid, none, 0, reachable)).toBe('rote');
  });

  it('cycles only within the reachable rows', () => {
    expect(clueTarget(grid, none, 1, reachable)).toBe('rote');
  });

  it('falls back rather than going blank when nothing is reachable', () => {
    const locked = () => false;
    expect(clueTarget(grid, none, 0, locked)).toBe('heriot');
  });

  it('still returns null when every row is done', () => {
    expect(clueTarget(grid, () => true, 0, reachable)).toBeNull();
  });
});

describe('isReachable', () => {
  it('is true only when every letter is unlocked', () => {
    expect(isReachable('rote', new Set(['r', 'o', 't', 'e']))).toBe(true);
    expect(isReachable('rote', new Set(['r', 'o', 't']))).toBe(false);
    expect(isReachable('', new Set<string>())).toBe(true);
  });
});

describe('rankLadder', () => {
  it('resolves each rank to a point cost for this puzzle', () => {
    const l = rankLadder(0, 100);
    expect(l.map((s) => s.at)).toEqual([0, 8, 18, 30, 45, 60, 75, 100]);
  });

  it('marks what you have reached and where you are', () => {
    const l = rankLadder(30, 100); // 30% -> Clever
    expect(l.find((s) => s.current)?.name).toBe('Clever');
    expect(l.filter((s) => s.reached).map((s) => s.name)).toEqual([
      'Novice',
      'Solid',
      'Sharp',
      'Clever',
    ]);
  });

  it('says what the next step costs from here, not from zero', () => {
    const l = rankLadder(30, 100);
    expect(l.find((s) => s.name === 'Fluent')?.toGo).toBe(15);
    expect(l.find((s) => s.name === 'Genius')?.toGo).toBe(45);
  });

  it('reports nothing to go for ranks already earned', () => {
    expect(
      rankLadder(30, 100)
        .filter((s) => s.reached)
        .every((s) => s.toGo === 0)
    ).toBe(true);
  });

  it('survives a zero ceiling', () => {
    const l = rankLadder(0, 0);
    expect(l).toHaveLength(8);
    expect(l.every((s) => s.at === 0)).toBe(true);
  });
});

describe('threshold rounding', () => {
  // 0.55 * 100 === 55.00000000000001, which naively ceils to 56.
  it('does not inflate a threshold by floating-point dust', () => {
    expect(rankLadder(0, 100).find((s) => s.name === 'Fluent')?.at).toBe(45);
  });

  it('keeps rankFor and rankLadder in agreement', () => {
    for (const max of [100, 137, 213, 999]) {
      for (const score of [0, 7, 41, 88]) {
        const r = rankFor(score, max);
        const ladder = rankLadder(score, max);
        const current = ladder.find((s) => s.current);
        expect(current?.name).toBe(r.name);
        if (r.next) {
          const next = ladder.find((s) => s.name === r.next);
          expect(next?.toGo).toBe(r.pointsToNext);
        }
      }
    }
  });
});

describe('puzzleForPlayer', () => {
  const file = {
    version: 2,
    wheel: 6,
    starters: [12, 40, 7, 99],
    puzzles: Array.from({ length: 240 }, (_, i) => ({ ...puzzle, id: i + 1 })),
  };
  const today = new Date(2026, 7, 9);

  it('opens a new player on the kindest puzzle, not the date', () => {
    const r = puzzleForPlayer(file, 0, today, 0);
    expect(r.index).toBe(12);
    expect(r.warmup).toBe(1);
  });

  it('walks the ladder in order', () => {
    expect(puzzleForPlayer(file, 1, today, 0).index).toBe(40);
    expect(puzzleForPlayer(file, 2, today, 0).index).toBe(7);
    expect(puzzleForPlayer(file, 3, today, 0).warmup).toBe(4);
  });

  it('joins the daily once the ladder is done', () => {
    const r = puzzleForPlayer(file, 4, today, 0);
    expect(r.warmup).toBeNull();
    expect(r.index).toBe(dailyIndex(today, 240));
  });

  it('respects an explicit offset even mid-ladder', () => {
    // Navigating away means the player wants the normal rotation.
    const r = puzzleForPlayer(file, 1, today, 2);
    expect(r.warmup).toBeNull();
    expect(r.index).toBe((dailyIndex(today, 240) + 2) % 240);
  });

  it('wraps a negative offset rather than going out of range', () => {
    const r = puzzleForPlayer(file, 9, today, -1);
    expect(r.index).toBeGreaterThanOrEqual(0);
    expect(r.index).toBeLessThan(240);
  });

  it('falls back to the daily when no ladder is present', () => {
    const bare = { ...file, starters: [] };
    expect(puzzleForPlayer(bare, 0, today, 0).warmup).toBeNull();
  });
});

describe('isStalled', () => {
  const base = {
    idleMs: 0,
    missesSinceProgress: 0,
    rowsLeft: 3,
    tokens: 3,
    alreadyOffered: false,
  };

  it('does not fire while the player is making progress', () => {
    expect(isStalled(base)).toBe(false);
  });

  it('fires after a long silence', () => {
    expect(isStalled({ ...base, idleMs: STALL_IDLE_MS })).toBe(true);
  });

  it('fires after repeated wrong guesses, even with no idle time', () => {
    expect(isStalled({ ...base, missesSinceProgress: STALL_MISSES })).toBe(true);
  });

  it('never fires once the grid is done', () => {
    expect(isStalled({ ...base, idleMs: 99_000, rowsLeft: 0 })).toBe(false);
  });

  it('does not nag once it has already offered', () => {
    expect(
      isStalled({ ...base, idleMs: 99_000, alreadyOffered: true })
    ).toBe(false);
  });
});

describe('assistFor', () => {
  const unsolved = ['linker', 'inkle', 'kiln'];

  it('targets the shortest row — the cheapest way back into motion', () => {
    expect(assistFor(unsolved, 9, 1, 3)).toEqual({
      kind: 'open-word',
      word: 'kiln',
      cost: 3,
    });
  });

  it('falls back to a letter when a whole word is unaffordable', () => {
    expect(assistFor(unsolved, 2, 1, 3)).toEqual({
      kind: 'reveal-letter',
      word: 'kiln',
      cost: 1,
    });
  });

  it('helps for free when the player has nothing left to spend', () => {
    // Someone with no tokens is the most likely to quit; charging them at that
    // exact moment is backwards.
    expect(assistFor(unsolved, 0, 1, 3)).toEqual({
      kind: 'free-letter',
      word: 'kiln',
      cost: 0,
    });
  });

  it('is deterministic when lengths tie', () => {
    expect(assistFor(['bike', 'acre'], 9, 1, 3)).toMatchObject({ word: 'acre' });
  });

  it('returns nothing when there is nothing to help with', () => {
    expect(assistFor([], 9, 1, 3)).toBeNull();
  });
});

describe('themeGroups', () => {
  const file = {
    version: 2,
    wheel: 6,
    starters: [],
    puzzles: [
      { ...puzzle, theme: { id: 'a', name: 'Alpha', blurb: '' } },
      { ...puzzle, theme: null },
      { ...puzzle, theme: { id: 'b', name: 'Beta', blurb: '' } },
      { ...puzzle, theme: { id: 'a', name: 'Alpha', blurb: '' } },
    ],
  };

  it('groups puzzles under their theme', () => {
    const g = themeGroups(file);
    expect(g).toHaveLength(2);
    expect(g[0]).toMatchObject({ id: 'a', indices: [0, 3] });
  });

  it('ignores unthemed puzzles', () => {
    expect(themeGroups(file).flatMap((g) => g.indices)).not.toContain(1);
  });

  it('is empty when nothing is themed', () => {
    expect(themeGroups({ ...file, puzzles: [{ ...puzzle, theme: null }] })).toEqual(
      []
    );
  });
});

describe('offsetForIndex', () => {
  const file = {
    version: 2,
    wheel: 6,
    starters: [],
    puzzles: Array.from({ length: 240 }, () => puzzle),
  };
  const today = new Date(2026, 7, 9);

  it('round-trips through puzzleForPlayer', () => {
    for (const target of [0, 7, 120, 239]) {
      const off = offsetForIndex(file, today, target);
      expect(puzzleForPlayer(file, 99, today, off).index).toBe(target);
    }
  });

  it('is 0 for today itself', () => {
    expect(offsetForIndex(file, today, dailyIndex(today, 240))).toBe(0);
  });

  it('wraps rather than going negative', () => {
    expect(offsetForIndex(file, today, 0)).toBeGreaterThanOrEqual(0);
  });
});


describe('the daily never serves a board you already finished', () => {
  /*
   * Regression: `dailyIndex` is `epochDay % total` and found words are keyed by
   * puzzle, so the plain seed returns a solved board. It reads as a day-241
   * problem and is actually a day-two problem, because the theme picker lets a
   * player reach any index long before the calendar does.
   */
  const file = {
    wheel: 6,
    starters: [],
    puzzles: Array.from({ length: 5 }, (_, i) => ({ id: i })),
  } as unknown as Parameters<typeof puzzleForPlayer>[0];

  const day = new Date(2026, 7, 9);
  const seed = dailyIndex(day, 5);

  it('returns the seed when nothing is cleared', () => {
    expect(puzzleForPlayer(file, 0, day, 0, new Set()).index).toBe(seed);
  });

  it('walks past a cleared puzzle instead of re-serving it', () => {
    const cleared = new Set([String(seed)]);
    expect(puzzleForPlayer(file, 0, day, 0, cleared).index).toBe((seed + 1) % 5);
  });

  it('walks past a RUN of cleared puzzles', () => {
    const cleared = new Set(
      [0, 1, 2].map((k) => String((seed + k) % 5))
    );
    expect(puzzleForPlayer(file, 0, day, 0, cleared).index).toBe((seed + 3) % 5);
  });

  it('falls back to the seed once the whole catalogue is cleared', () => {
    const cleared = new Set(['0', '1', '2', '3', '4']);
    expect(puzzleForPlayer(file, 0, day, 0, cleared).index).toBe(seed);
  });

  it('never overrides an explicit offset — that is the player steering', () => {
    const cleared = new Set([String((seed + 1) % 5)]);
    expect(puzzleForPlayer(file, 0, day, 1, cleared).index).toBe((seed + 1) % 5);
  });
});

describe('progress keys are scoped to the lap', () => {
  it('keeps the bare id on lap zero so nobody needs migrating', () => {
    expect(progressKey(42, 0)).toBe('42');
  });

  it('separates later laps, so a second pass is a fresh sheet', () => {
    expect(progressKey(42, 1)).toBe('42#1');
    expect(progressKey(42, 1)).not.toBe(progressKey(42, 0));
  });

  it('counts laps from the epoch day, not from a stored counter', () => {
    expect(dailyCycle(new Date(2026, 7, 9), 240)).toBeGreaterThan(0);
    expect(dailyCycle(new Date(2026, 7, 9), 1_000_000)).toBe(0);
  });
});
