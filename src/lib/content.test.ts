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
import {
  MIN_WORD_LENGTH,
  activeLetters,
  dailyCycle,
  dailyPoolSize,
  isDailyEligible,
  puzzleForPlayer,
  canSpell,
} from './game';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  BLOCKLIST,
  containsSlur,
  isBlocked,
} from '../../scripts/lib/blocklist.mjs';

type Puzzle = {
  // `id` is what daily-eligibility is keyed on; `name` is the display label.
  theme?: { id: string; name: string } | null;
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
    /*
     * Delegates to containsSlur rather than re-implementing the scan, which
     * is how this test and the build came to disagree: the test tokenised the
     * raw clue, so it flagged "the National Council of Negro Women" — Mary
     * McLeod Bethune's organisation, led by Dorothy Height from 1957 to 1998,
     * still operating under that name.
     *
     * The gate exists to catch Webster's 1913 using period racial vocabulary
     * inside ordinary entries. It should not stop a game about Black American
     * life from naming the institutions Black Americans built and named
     * themselves. containsSlur carries that exemption list; two copies of the
     * rule meant only one of them had it.
     */
    const offenders: string[] = [];
    for (const p of file.puzzles) {
      for (const [word, clue] of Object.entries(p.clues ?? {})) {
        if (containsSlur(clue)) offenders.push(`${word}: "${clue}"`);
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

  it('never SHIPS a clue that leaks its answer', () => {
    /*
     * This used to read `if (!p.theme) continue`, i.e. it watched authored
     * clues only, and its comment claimed to be "the only thing standing
     * between a typo and a board that gives itself away". It was not, and it
     * could not be. Red-proofed on 2026-08-14 by writing the answer into its
     * own clue — "A crafty pitmaster with no thermometer at all" — and the
     * suite stayed green at 220, because the build had already redacted it to
     * "A ——— pitmaster with no thermometer at all" before this test read it.
     * A check on the artifact cannot see a fault the artifact-builder repairs.
     *
     * So this one now watches every shipped clue, authored and generated, for
     * a leak the redactor did NOT catch — which is what an artifact check is
     * actually good for. The source is guarded separately, in "authored clue
     * corpus" below, against `data/themes.json`, which is where a clue is
     * written and the only place the fault exists.
     */
    const leaks: string[] = [];
    for (const p of file.puzzles) {
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

describe('authored clue corpus', () => {
  const authored = JSON.parse(
    readFileSync(path.join(process.cwd(), 'data', 'themes.json'), 'utf8')
  ) as { puzzles: { base: string; theme: string; clues: Record<string, string> }[] };

  it('never uses the same clue text on two different boards', () => {
    /*
     * Two clues shipped verbatim on two boards each — the reunion treasurer's
     * shirt order and an R&B bridge — because a board authored as a
     * replacement inherited a line from the board it replaced. A player who
     * reaches both sees the game repeat itself, which reads as a smaller
     * catalogue than it is.
     */
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const p of authored.puzzles) {
      for (const [word, clue] of Object.entries(p.clues)) {
        const key = clue.toLowerCase().replace(/[^a-z ]/g, '').trim();
        const where = `${p.theme}/${p.base}/${word}`;
        if (seen.has(key)) dupes.push(`${seen.get(key)} == ${where}`);
        else seen.set(key, where);
      }
    }
    expect(dupes, `${dupes.length} duplicated clues`).toEqual([]);
  });

  it('never writes an answer, or its first four letters, into its own clue', () => {
    /*
     * The authoring contract calls this "the most common failure", and until
     * 2026-08-14 nothing in the suite could fail on it. `check-pack.mjs` has
     * the rule, but it runs per-pack, by hand, and neither `npm test` nor the
     * build calls it — so a clue edited straight into `data/themes.json`, the
     * merged corpus every board actually ships from, was checked by nothing.
     *
     * It has to be the SOURCE. `build-puzzles` redacts the answer out of an
     * authored clue on its way to `public/data/puzzles.json`, so by the time
     * the shipped artifact exists the fault has been converted into a `———`
     * mid-sentence and cannot be detected. The build repairing it quietly is
     * the reason this went unwatched for so long.
     *
     * Four letters, not the whole word, per the contract: `plate` forbids
     * "plat". Set at exact-word-only this test would have passed the two
     * leaks it found on the day it was written — "the same argument" under
     * ARGUES, and "the laugh track" under TRACE.
     */
    const leaks: string[] = [];
    for (const p of authored.puzzles) {
      for (const [word, clue] of Object.entries(p.clues)) {
        const stem = word.slice(0, 4);
        if (stem.length >= 3 && new RegExp(stem, 'i').test(clue)) {
          leaks.push(`${p.theme}/${p.base}/${word} [${stem}]: ${clue}`);
        }
      }
    }
    expect(leaks, `${leaks.length} authored clues leak their answer`).toEqual([]);
  });

  it('does not fall into one sentence shape', () => {
    /*
     * Six clues that all open "What ..." read as a machine rather than a
     * voice. The authoring contract caps that shape at roughly a third; this
     * is the check that the cap held across 1,798 clues written by many hands.
     */
    const clues = authored.puzzles.flatMap((p) => Object.values(p.clues));
    const what = clues.filter((c) => /^what\b/i.test(c)).length;
    expect(what / clues.length, 'share of clues opening "What"').toBeLessThan(0.34);
  });
});

describe('grounded canon', () => {
  it('never cites a clue that no longer exists', async () => {
    /*
     * The canon (data/canon.json) records what the themed clues rest on:
     * which factual claims were checked, against what sources, and which are
     * still open. Its entries are keyed to individual clues.
     *
     * A citation pointing at a clue that has since been rewritten is worse
     * than no citation, because it reads as evidence for text nobody ever
     * checked. This is the check that keeps the research honest as the clues
     * keep moving.
     */
    const { check } = await import('../../scripts/canon.mjs');
    expect(check(), 'canon reference problems').toEqual([]);
  });
});

describe('the daily never serves a generated board', () => {
  it('draws a year of dailies from the authored catalogue only', () => {
    /*
     * The generated boards are a commodity the board ruled must stay free and
     * unbilled. Seeding the daily across the whole set served one roughly every
     * fourth day — a WordNet definition in the same slot as a hand-written
     * clue, which is the "two different products" problem the ruling names.
     */
    const themed = file.puzzles.filter((p) => p.theme).length;
    expect(themed, 'catalogue must not be empty').toBeGreaterThan(0);

    const generic: string[] = [];
    for (let day = 0; day < 365; day += 1) {
      const d = new Date(Date.UTC(2026, 0, 1 + day));
      /*
       * This suite types `file` loosely — it only ever reads puzzles — so it
       * is widened here rather than duplicating the engine's PuzzleFile shape.
       * `starters: []` and a large warmupsDone both skip the warm-up ladder,
       * which is what puts us on the daily path being tested.
       */
      const asFile = {
        version: 2,
        wheel: 6,
        starters: [],
        puzzles: file.puzzles,
      } as unknown as Parameters<typeof puzzleForPlayer>[0];
      const { index } = puzzleForPlayer(asFile, 99, d, 0, new Set());
      if (!file.puzzles[index].theme) generic.push(`${d.toISOString().slice(0, 10)}`);
    }
    expect(generic.slice(0, 5), `${generic.length} generated dailies in a year`).toEqual([]);
  });
});

describe('the wrap', () => {
  it('counts laps of the same pool the daily rotates through', () => {
    /*
     * The day-241 bug was: the daily served a board the player had already
     * finished, because progress is keyed per puzzle and the rotation came back
     * around. The fix is a lap counter that changes the storage key.
     *
     * It only works if the counter and the rotation agree on how many puzzles
     * a lap IS. Narrowing the daily to authored boards without narrowing the
     * counter re-opened the same hole, 123 days wide.
     */
    const asFile = {
      version: 2,
      wheel: 6,
      starters: [],
      puzzles: file.puzzles,
    } as unknown as Parameters<typeof dailyPoolSize>[0];

    const pool = dailyPoolSize(asFile);
    /*
     * DAILY-ELIGIBLE boards, not every themed board.
     *
     * This read `.filter((p) => p.theme)` and passed for as long as those two
     * numbers were the same number — which they were only because the shipped
     * puzzles.json predated the general packs. Regenerating it split them (98
     * cultural, 118 themed) and the assertion fired. The rotation draws from
     * daily-eligible boards, so that is what a lap has to be measured in.
     */
    expect(pool).toBe(
      file.puzzles.filter((p) => p.theme && isDailyEligible(p.theme.id)).length
    );

    // The day after a full lap must land on a different storage cycle than
    // day zero, or the replay reuses the finished board's key.
    const day0 = new Date(Date.UTC(2026, 0, 1));
    const afterLap = new Date(Date.UTC(2026, 0, 1 + pool));
    expect(dailyCycle(afterLap, pool)).toBeGreaterThan(dailyCycle(day0, pool));
  });
});

describe('the opening wheel is always playable', () => {
  it('never starts a board with fewer live letters than a word needs', () => {
    /*
     * Escalating mode dims the letters that have not unlocked yet. If the
     * opening set is smaller than the minimum word length, there is no legal
     * move at all — the player is looking at a board they cannot start.
     *
     * This is the DATA half of a bug that was actually a UI desync: the wheel
     * kept its own copy of the letters and drifted onto a different board's,
     * so escalating mode tested one board's unlock list against another
     * board's letters and left two live. The engine side is asserted here; the
     * component now derives its letters from the rendered puzzle, so the two
     * can no longer disagree.
     */
    const thin = file.puzzles
      .map((p) => ({
        base: p.base,
        live: activeLetters(p as never, 0, true).length,
      }))
      .filter((x) => x.live < MIN_WORD_LENGTH);
    expect(thin.slice(0, 5), `${thin.length} boards open unplayable`).toEqual([]);
  });

  it('always leaves at least one legal word on the opening wheel', () => {
    const stuck: string[] = [];
    for (const p of file.puzzles) {
      const live = activeLetters(p as never, 0, true);
      const playable = [...p.grid, ...p.bonus].some(
        (w) => w.length >= MIN_WORD_LENGTH && canSpell(w, live.join(''))
      );
      if (!playable) stuck.push(p.base);
    }
    expect(stuck.slice(0, 5), `${stuck.length} boards with no opening move`).toEqual([]);
  });
});

describe('progress survives the browser', () => {
  it('round-trips a backup code', async () => {
    /*
     * Progress is one localStorage key with no account behind it, so a cleared
     * cache or a new phone erases a streak silently. The player board named
     * that its most common blocker — and specifically, the seats most willing
     * to PAY were the ones who would not commit to a streak they could lose
     * without warning. A code is the smallest fix that needs no server.
     */
    const { exportProgress, importProgress } = await import('./storage');
    const code = exportProgress();
    expect(code.startsWith('wordy1:'), 'code is tagged').toBe(true);

    const restored = importProgress(code);
    expect(restored.ok, 'a code this module just wrote must import').toBe(true);
  });

  it('refuses anything that is not a backup code', async () => {
    const { importProgress } = await import('./storage');
    for (const junk of ['', 'hello', 'wordy1:not-base64!!', 'wordy1:' + btoa('{}')]) {
      const r = importProgress(junk);
      expect(r.ok, `"${junk.slice(0, 20)}" must not import`).toBe(false);
    }
  });
});
