import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  activeLetters,
  fillClue,
  unlockedIndices,
  clueTarget,
  completionStats,
  dailyIndex,
  isReachable,
  isDailyEligible,
  dailyPoolSize,
  dayKey,
  rankFor,
  rankLadder,
  puzzleForPlayer,
  themeGroups,
  themeShelves,
  offsetForIndex,
  scoreWord,
  shareParts,
  shareText,
  shuffle,
  submit,
  type Puzzle,
  type PuzzleFile,
  dailyCycle,
  progressKey,
  gridMaxScore,
} from './game';
import {
  EMPTY,
  migrateToBaseKeys,
  migrateV1,
  touchStreak,
  type Progress,
} from './storage';
import {
  bonusToNextToken,
  COST_LETTER,
  COST_WORD,
  EMPTY_REVEAL,
  revealedChip,
  revealedCount,
  revealLetter,
  revealWord,
  STARTING_TOKENS,
  tokenBalance,
  type RevealState,
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
  const ROWS = 6;

  it('starts at Novice and tops out at Complete', () => {
    expect(rankFor(0, ROWS).name).toBe('Novice');
    expect(rankFor(ROWS, ROWS).name).toBe('Complete');
  });

  it('gives one rank per row, so nothing can be leapt', () => {
    /*
     * The finding this exists for. Ranks were percentages of a board's POINTS,
     * and the base word takes the all-wheel bonus — 12 points on a grid worth
     * 23-33, i.e. 36-52% of the whole board. A played warm-up crossed six of
     * eight ranks in six words and the last word jumped FOUR rungs at once,
     * Fluent straight to Complete. A ladder one move can leap most of measures
     * whether the long word was found, not how the player is doing.
     *
     * Rows make that impossible by construction: every rung costs exactly one
     * answer, so the index can only ever move by one.
     */
    const names = Array.from({ length: ROWS + 1 }, (_, r) => rankFor(r, ROWS).name);
    expect(names).toEqual([
      'Novice',
      'Solid',
      'Sharp',
      'Clever',
      'Fluent',
      'Wordsmith',
      'Complete',
    ]);
    for (let r = 1; r <= ROWS; r += 1) {
      expect(rankFor(r, ROWS).index - rankFor(r - 1, ROWS).index).toBe(1);
    }
  });

  it('always ends at Complete, even on a board with fewer rows', () => {
    // Scaled rather than indexed, so a short board drops a middle rung and
    // never the summit.
    expect(rankFor(5, 5).name).toBe('Complete');
    expect(rankFor(4, 4).name).toBe('Complete');
    expect(rankFor(0, 5).name).toBe('Novice');
  });

  it('is always exactly one row to the next rank', () => {
    const r = rankFor(3, ROWS);
    expect(r.name).toBe('Clever');
    expect(r.next).toBe('Fluent');
    expect(r.rowsToNext).toBe(1);
  });

  it('reports no next rank once every row is filled', () => {
    const top = rankFor(ROWS, ROWS);
    expect(top.next).toBeNull();
    expect(top.rowsToNext).toBe(0);
    expect(top.progress).toBe(1);
  });

  it('clamps a row count past the end rather than running off the ladder', () => {
    expect(rankFor(99, ROWS).name).toBe('Complete');
    expect(rankFor(-3, ROWS).name).toBe('Novice');
  });

  it('does not divide by zero on an empty puzzle', () => {
    expect(rankFor(0, 0).progress).toBe(0);
  });

  it('counts only the six rows toward score', () => {
    const puzzle = { grid: ['cafe', 'ace'] } as unknown as Parameters<
      typeof gridMaxScore
    >[0];
    // 4 + 1 = 5. Bonus words are deliberately absent from this number, which
    // is still true — points remain the SCORE, they just no longer set rank.
    expect(gridMaxScore(puzzle, 6)).toBe(5);
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

/*
 * The letter a player PAID for has to appear somewhere.
 *
 * Clue mode is the default mode, and its compact row chip rendered the word's
 * length and nothing else — so buying a letter spent a token and changed
 * nothing on screen. Every test here passed throughout, because the engine was
 * never wrong: revealLetter did its job and the chip did not read the result.
 * Asserting the ENGINE is not the same as asserting the player can see it.
 */
describe('fillClue', () => {
  /*
   * The clue carries its citation with the answer blanked, which is the right
   * trade while the row is a question and the wrong one the moment it is
   * answered — the definition sheet only ever opens on a solved row, and it
   * was still showing "——— of the Road" to the player who had just found it.
   */
  const END = 'Boyz II Men, 1992 — ——— of the Road, thirteen weeks at number one';

  it('puts the answer back where the blank was', () => {
    expect(fillClue(END, 'end')).toBe(
      'Boyz II Men, 1992 — END of the Road, thirteen weeks at number one'
    );
  });

  it('leaves a lone em dash alone — it is punctuation, not a blank', () => {
    // The clue above contains BOTH: "1992 — ———". Only the run is a marker,
    // and a naive replace on a single dash would eat the sentence's grammar.
    expect(fillClue(END, 'end')).toContain('1992 — END');
  });

  it('handles a blank at the start of the citation', () => {
    expect(fillClue('TLC’s slow one — ——— Light Special, written by Babyface', 'red'))
      .toBe('TLC’s slow one — RED Light Special, written by Babyface');
  });

  it('leaves a clue with no blank untouched', () => {
    const plain = 'What sampling was called before the lawyers arrived';
    expect(fillClue(plain, 'nicked')).toBe(plain);
  });
});

describe('unlockedIndices', () => {
  /*
   * Shuffling reorders the dial. It must not change the GAME.
   *
   * The indices were resolved against puzzle.letters and then applied to the
   * shuffled array the wheel actually renders, so position 3 meant one letter
   * to the lock and a different one to the tile under the player's thumb.
   * Every shuffle quietly dealt a different set of playable letters.
   */
  it('lights the same letters no matter how the dial is ordered', () => {
    const original = ['b', 'e', 'o', 'o', 'r', 't'];
    const active = ['b', 'o', 'o']; // the opening set for REBOOT
    const lit = (order: string[]) =>
      [...unlockedIndices(order, active)].map((i) => order[i]).sort().join('');

    expect(lit(original)).toBe('boo');
    for (const order of [
      ['o', 'o', 'b', 't', 'r', 'e'],
      ['t', 'r', 'e', 'o', 'b', 'o'],
      ['e', 'b', 'r', 'o', 't', 'o'],
    ]) {
      expect(lit(order)).toBe('boo');
    }
  });

  it('unlocks only one tile of a doubled letter when only one is active', () => {
    // The reason this is indices and not a Set: collapsing to a Set would
    // light both O's and the player would tap a locked one.
    const order = ['o', 'b', 'o', 't'];
    const idx = unlockedIndices(order, ['o', 'b']);
    expect(idx.size).toBe(2);
    expect([...idx].map((i) => order[i]).sort()).toEqual(['b', 'o']);
  });

  it('lights every tile when nothing is locked', () => {
    const order = ['c', 'a', 's', 't', 'l', 'e'];
    expect(unlockedIndices(order, order).size).toBe(6);
  });
});

describe('revealedChip', () => {
  it('is null before anything is revealed, so the chip shows the length', () => {
    expect(revealedChip('nicked', EMPTY_REVEAL)).toBe(null);
  });

  it('shows the bought letters and keeps the length readable as dots', () => {
    const r = revealLetter(EMPTY_REVEAL, 'nicked', { solved: false, balance: 3 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(revealedChip('nicked', r.reveal)).toBe('N·····');
  });

  it('grows one letter per spend, never changing width', () => {
    let reveal: RevealState = EMPTY_REVEAL;
    const seen: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const r = revealLetter(reveal, 'nicked', { solved: false, balance: 9 });
      if (r.ok) reveal = r.reveal;
      seen.push(revealedChip('nicked', reveal) ?? '');
    }
    expect(seen).toEqual(['N·····', 'NI····', 'NIC···']);
    // A chip that changed width on every spend would reflow the whole row.
    expect(new Set(seen.map((s) => s.length))).toEqual(new Set([6]));
  });

  it('spells a bought word out in full', () => {
    const r = revealWord(EMPTY_REVEAL, 'nice', { solved: false, balance: 3 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(revealedChip('nice', r.reveal)).toBe('NICE');
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

describe('migrateToBaseKeys', () => {
  /*
   * puzzle.id is `puzzles.length + 1` — an array POSITION wearing an
   * identifier's name. Cutting two packs renumbered every board after them
   * and slid saved progress onto whoever inherited the number. This is the
   * real save it was found in: key 63 held CRAFTY's words, and id 63 had
   * become INSTEP.
   */
  const BOARDS = [
    { id: 36, base: 'nicked', letters: [...'cdeikn'] },
    { id: 63, base: 'instep', letters: [...'einpst'] },
    { id: 90, base: 'crafty', letters: [...'acfrty'] },
  ];
  const board = (id: string) =>
    BOARDS.find((b) => String(b.id) === id) ?? null;
  const all = () => BOARDS;

  const save = (words: Record<string, string[]>): Progress => ({
    ...EMPTY,
    words,
    reveals: Object.fromEntries(
      Object.keys(words).map((k) => [k, { letters: {}, words: [] }])
    ),
    clearedIds: Object.keys(words),
  });

  it('re-keys an entry whose words still fit the board', () => {
    const { next, moved } = migrateToBaseKeys(
      save({ '36#210': ['nice', 'deck', 'end'] }),
      board,
      all
    );
    expect(moved).toBe(1);
    expect(next.words['nicked#210']).toEqual(['nice', 'deck', 'end']);
    expect(next.words['36#210']).toBeUndefined();
    // The lap survives, and reveals and clearedIds move with it.
    expect(next.reveals['nicked#210']).toBeDefined();
    expect(next.clearedIds).toEqual(['nicked#210']);
  });

  it('RECOVERS a slid entry by asking the words which board they came from', () => {
    /*
     * The observed corruption: key 63 held CRAFTY's words after id 63 became
     * INSTEP. The number is wrong and the content is not, so the content
     * wins — this is a save from before a catalogue edit, restored rather
     * than thrown away.
     */
    const { next, recovered } = migrateToBaseKeys(
      save({ '63#206': ['crafty', 'tray', 'arc'] }),
      board,
      all
    );
    expect(recovered).toBe(1);
    expect(next.words['crafty#206']).toEqual(['crafty', 'tray', 'arc']);
    expect(next.clearedIds).toEqual(['crafty#206']);
  });

  it('leaves a key alone when neither the id nor the words identify a board', () => {
    const { next, moved, recovered } = migrateToBaseKeys(
      save({ '999#210': ['zzz'] }),
      board,
      all
    );
    expect(moved).toBe(0);
    expect(recovered).toBe(0);
    expect(next.words['999#210']).toEqual(['zzz']);
    expect(next.clearedIds).toEqual(['999#210']);
  });

  it('NEVER empties a save because the resolver is not ready yet', () => {
    /*
     * The failure this pins, which I caused on a live save: the resolver is
     * configured during render while read() can run before it, so every id
     * resolved to null — and an earlier draft deleted what it could not
     * resolve. Every word, reveal and cleared board went at once. Unknown is
     * not permission to delete.
     */
    const full = save({ '36#210': ['nice'], '63#206': ['crafty'] });
    const { next } = migrateToBaseKeys(full, () => null, () => []);
    expect(next.words).toEqual(full.words);
    expect(next.reveals).toEqual(full.reveals);
    expect(next.clearedIds).toEqual(full.clearedIds);
  });

  it('is idempotent — base-keyed progress passes straight through', () => {
    const already = save({ 'nicked#210': ['nice'] });
    const once = migrateToBaseKeys(already, board, all);
    expect(once.moved).toBe(0);
    expect(once.next).toBe(already); // untouched, not merely equal
    const twice = migrateToBaseKeys(once.next, board, all);
    expect(twice.next.words).toEqual({ 'nicked#210': ['nice'] });
  });

  it('keeps a cycle-less key working', () => {
    const { next } = migrateToBaseKeys(save({ "36": ["nice"] }), board, all);
    expect(next.words['nicked']).toEqual(['nice']);
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
    expect(activeLetters(p, 0, false).length).toBe(6);
  });

  it('starts with only the opening letters', () => {
    expect([...activeLetters(p, 0, true)]).toEqual(['s', 'a', 'l', 'e']);
  });

  it('unlocks one letter per cleared row', () => {
    expect(activeLetters(p, 1, true).length).toBe(5);
    expect(activeLetters(p, 2, true).length).toBe(6);
  });

  it('never exceeds the wheel', () => {
    expect(activeLetters(p, 99, true).length).toBe(6);
  });

  it('tolerates a negative row count', () => {
    expect(activeLetters(p, -3, true).length).toBe(4);
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
  const active = [...['h', 'e', 'r', 'o', 't']];
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
    expect(isReachable('rote', ['r', 'o', 't', 'e'])).toBe(true);
    expect(isReachable('rote', ['r', 'o', 't'])).toBe(false);
    expect(isReachable('', [])).toBe(true);
  });
});

describe('rankLadder', () => {
  const ROWS = 6;

  it('is one rung per row, and the same rungs on every board', () => {
    // Rungs used to be percentages resolved against each puzzle's point
    // ceiling, so they moved board to board and could not be learned. Three
    // rows is Clever here and Clever tomorrow.
    const l = rankLadder(0, ROWS);
    expect(l.map((s) => s.at)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(l.map((s) => s.name)).toEqual([
      'Novice',
      'Solid',
      'Sharp',
      'Clever',
      'Fluent',
      'Wordsmith',
      'Complete',
    ]);
  });

  it('marks what you have reached and where you are', () => {
    const l = rankLadder(3, ROWS);
    expect(l.find((s) => s.current)?.name).toBe('Clever');
    expect(l.filter((s) => s.reached).map((s) => s.name)).toEqual([
      'Novice',
      'Solid',
      'Sharp',
      'Clever',
    ]);
  });

  it('says how many rows away each unreached rank is, from here', () => {
    const l = rankLadder(3, ROWS);
    expect(l.find((s) => s.name === 'Fluent')?.toGo).toBe(1);
    expect(l.find((s) => s.name === 'Complete')?.toGo).toBe(3);
  });

  it('reports nothing to go for ranks already earned', () => {
    expect(
      rankLadder(3, ROWS)
        .filter((s) => s.reached)
        .every((s) => s.toGo === 0)
    ).toBe(true);
  });

  it('survives a zero-row puzzle', () => {
    const l = rankLadder(0, 0);
    expect(l).toHaveLength(1);
    expect(l[0].at).toBe(0);
  });
});

describe('rank agreement', () => {
  /*
   * Replaces a floating-point rounding suite that guarded
   * `Math.ceil(fraction * max)` — 0.55 * 100 is 55.00000000000001, which
   * ceils to 56 and told a player a rank cost a point more than it did. Rows
   * are integers, so that entire class of bug is gone rather than fixed.
   */
  it('keeps rankFor and rankLadder saying the same thing', () => {
    for (const rows of [4, 5, 6]) {
      for (const filled of [0, 1, 3, rows]) {
        const r = rankFor(filled, rows);
        const ladder = rankLadder(filled, rows);
        expect(ladder.find((s) => s.current)?.name).toBe(r.name);
        if (r.next) {
          expect(ladder.find((s) => s.name === r.next)?.toGo).toBe(r.rowsToNext);
        } else {
          expect(ladder.at(-1)?.current).toBe(true);
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

  it('leaves a busy player alone, however long the board has resisted them', () => {
    /*
     * The bug this pins: idleMs was fed "time since the last banked word", so
     * a player spelling, undoing and shuffling their way through a hard board
     * got "Stuck? I'll start the 3-letter one" over the board they were
     * reading, mid-word. Activity restarts the idle clock now, so the only
     * routes to an offer are real silence or real failure.
     */
    const busy = { ...base, idleMs: 2_000, missesSinceProgress: 3 };
    expect(isStalled(busy)).toBe(false);
    // And the fruitless-effort route is untouched by that: one more miss,
    // still no silence, still stalled.
    expect(isStalled({ ...busy, missesSinceProgress: STALL_MISSES })).toBe(true);
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

describe('share card day number', () => {
  const base = {
    rank: 'Complete',
    score: 120,
    tiles: [
      { solved: true, isBase: true },
      { solved: true, isBase: false },
      { solved: false, isBase: false },
    ],
    bonusFound: 3,
    streak: 5,
  };

  it('names the puzzle when it is the daily, so two people know they mean the same board', () => {
    const out = shareText({ ...base, theme: 'The Nineties', dayNumber: 205 });
    expect(out.split('\n')[0]).toBe('Wordy #205 — The Nineties · Complete');
  });

  it('prints NO number for practice and warm-up', () => {
    // The last time every board carried a number, a warm-up player posted "#1"
    // at a board nobody else could see. Those genuinely are not a shared thing.
    for (const n of [null, undefined]) {
      const out = shareText({ ...base, theme: 'The Nineties', dayNumber: n });
      expect(out.split('\n')[0]).toBe('Wordy — The Nineties · Complete');
      expect(out).not.toContain('#');
    }
  });

  it('still leads with the clue under the heading, and never spoils an unsolved row', () => {
    const out = shareText({
      ...base,
      theme: 'The Nineties',
      dayNumber: 12,
      clue: 'Jodeci, 1991 — four men out of Charlotte on Uptown',
    });
    const lines = out.split('\n');
    expect(lines[0]).toContain('#12');
    expect(lines[1]).toBe('"Jodeci, 1991 — four men out of Charlotte on Uptown"');
  });
});

describe('share card names the escalating wheel', () => {
  const base = {
    rank: 'Complete',
    score: 120,
    tiles: [{ solved: true, isBase: true }],
    bonusFound: 0,
    streak: 1,
  };

  it('names it when it was in force, because nothing outside the app ever has', () => {
    expect(shareText({ ...base, escalating: true })).toContain('escalating wheel');
  });

  it('says nothing when it was off, or on a warm-up that runs without it', () => {
    expect(shareText({ ...base, escalating: false })).not.toContain('escalating');
    expect(shareText({ ...base })).not.toContain('escalating');
  });
});

describe('share splits the link into its own field', () => {
  const base = {
    rank: 'Complete',
    score: 40,
    tiles: [{ solved: true, isBase: true }],
    bonusFound: 0,
    streak: 1,
    theme: 'Sunday Service',
    clue: 'What the mothers do after the benediction',
    dayNumber: 137,
    url: 'https://wordy.example/#play=137',
  };

  it('keeps the URL out of the text, so a share sheet can unfurl it', () => {
    // A link buried in a text blob is just characters — iMessage, Slack and
    // WhatsApp only unfurl one passed as the `url` FIELD. With the link inline
    // every Open Graph tag the app ships was being thrown away.
    const p = shareParts(base);
    expect(p.text).not.toContain('http');
    expect(p.url).toBe('https://wordy.example/#play=137');
    expect(p.text).toContain('#137');
    expect(p.text).toContain('mothers');
  });

  it('keeps the URL inline for the clipboard, which has no fields', () => {
    const p = shareParts(base);
    expect(p.full).toContain('https://wordy.example/#play=137');
    expect(p.full.split('\n').at(-1)).toBe('https://wordy.example/#play=137');
  });

  it('omits the url field entirely when there is no url to give', () => {
    const p = shareParts({ ...base, url: undefined });
    expect(p.url).toBeUndefined();
    expect(p.text).not.toContain('http');
  });
});

describe('theme shelves', () => {
  const file = JSON.parse(
    readFileSync(join(process.cwd(), 'public/data/puzzles.json'), 'utf8')
  ) as PuzzleFile;

  it('puts every theme on a shelf, so none can hide from the picker', () => {
    // A theme missing from the lookup table must fall to Elsewhere rather than
    // disappear. Content vanishing because a map was not updated is the worst
    // possible failure mode for a browse screen.
    const shelved = themeShelves(file).flatMap((s) => s.themes.map((t) => t.id));
    const all = themeGroups(file).map((t) => t.id);
    expect(shelved.slice().sort()).toEqual(all.slice().sort());
  });

  it('is four shelves, which is the number Grandmother agreed to scan', () => {
    const shelves = themeShelves(file);
    expect(shelves.length).toBeLessThanOrEqual(5);
    expect(shelves.every((s) => s.themes.length > 0)).toBe(true);
    expect(shelves.map((s) => s.name)).toContain('The Table');
    expect(shelves.map((s) => s.name)).toContain('The Soundtrack');
  });

  it('never shows an empty shelf', () => {
    // An empty group is a promise of content that is not there.
    for (const s of themeShelves(file)) expect(s.themes.length).toBeGreaterThan(0);
  });
});

describe('the daily never serves a general pack', () => {
  const file = JSON.parse(
    readFileSync(join(process.cwd(), 'public/data/puzzles.json'), 'utf8')
  ) as PuzzleFile;

  it('treats an unlisted theme as cultural, so forgetting the list cannot demote a pack', () => {
    // Listing the GENERAL themes rather than the cultural ones is deliberate:
    // a new pack added without touching that set defaults into the daily.
    expect(isDailyEligible('some-brand-new-theme')).toBe(true);
    expect(isDailyEligible(null)).toBe(true);
    expect(isDailyEligible('garden')).toBe(false);
    expect(isDailyEligible('roadtrip')).toBe(false);
  });

  it('keeps every daily-eligible board inside the head of the array', () => {
    /*
     * `dailyPoolSize` seeds the daily by indexing the HEAD of the array, so a
     * general board landing inside that head would put The Garden in the daily
     * rotation — silently, on one day in N, months later. The board made this a
     * hard requirement, not a preference: it is the condition on which their
     * highest-paying seat is retained.
     */
    const pool = dailyPoolSize(file);
    for (let i = 0; i < pool; i += 1) {
      expect(file.puzzles[i].theme, `board ${i} is inside the daily pool`).toBeTruthy();
      expect(isDailyEligible(file.puzzles[i].theme?.id), `board ${i} (${file.puzzles[i].base})`).toBe(true);
    }
  });

  it('counts the daily pool as the cultural boards only', () => {
    const cultural = file.puzzles.filter((p) => p.theme && isDailyEligible(p.theme.id)).length;
    expect(dailyPoolSize(file)).toBe(cultural);
  });
});

describe('completionStats', () => {
  const base = { score: 23, bonus: 0, streak: 0, warmup: null, warmupTotal: 2 };

  /*
   * The finding this exists for: the first success a new player sees read
   * `23 / 0 / 0`, and Streak is zero by definition on a first clear.
   */
  it('never shows a zero on a first clear', () => {
    const stats = completionStats({ ...base, warmup: 1 });
    expect(stats.map((s) => s.value)).not.toContain('0');
  });

  it('fills the gap on a first warm-up clear with what IS true', () => {
    expect(completionStats({ ...base, warmup: 1 })).toEqual([
      { label: 'Score', value: '23' },
      { label: 'Warm-up', value: '1/2' },
    ]);
  });

  it('shows Score alone rather than padding it with zeros', () => {
    expect(completionStats(base)).toEqual([{ label: 'Score', value: '23' }]);
  });

  it('brings Bonus back the moment there is one', () => {
    const stats = completionStats({ ...base, bonus: 3 });
    expect(stats).toContainEqual({ label: 'Bonus', value: '3' });
  });

  /*
   * A streak of 1 is not a streak, it is today. The rail draws this same line
   * ("Play tomorrow to start a streak") and the two must not disagree.
   */
  it.each([0, 1])('hides a streak of %i, which is not yet a streak', (streak) => {
    const labels = completionStats({ ...base, streak }).map((s) => s.label);
    expect(labels).not.toContain('Streak');
  });

  it('shows a streak once it outlives a single day', () => {
    const stats = completionStats({ ...base, streak: 2 });
    expect(stats).toContainEqual({ label: 'Streak', value: '2' });
  });

  /*
   * The sheet's grid is three wide. A fourth tile wraps alone onto a second
   * row, which reads as a bug rather than as more information.
   */
  it('never exceeds the three the grid can hold', () => {
    const full = completionStats({ score: 31, bonus: 4, streak: 9, warmup: 1, warmupTotal: 2 });
    expect(full).toHaveLength(3);
    expect(full.map((s) => s.label)).toEqual(['Score', 'Bonus', 'Streak']);
  });

  it('drops warm-up progress rather than a real result', () => {
    const stats = completionStats({ ...base, bonus: 2, streak: 5, warmup: 1 });
    expect(stats.map((s) => s.label)).not.toContain('Warm-up');
  });
});
