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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const WORDLIST = path.join(ROOT, 'data', 'enable1.txt');
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

  // Grid = the base word plus the next-longest answers, capped.
  const rest = answers.filter((w) => w !== base);
  const grid = [base, ...rest.slice(0, GRID_MAX - 1)];
  const gridSet = new Set(grid);
  const bonus = answers.filter((w) => !gridSet.has(w));

  const maxScore = answers.reduce((sum, w) => sum + scoreWord(w), 0);

  puzzles.push({
    id: puzzles.length + 1,
    letters: letters.sort(),
    base,
    grid: grid.sort((a, b) => b.length - a.length || a.localeCompare(b)),
    bonus,
    maxScore,
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
