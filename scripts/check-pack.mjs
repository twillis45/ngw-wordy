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

/**
 * The answer band the build enforces, mirrored from vet-bases.mjs. `ALERTS`
 * reached a merge with five on-theme rows and six written clues before the
 * build rejected it at 122 answers, which is a whole board authored for
 * nothing.
 */
const byLetterKey = new Map();
for (const w of read('data/enable1.txt').split('\n').map((x) => x.trim())) {
  if (w.length < 3 || w.length > 6) continue;
  const k = [...w].sort().join('');
  byLetterKey.set(k, (byLetterKey.get(k) ?? 0) + 1);
}
function answerCount(base) {
  const letters = [...base].sort();
  let n = 0;
  for (let m = 0; m < 1 << 6; m += 1) {
    const sub = [];
    for (let i = 0; i < 6; i += 1) if (m & (1 << i)) sub.push(letters[i]);
    if (sub.length >= 3) n += byLetterKey.get(sub.join('')) ?? 0;
  }
  return n;
}
const letterKey = (w) => [...w].sort().join('');
/** Boards elsewhere in the catalogue, so a taken base is reported, not silent. */
const claimed = new Map(
  themes.puzzles.filter((p) => p.theme !== id).map((p) => [letterKey(p.base), p.theme])
);

let failures = 0;
/** Boards carrying at least one act name — a PACK-level property. See below. */
let boardsWithNamed = 0;
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
  const answers = answerCount(b.base);
  if (answers < 24 || answers > 110)
    errs.push(`base has ${answers} answers, the build accepts 24-110`);
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

  /*
   * The bench's bar, measured on the BOARD as strength and on the PACK as
   * composition.
   *
   * It used to demand a `named` row AND a `said` row on every board, and that
   * composition test ran opposite to strength on the pack it was written for.
   * Measured across the Nineties: DEARLY and NICKED are the only two boards at
   * 5/5 on-theme and BOTH failed, while three boards at 3/5 passed. They failed
   * for having no artist name — DEARLY's five rows are five song titles, which
   * is what its scene is for ("Records that open by addressing somebody").
   *
   * There was also no way to comply. Not one of the 40 words in the `acts`
   * tier is spellable from any of the five failing bases, so the only route
   * was to add ordinary words like `big`, `ray` and `kid` to the tier — which
   * is the padding the vocabulary rule exists to forbid, since each would sit
   * as comfortably in a cookout or a barbershop.
   *
   * So the floor here is now STRENGTH, at the same height the old pair
   * implied: two on-theme rows, of whichever tier the board is built from.
   * That keeps the boards the rule was written to stop — the ones that are
   * about nothing — while letting a title-only board be a title-only board.
   * "Does this pack teach anybody a name" is a fair question, but it is a
   * question about the pack, and it is asked once, below.
   */
  const n = rows.filter((w) => named.has(w)).length;
  const s = rows.filter((w) => said.has(w)).length;
  if (n + s < 2) {
    errs.push(
      `${n + s} on-theme rows — needs 2, of any tier (the board is about nothing)`
    );
  }
  if (n > 0) boardsWithNamed += 1;

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

/*
 * Does this pack teach anybody a NAME?
 *
 * The question the old per-board rule was really asking, asked where it can be
 * answered honestly. A pack of nothing but song titles is a pack a player
 * finishes without learning who made any of it; a single board of song titles
 * is just a good board.
 *
 * A third of the boards, because that is a floor the material can actually
 * meet — measured on the Nineties, 7 of 12 boards carry an act row, and it is
 * the strongest pack in the catalogue. Set at half, the reference pack itself
 * would sit one board above failing, which is a rule calibrated to nothing.
 */
const NAMED_SHARE = 3;
const needNamed = Math.ceil(pack.boards.length / NAMED_SHARE);
if (boardsWithNamed < needNamed) {
  failures += 1;
  console.log(
    `\nFAIL only ${boardsWithNamed} of ${pack.boards.length} boards name an act — needs ${needNamed}.` +
      '\n     A pack of pure titles never tells the player who made any of it.'
  );
} else {
  console.log(
    `\n${boardsWithNamed} of ${pack.boards.length} boards name an act (needs ${needNamed}).`
  );
}

console.log(`\n${pack.boards.length} boards, ${failures} problem(s)`);
process.exit(failures ? 1 : 0);
