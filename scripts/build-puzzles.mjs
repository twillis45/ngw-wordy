#!/usr/bin/env node
/**
 * Puzzle generator — offline, deterministic.
 *
 * Reads the ENABLE1 word list and emits public/data/puzzles.json:
 * a fixed sequence of puzzles, each fully solved ahead of time.
 *
 * Why precompute: the client never needs a 172k-word dictionary. Each
 * puzzle carries its own complete answer set (~40-90 words), so word
 * validation is an O(1) set lookup with zero network round-trips.
 *
 * Model (Word Cookies / TextTwist hybrid):
 *   • 6 distinct letters, drawn from a 6-letter "base" word
 *   • grid   = up to GRID_MAX target words, always including the base
 *   • bonus  = every other valid word the letters can make
 *
 * Usage: node scripts/build-puzzles.mjs [count]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clueKey,
  clueText,
  defineWord,
  indexSource,
  isUsableClue,
  redactAnswer,
} from './lib/defs.mjs';
import { containsSlur, isBlocked } from './lib/blocklist.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const WORDLIST = path.join(ROOT, 'data', 'enable1.txt');
const POPULAR = path.join(ROOT, 'data', 'popular.txt');
const DICT = path.join(ROOT, 'data', 'webster.json');
const THEMES = path.join(ROOT, 'data', 'themes.json');
const OUT = path.join(ROOT, 'public', 'data', 'puzzles.json');

const MIN_LEN = 3;
const WHEEL = 6;
// 6 target rows is what fits above the wheel on a 375x812 screen without
// scrolling. Everything else the letters can make becomes a bonus word.
const GRID_MAX = 6;
const MIN_ANSWERS = 24; // reject thin puzzles
const MAX_ANSWERS = 110; // reject overwhelming ones
const COUNT = Number(process.argv[2] || 240);

// Deterministic PRNG so a given seed always yields the same puzzle set.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const letterKey = (w) => w.split('').sort().join('');

/*
 * Clue mode promises a clue for EVERY row, so grid selection has to know which
 * words are definable before it picks them. Without this the mode would show
 * blank rows and read as broken on the puzzles that happen to draw obscure
 * words.
 */
const byWord = indexSource(JSON.parse(fs.readFileSync(DICT, 'utf8')));

/** Clue for a word, redacted, or null when it can't carry one. */
function clueFor(word) {
  const entry = defineWord(byWord, word);
  if (!entry) return null;
  const clue = redactAnswer(clueText(entry[0]), word, entry[1]);
  if (!isUsableClue(clue)) return null;
  /*
   * Filtering the ANSWER is not enough — the clue is 1913 prose.
   *
   * Webster's 1913 carries the racial language of its era: `obis` shipped with
   * "sorcery... practiced among the negroes of the", attached to a perfectly
   * innocuous four-letter word. So the word passes every filter and the app
   * prints the slur anyway. Any clue containing a slur token disqualifies the
   * clue, which usually drops the word from the grid rather than the puzzle.
   */
  if (containsSlur(clue)) return null;
  return clue;
}

/*
 * Familiarity, for the difficulty score.
 *
 * ENABLE1 is Scrabble-legal, which is not the same as known. A puzzle can be
 * perfectly valid and still be six rows of words nobody has met — and measuring
 * the set found exactly that: the grid is only 51% common words on average, 64
 * puzzles are under 50%, and some are 0%. That is fine for a regular, and fatal
 * for a first game.
 */
const popular = new Set(
  fs
    .readFileSync(POPULAR, 'utf8')
    .split('\n')
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean)
);

/*
 * Themes are authored, not generated.
 *
 * data/themes.json is merged over the generated set: a theme claims a base
 * word, and any clue written there overrides the Webster one. Anything not
 * overridden falls back, so a theme can ship partially authored.
 *
 * Authored clues go through the SAME validation as generated ones — a
 * hand-written clue that contains its own answer is just as broken as a
 * machine one, and an editor should find that out at build time.
 */
const themeFile = JSON.parse(fs.readFileSync(THEMES, 'utf8'));
const themesById = new Map((themeFile.themes ?? []).map((t) => [t.id, t]));
const authored = new Map(
  (themeFile.puzzles ?? []).map((p) => [p.base.toLowerCase(), p])
);
const themeReport = { applied: 0, clues: 0, rejected: [] };

const raw = fs.readFileSync(WORDLIST, 'utf8').split('\n');
const words = [];
let blockedCount = 0;
for (const line of raw) {
  const w = line.trim().toLowerCase();
  if (w.length < MIN_LEN || w.length > WHEEL) continue;
  if (!/^[a-z]+$/.test(w)) continue;
  /*
   * Scrabble-legal is not publishable.
   *
   * The shipped set contained `spic`, `dago`, `chink` and `rape` as SCORING
   * words, each with a dictionary definition attached. Filtering HERE rather
   * than at grid/bonus selection is deliberate: every consumer downstream —
   * grid, bonus, maxScore, unlockOrder, the definition bundle — reads this one
   * array, so a blocked word cannot reach any of them by any path.
   */
  if (isBlocked(w)) {
    blockedCount += 1;
    continue;
  }
  words.push(w);
}

// Bucket every word by its sorted-letter signature so subset checks are cheap.
const bySignature = new Map();
for (const w of words) {
  const k = letterKey(w);
  if (!bySignature.has(k)) bySignature.set(k, []);
  bySignature.get(k).push(w);
}

/** Can `word` be spelled from the multiset `pool`? */
function formable(word, pool) {
  const avail = { ...pool };
  for (const ch of word) {
    if (!avail[ch]) return false;
    avail[ch] -= 1;
  }
  return true;
}

const counts = (letters) =>
  letters.reduce((acc, ch) => ((acc[ch] = (acc[ch] || 0) + 1), acc), {});

/** Every dictionary word formable from these 6 letters, longest first. */
function solve(letters) {
  const pool = counts(letters);
  const set = new Set(letters);
  const out = [];
  for (const w of words) {
    // fast reject: any letter outside the wheel
    let ok = true;
    for (const ch of w) {
      if (!set.has(ch)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    if (formable(w, pool)) out.push(w);
  }
  out.sort((a, b) => b.length - a.length || a.localeCompare(b));
  return out;
}

/**
 * Spelling Bee scoring, adapted:
 *   3 letters -> 1pt, 4+ -> length, full-wheel word -> +WHEEL bonus.
 */
export function scoreWord(word, wheelSize = WHEEL) {
  const base = word.length === 3 ? 1 : word.length;
  return base + (word.length === wheelSize ? wheelSize : 0);
}

// Candidate bases: 6-letter words with 6 distinct letters, no more than
// two of {j,q,x,z,v,w,k} so the wheel stays solvable-feeling.
const RARE = new Set(['j', 'q', 'x', 'z', 'v', 'w', 'k']);
const bases = [];
for (const [sig, group] of bySignature) {
  if (sig.length !== WHEEL) continue;
  if (new Set(sig).size !== WHEEL) continue;
  let rare = 0;
  for (const ch of sig) if (RARE.has(ch)) rare += 1;
  if (rare > 1) continue;

  /*
   * One base per letter-set, and an authored word wins the slot.
   *
   * The representative used to be whichever word sorted first, which quietly
   * defeats themes: "sauced" is an anagram of "caused", so claiming it got
   * "cannot be a base word" even though it is a perfectly valid six-distinct
   * letter word. The letters are identical, so honouring the editor's choice
   * costs nothing — it only changes which spelling is the target.
   */
  bases.push(group.find((w) => authored.has(w)) ?? group[0]);
}
bases.sort();

const rand = mulberry32(20260808);
// Fisher-Yates with the seeded PRNG — stable order across runs.
for (let i = bases.length - 1; i > 0; i -= 1) {
  const j = Math.floor(rand() * (i + 1));
  [bases[i], bases[j]] = [bases[j], bases[i]];
}

/*
 * Authored base words go FIRST.
 *
 * Without this a theme is a lottery ticket: the set is a seeded shuffle of
 * ~4000 candidates truncated at 240, so a word an editor claimed almost never
 * survives. Measured against a list of real theme candidates, zero of the 24
 * mechanically-valid ones were in the generated set — the container worked and
 * could never actually be used.
 *
 * Claimed words that fail generation (too few answers, no usable clue) simply
 * fall through to the normal order and are reported, so an editor finds out.
 */
const claimed = bases.filter((b) => authored.has(b));
const claimedSet = new Set(claimed);
bases.splice(0, bases.length, ...claimed, ...bases.filter((b) => !claimedSet.has(b)));

// Anything an editor asked for that can never be a base at all.
for (const base of authored.keys()) {
  if (!bases.includes(base)) {
    themeReport.rejected.push(
      `${base}: cannot be a base word (needs 6 distinct letters and must be in the word list)`
    );
  }
}

const puzzles = [];
const seenSignatures = new Set();

for (const base of bases) {
  if (puzzles.length >= COUNT) {
    if (authored.has(base)) {
      themeReport.rejected.push(`${base}: set was already full at ${COUNT}`);
    }
    continue;
  }
  const sig = letterKey(base);
  if (seenSignatures.has(sig)) {
    if (authored.has(base)) {
      themeReport.rejected.push(`${base}: another puzzle already uses these letters`);
    }
    continue;
  }

  const isClaimed = authored.has(base);
  const drop = (why) => {
    if (isClaimed) themeReport.rejected.push(`${base}: ${why}`);
  };

  const letters = base.split('');
  const answers = solve(letters);
  if (answers.length < MIN_ANSWERS || answers.length > MAX_ANSWERS) {
    drop(
      `${answers.length} answers — needs ${MIN_ANSWERS}-${MAX_ANSWERS}`
    );
    continue;
  }

  seenSignatures.add(sig);

  // The base must be cluable or the puzzle's centrepiece has no clue.
  /*
   * A themed puzzle may supply its own base clue.
   *
   * Requiring a Webster clue for the base excluded exactly the words a modern
   * theme needs — SITCOM, SAMPLE, ALUMNI, SHAVED all failed, and Webster 1913
   * cannot define "sitcom" because the word did not exist. If an editor has
   * written the clue, the dictionary has no say.
   */
  const authoredBaseClue = authored.get(base)?.clues?.[base];
  const baseClue = clueFor(base) ?? (authoredBaseClue ? '' : null);
  if (baseClue === null) {
    drop('no dictionary clue for the base word, and none authored');
    continue;
  }

  // Grid = base plus the longest answers that can carry a clue. Falls back to
  // uncluable words only if there aren't enough, and those puzzles are dropped.
  /*
   * Themed puzzles prefer FAMILIAR rows.
   *
   * Grid selection takes the longest cluable words, which is fine for a
   * generic puzzle and wrong for a themed one: the first themed grids came
   * back with rachis, incus, conus and ocas. No cookout clue can carry a word
   * nobody has met, so a claimed puzzle sorts common words to the front and
   * keeps length as the tiebreak.
   */
  /*
   * Row selection for a themed puzzle.
   *
   * Two problems the generator creates on its own: it takes the longest
   * cluable words (rachis, incus, ocas — unusable), and even after preferring
   * common words, half the rows have nothing to do with the theme. CAMPUS came
   * back with cams, cusp and scum, which no HBCU clue can carry.
   *
   * So a theme may list `prefer` — rows the editor wants on the board. They go
   * first when valid; anything missing falls back to common-then-longest, and
   * a preference that can't be honoured is reported rather than dropped.
   */
  const prefer = authored.get(base)?.prefer ?? [];
  const preferRank = new Map(prefer.map((w, i) => [w, i]));
  if (isClaimed) {
    for (const w of prefer) {
      if (!answers.includes(w)) {
        themeReport.rejected.push(
          `${base}/${w}: preferred row is not makeable from these letters`
        );
      }
    }
  }
  const rest = answers
    .filter((w) => w !== base)
    .sort((a, b) => {
      if (!isClaimed) return 0;
      const ra = preferRank.has(a) ? preferRank.get(a) : Infinity;
      const rb = preferRank.has(b) ? preferRank.get(b) : Infinity;
      if (ra !== rb) return ra - rb;
      const pa = popular.has(a) ? 0 : 1;
      const pb = popular.has(b) ? 0 : 1;
      return pa - pb || b.length - a.length || a.localeCompare(b);
    });
  const clues = {};
  if (baseClue) clues[base] = baseClue;
  const grid = [base];
  // No two rows may pose the same question.
  const usedClues = new Set(baseClue ? [clueKey(baseClue)] : []);
  const authoredClues = authored.get(base)?.clues ?? {};
  for (const w of rest) {
    if (grid.length >= GRID_MAX) break;
    /*
     * An authored clue admits a row on its own.
     *
     * Rows were gated on Webster being able to clue them, which quietly threw
     * out exactly the words a theme wants — caps, shave, vocal, sit — even
     * when the editor had already written their clue. Same mistake as the base
     * word, one level down: if a human wrote it, the 1913 dictionary has no
     * vote.
     */
    const c = clueFor(w) ?? (authoredClues[w] ? '' : null);
    if (c === null) continue;
    if (c) {
      const k = clueKey(c);
      if (usedClues.has(k)) continue;
      usedClues.add(k);
      clues[w] = c;
    }
    grid.push(w);
  }
  if (!clues[base] && !authoredBaseClue) {
    drop('base row would have no clue at all');
    continue;
  }
  if (grid.length < GRID_MAX) {
    drop(`only ${grid.length} of ${GRID_MAX} rows could carry a clue`);
    continue;
  }
  const gridSet = new Set(grid);
  const bonus = answers.filter((w) => !gridSet.has(w));

  const maxScore = answers.reduce((sum, w) => sum + scoreWord(w), 0);
  const ordered = grid.sort((a, b) => b.length - a.length || a.localeCompare(b));

  // Overlay any authored theme for this base word.
  let theme = null;
  const authoredEntry = authored.get(base);
  if (authoredEntry) {
    const t = themesById.get(authoredEntry.theme);
    if (!t) {
      themeReport.rejected.push(`${base}: unknown theme "${authoredEntry.theme}"`);
    } else {
      theme = { id: t.id, name: t.name, blurb: t.blurb ?? '' };
      themeReport.applied += 1;
      for (const [word, text] of Object.entries(authoredEntry.clues ?? {})) {
        if (!ordered.includes(word)) {
          themeReport.rejected.push(`${base}/${word}: not a row in this puzzle`);
          continue;
        }
        const cleaned = redactAnswer(text, word);
        if (!isUsableClue(cleaned)) {
          themeReport.rejected.push(`${base}/${word}: clue failed validation`);
          continue;
        }
        clues[word] = cleaned;
        themeReport.clues += 1;
      }
    }
  }

  /*
   * Escalating wheel: the unlock order.
   *
   * Play starts with only the letters of the SHORTEST grid word active, then
   * unlocks the rest one at a time. Derived here rather than at runtime because
   * it has to guarantee the early rows are actually solvable with the letters
   * available — a random unlock order would routinely deal an unsolvable board.
   */
  const shortest = ordered[ordered.length - 1];
  const unlockOrder = [
    ...new Set([...shortest, ...letters]),
  ];
  const startActive = new Set(shortest).size;

  /*
   * Difficulty, 0 (kindest) to 1 (hardest).
   *
   * Weighted toward the GRID, because the grid is what you must clear to
   * finish — bonus obscurity only affects how high you can score, not whether
   * you can succeed. A very large answer set also reads as harder because the
   * board never looks finished.
   */
  const gridCommon =
    ordered.filter((w) => popular.has(w)).length / ordered.length;
  const allWords = [...ordered, ...bonus];
  const poolCommon =
    allWords.filter((w) => popular.has(w)).length / allWords.length;
  const size = Math.min(1, answers.length / MAX_ANSWERS);
  const difficulty = Number(
    (
      (1 - gridCommon) * 0.55 +
      (1 - poolCommon) * 0.2 +
      (popular.has(base) ? 0 : 0.15) +
      size * 0.1
    ).toFixed(4)
  );

  puzzles.push({
    id: puzzles.length + 1,
    difficulty,
    theme,
    letters: letters.sort(),
    base,
    grid: ordered,
    bonus,
    maxScore,
    clues,
    unlockOrder,
    startActive,
  });
}

/*
 * The warm-up ladder.
 *
 * A new player's first game is currently whatever the date happens to land on,
 * which measured at 33% common words — four of six rows obscure. Competitors
 * do not do this: Wordscapes opens on short, common words and ramps, precisely
 * because a first level that reads as impossible is where onboarding dies.
 *
 * So the kindest puzzles are reserved as a starter ladder, ordered easiest
 * first, and excluded from nothing — they remain in the daily rotation too.
 */
const STARTERS = 4;
const starters = puzzles
  .map((p, i) => ({ i, d: p.difficulty }))
  .sort((a, b) => a.d - b.d)
  .slice(0, STARTERS)
  .map((x) => x.i);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify({ version: 2, wheel: WHEEL, starters, puzzles })
);

const bytes = fs.statSync(OUT).size;
const avg =
  puzzles.reduce((s, p) => s + p.grid.length + p.bonus.length, 0) /
  (puzzles.length || 1);

const diffs = puzzles.map((p) => p.difficulty).sort((a, b) => a - b);
const median = diffs[Math.floor(diffs.length / 2)];

console.log(
  `Wrote ${puzzles.length} puzzles -> ${OUT}\n` +
    `  ${blockedCount} blocked words filtered from the wordlist\n` +
    `  ${(bytes / 1024).toFixed(0)} KB · avg ${avg.toFixed(1)} answers/puzzle\n` +
    `  difficulty: ${diffs[0].toFixed(2)} easiest / ${median.toFixed(2)} median /` +
    ` ${diffs[diffs.length - 1].toFixed(2)} hardest\n` +
    `  themes: ${themeReport.applied} puzzles, ${themeReport.clues} authored clues` +
    `${themeReport.rejected.length ? ` · ${themeReport.rejected.length} REJECTED` : ''}\n` +
    `${themeReport.rejected.map((r) => `    - ${r}`).join('\n')}${
      themeReport.rejected.length ? '\n' : ''
    }` +
    `  warm-up ladder: ${starters
      .map((i) => `${puzzles[i].base} (${puzzles[i].difficulty.toFixed(2)})`)
      .join(', ')}`
);
