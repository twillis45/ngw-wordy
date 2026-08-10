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
import { BLOCKLIST, SLUR_LIST, containsSlur, isBlocked } from '../../scripts/lib/blocklist.mjs';

type Puzzle = {
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
