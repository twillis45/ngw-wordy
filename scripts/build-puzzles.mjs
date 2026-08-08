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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const WORDLIST = path.join(ROOT, 'data', 'enable1.txt');
const DICT = path.join(ROOT, 'data', 'webster.json');
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
  return isUsableClue(clue) ? clue : null;
}

const raw = fs.readFileSync(WORDLIST, 'utf8').split('\n');
const words = [];
for (const line of raw) {
  const w = line.trim().toLowerCase();
  if (w.length < MIN_LEN || w.length > WHEEL) continue;
  if (!/^[a-z]+$/.test(w)) continue;
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
  bases.push(group[0]);
}
bases.sort();

const rand = mulberry32(20260808);
// Fisher-Yates with the seeded PRNG — stable order across runs.
for (let i = bases.length - 1; i > 0; i -= 1) {
  const j = Math.floor(rand() * (i + 1));
  [bases[i], bases[j]] = [bases[j], bases[i]];
}

const puzzles = [];
const seenSignatures = new Set();

for (const base of bases) {
  if (puzzles.length >= COUNT) break;
  const sig = letterKey(base);
  if (seenSignatures.has(sig)) continue;

  const letters = base.split('');
  const answers = solve(letters);
  if (answers.length < MIN_ANSWERS || answers.length > MAX_ANSWERS) continue;

  seenSignatures.add(sig);

  // The base must be cluable or the puzzle's centrepiece has no clue.
  const baseClue = clueFor(base);
  if (!baseClue) continue;

  // Grid = base plus the longest answers that can carry a clue. Falls back to
  // uncluable words only if there aren't enough, and those puzzles are dropped.
  const rest = answers.filter((w) => w !== base);
  const clues = { [base]: baseClue };
  const grid = [base];
  // No two rows may pose the same question.
  const usedClues = new Set([clueKey(baseClue)]);
  for (const w of rest) {
    if (grid.length >= GRID_MAX) break;
    const c = clueFor(w);
    if (!c) continue;
    const k = clueKey(c);
    if (usedClues.has(k)) continue;
    usedClues.add(k);
    clues[w] = c;
    grid.push(w);
  }
  if (grid.length < GRID_MAX) continue;
  const gridSet = new Set(grid);
  const bonus = answers.filter((w) => !gridSet.has(w));

  const maxScore = answers.reduce((sum, w) => sum + scoreWord(w), 0);
  const ordered = grid.sort((a, b) => b.length - a.length || a.localeCompare(b));

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

  puzzles.push({
    id: puzzles.length + 1,
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

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ version: 1, wheel: WHEEL, puzzles }));

const bytes = fs.statSync(OUT).size;
const avg =
  puzzles.reduce((s, p) => s + p.grid.length + p.bonus.length, 0) /
  (puzzles.length || 1);

console.log(
  `Wrote ${puzzles.length} puzzles -> ${OUT}\n` +
    `  ${(bytes / 1024).toFixed(0)} KB · avg ${avg.toFixed(1)} answers/puzzle`
);
