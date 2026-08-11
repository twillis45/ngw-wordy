/**
 * Validate a staged pack against every rule the build and the bench impose,
 * before it is merged. Two packs in, three of my own errors had reached the
 * merge step — a seven-letter base, a three-word clue, a row whose letters the
 * base could not spell — and each was cheaper to catch here than after.
 *
 *   node scripts/check-pack.mjs data/packs/church.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isBlocked } from './lib/blocklist.mjs';
import { isUsableClue, redactAnswer } from './lib/defs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/check-pack.mjs <pack.json>');
  process.exit(1);
}

const pack = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
const enable = new Set(read('data/enable1.txt').split('\n').map((w) => w.trim()));
const popular = new Set(read('data/popular.txt').split('\n').map((w) => w.trim()));
const themes = JSON.parse(read('data/themes.json'));
const vocabFile = JSON.parse(read('data/theme-vocab.json'));
const toneDeny = new Set(
  read('data/base-tone-deny.txt')
    .split('\n')
    .map((l) => l.replace(/#.*$/, '').trim())
    .filter(Boolean)
);

const id = pack.theme.id;
const entry = vocabFile[id] ?? {};
const tierWords = (name) => new Set(String(entry[name] ?? '').split(/\s+/).filter(Boolean));
const named = new Set([...tierWords('named'), ...tierWords('acts')]);
const said = new Set([...tierWords('said'), ...tierWords('titles')]);

const distinct = (w) => new Set(w).size === w.length;
const letterKey = (w) => [...w].sort().join('');
/** Boards elsewhere in the catalogue, so a taken base is reported, not silent. */
const claimed = new Map(
  themes.puzzles.filter((p) => p.theme !== id).map((p) => [letterKey(p.base), p.theme])
);

let failures = 0;
const freq = {};
const seenSets = new Map();

for (const b of pack.boards) {
  const errs = [];
  const rows = Object.keys(b.clues).filter((w) => w !== b.base);
  const set = new Set(b.base);

  if (b.base.length !== 6) errs.push(`base is ${b.base.length} letters, must be 6`);
  if (!distinct(b.base)) errs.push('base repeats a letter');
  if (!enable.has(b.base)) errs.push('base is not in ENABLE1');
  if (!popular.has(b.base)) errs.push('base is not a common word');
  if (isBlocked(b.base)) errs.push('base is blocked');
  if (toneDeny.has(b.base)) errs.push('base is tone-denied as a prize word');
  if (!b.scene) errs.push('no scene — the board has no title');
  if (rows.length !== 5) errs.push(`${rows.length} rows, must be 5`);
  if (!b.clues[b.base]) errs.push('the base itself has no clue');

  for (const w of rows) {
    if (!distinct(w)) errs.push(`${w}: repeats a letter`);
    else if (![...w].every((c) => set.has(c))) errs.push(`${w}: not spellable from ${b.base}`);
    else if (!enable.has(w)) errs.push(`${w}: not in ENABLE1`);
    else if (!popular.has(w)) errs.push(`${w}: too rare`);
    else if (isBlocked(w)) errs.push(`${w}: blocked`);
    freq[w] = (freq[w] ?? 0) + 1;
  }

  for (const [w, c] of Object.entries(b.clues)) {
    if (!isUsableClue(redactAnswer(c, w))) errs.push(`${w}: clue rejected by the build`);
    if (c.toLowerCase().includes(w.toLowerCase())) errs.push(`${w}: clue contains its own answer`);
  }

  // The bench's bar: one row the player recognises, one the theme says.
  const n = rows.filter((w) => named.has(w)).length;
  const s = rows.filter((w) => said.has(w)).length;
  if (n < 1) errs.push('no `named` row — the board has no reason to exist');
  if (s < 1) errs.push('no `said` row');

  // A base is six letters on a dial, so anagrams are the same puzzle.
  const k = letterKey(b.base);
  if (seenSets.has(k)) errs.push(`same letter-set as ${seenSets.get(k)} in this pack`);
  seenSets.set(k, b.base);
  const owner = claimed.get(k);

  if (errs.length) {
    failures += 1;
    console.log(`FAIL ${b.base.toUpperCase()}`);
    for (const e of errs) console.log(`       ${e}`);
  } else {
    console.log(
      ` ok  ${b.base.toUpperCase().padEnd(8)} ${n + s}/5 on-theme` +
        (owner ? `   (takes the letter-set from ${owner})` : '')
    );
  }
}

const over = Object.entries(freq).filter(([, n]) => n > 3);
if (over.length) {
  failures += 1;
  console.log(`\nFAIL row words over the frequency cap: ${over.map(([w, n]) => `${w} x${n}`).join(', ')}`);
}

console.log(`\n${pack.boards.length} boards, ${failures} problem(s)`);
process.exit(failures ? 1 : 0);
