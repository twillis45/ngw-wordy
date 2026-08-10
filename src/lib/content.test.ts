/**
 * Content safety — the shipped puzzle data must contain no blocked word.
 *
 * This exists because the generated set DID ship slurs: `spic`, `dago`,
 * `chink` and `rape` were all scoring words with dictionary definitions
 * attached, on a game whose themed packs are The Cookout, HBCU and Barbershop.
 * ENABLE1 is a Scrabble list, and Scrabble-legal is not publishable.
 *
 * Asserting against the BUILT artifact rather than the generator is the point:
 * a regression can arrive from a wordlist swap, a themes.json edit, or someone
 * regenerating with an older script, and only the shipped file catches all
 * three.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { BLOCKLIST, SLUR_LIST, isBlocked } from '../../scripts/lib/blocklist.mjs';

type Puzzle = {
  theme?: { name: string } | null;
  grid: string[];
  bonus: string[];
  base: string;
  letters: string[];
  clues: Record<string, string>;
  unlockOrder?: string[];
};

const file = JSON.parse(
  readFileSync(
    path.join(process.cwd(), 'public', 'data', 'puzzles.json'),
    'utf8'
  )
) as { puzzles: Puzzle[] };

/** Every word the player can ever see or score, from every field. */
function shippedWords(p: Puzzle): string[] {
  return [
    p.base,
    ...(p.grid ?? []),
    ...(p.bonus ?? []),
    ...(p.unlockOrder ?? []),
    ...Object.keys(p.clues ?? {}),
  ];
}

const popular = new Set(
  readFileSync(path.join(process.cwd(), 'data', 'popular.txt'), 'utf8')
    .split('\n')
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean)
);

/**
 * Quality floors.
 *
 * The generator produced VALID puzzles, not good ones: 72 of 240 boards had
 * under half their rows in common use and three had NONE — one shipped
 * `burse` / `druse` / `dures`, the last clued from a German musical term.
 * That is not a hard puzzle, it is an unanswerable one, and "difficulty" was
 * quietly labelling it as the former.
 */
describe('puzzle quality floors', () => {
  const common = (p: Puzzle) => p.grid.filter((w) => popular.has(w)).length;

  it('never ships a board with under half its rows in common use', () => {
    const bad = file.puzzles
      .filter((p) => common(p) / p.grid.length < 0.5)
      .map((p) => `${p.base}: ${common(p)}/${p.grid.length}`);
    expect(bad).toEqual([]);
  });

  it('never ships a GENERATED board whose base word nobody has met', () => {
    /*
     * Themed boards are exempt on purpose. popular.txt is a frequency list,
     * not a judgement — `sauced`, `spiced` and `cameos` are all plainly known
     * words that simply are not on it, and an editor who chose a base knows
     * more about the board than a word-frequency table does.
     */
    const bad = file.puzzles
      .filter((p) => !p.theme && !popular.has(p.base))
      .map((p) => p.base);
    expect(bad).toEqual([]);
  });

  it('keeps the themed catalogue deep enough to read as packs', () => {
    // The board's floor: a theme under 4 puzzles is a demo, not a set.
    const byTheme = new Map<string, number>();
    for (const p of file.puzzles) {
      if (p.theme) byTheme.set(p.theme.name, (byTheme.get(p.theme.name) ?? 0) + 1);
    }
    const themed = [...byTheme.values()].reduce((a, b) => a + b, 0);
    expect(themed, 'themed puzzles shipped').toBeGreaterThanOrEqual(50);
  });

  it('keeps the grid mostly answerable — 4 of 6 rows, on average better', () => {
    const avg =
      file.puzzles.reduce((s, p) => s + common(p), 0) / file.puzzles.length;
    expect(avg).toBeGreaterThan(4);
  });

  it('keeps the answer count in a band, so a rank costs a similar effort daily', () => {
    // Authored themed boards are deliberately exempt from the tight band.
    const generated = file.puzzles.filter((p) => !p.theme);
    for (const p of generated) {
      const n = p.grid.length + p.bonus.length;
      expect(n, `${p.base} has ${n} answers`).toBeGreaterThanOrEqual(30);
      expect(n, `${p.base} has ${n} answers`).toBeLessThanOrEqual(70);
    }
  });
});

describe('shipped puzzle content', () => {
  it('ships a non-trivial number of puzzles (guards a broken build)', () => {
    expect(file.puzzles.length).toBeGreaterThan(100);
  });

  it('contains no blocked word in any scoreable field', () => {
    const found = new Map<string, number>();
    for (const p of file.puzzles) {
      for (const w of shippedWords(p)) {
        if (isBlocked(w)) found.set(w, (found.get(w) ?? 0) + 1);
      }
    }
    expect(
      Object.fromEntries(found),
      `blocked words present in public/data/puzzles.json — regenerate with \`npm run puzzles\``
    ).toEqual({});
  });

  it('contains no slur anywhere in clue TEXT either', () => {
    // A clue is prose, so match on word boundaries rather than substring —
    // otherwise legitimate words containing a blocked substring would trip it.
    const offenders: string[] = [];
    for (const p of file.puzzles) {
      for (const [word, clue] of Object.entries(p.clues ?? {})) {
        const tokens = String(clue).toLowerCase().match(/[a-z]+/g) ?? [];
        for (const t of tokens) {
          if (SLUR_LIST.includes(t)) offenders.push(`${word}: "${clue}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('blocklist itself is sane — covers the words that actually shipped', () => {
    for (const w of ['spic', 'dago', 'chink', 'rape', 'anus', 'arse', 'shit']) {
      expect(isBlocked(w), `${w} must be blocked`).toBe(true);
    }
    // And must NOT over-reach into ordinary vocabulary.
    for (const w of ['hell', 'damn', 'class', 'shell', 'grass', 'scunner']) {
      expect(isBlocked(w), `${w} must NOT be blocked`).toBe(false);
    }
    expect(BLOCKLIST.size).toBeGreaterThan(100);
  });
});

/**
 * Defects that shipped past this suite once, and must not again.
 */
describe('regressions', () => {
  it('never ships two puzzles built on the same letters', () => {
    /*
     * A base is only ever six letters on a dial, so anagrams are the same
     * puzzle wearing a different name. Authoring produced mantle / mantel /
     * mental / lament as four separate boards, sacred / scared as two, and
     * pagers / grapes as two — six wasted boards, each caught only after its
     * clues were written.
     */
    const byLetters = new Map<string, string[]>();
    for (const p of file.puzzles) {
      const key = [...p.base].sort().join('');
      byLetters.set(key, [...(byLetters.get(key) ?? []), p.base]);
    }
    const clashes = [...byLetters.values()].filter((v) => v.length > 1);
    expect(clashes, `same wheel twice: ${JSON.stringify(clashes)}`).toEqual([]);
  });

  it('never ships a clue that stops before it says what the word is', () => {
    /*
     * 44 of 984 generated clues once ended on a function word, because the
     * gloss lost its object upstream: "hanged as a spy by the.", "The basic
     * unit of money in." Unanswerable, and they read as breakage rather than
     * difficulty.
     */
    const dangling =
      /\b(by|of|the|a|an|in|on|to|for|with|and|or|from|that|which|as|at|is|was|were|into|upon|than)\s*\.?\s*$/i;
    const bad: string[] = [];
    for (const p of file.puzzles) {
      for (const [word, clue] of Object.entries(p.clues ?? {})) {
        if (!p.theme && dangling.test(clue)) bad.push(`${word}: ${clue}`);
      }
    }
    expect(bad.slice(0, 5), `${bad.length} truncated clues`).toEqual([]);
  });

  it('never lets an authored clue contain its own answer', () => {
    /*
     * Authored clues bypass redactAnswer entirely — they are trusted as
     * written — so the only thing standing between a typo and a board that
     * gives itself away is this check.
     */
    const leaks: string[] = [];
    for (const p of file.puzzles) {
      if (!p.theme) continue;
      for (const [word, clue] of Object.entries(p.clues ?? {})) {
        const stem = word.slice(0, 4);
        if (stem.length >= 3 && new RegExp(stem, 'i').test(clue)) {
          leaks.push(`${p.base}/${word}: ${clue}`);
        }
      }
    }
    expect(leaks.slice(0, 5), `${leaks.length} clues leak their answer`).toEqual([]);
  });
});
