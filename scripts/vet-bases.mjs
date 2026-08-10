#!/usr/bin/env node
/**
 * Base vetting — run this BEFORE authoring clues, not after.
 *
 * Authoring a themed pack means picking a 6-letter base and writing six clues
 * for it. The expensive failure mode is discovering at build time that the base
 * was never viable: the first two packs came back with seven rejects, and every
 * one of them cost a full re-author of six clues. The build's rules are knowable
 * up front, so there is no reason to learn them at the end.
 *
 * A base is viable when ALL of these hold — the same checks build-puzzles.mjs
 * applies, in the same order:
 *
 *   • six letters, all distinct, in ENABLE1, not on the blocklist
 *   • in common use (popular.txt), or the build drops it outright
 *   • its answer set is 24-110 words, the band claimed puzzles are held to
 *   • at least five of its rows can be common words, since a featured board
 *     needs 5/6 common rows and the base is only one of them
 *   • not already claimed by an existing puzzle
 *
 * Output is a JSON pool: every viable base with its answer count and its
 * COMMON rows, longest first. An author picks five rows from that list and
 * writes to them. Nothing they hand back can be rejected for structure.
 *
 * Usage:
 *   node scripts/vet-bases.mjs                 # write data/base-pool.json
 *   node scripts/vet-bases.mjs cash fry oil    # only bases whose rows match
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isBlocked } from './lib/blocklist.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const MIN_ANSWERS = 24;
const MAX_ANSWERS = 110;
const MIN_COMMON_ROWS = 5; // featured floor, base included

/*
 * At most ONE of these, matching build-puzzles.mjs, so the wheel stays
 * solvable-feeling.
 *
 * This script exists to make rejection impossible, and it shipped without this
 * rule — so it offered `knives` (k and v) as viable and an author spent a board
 * on it before the build refused it. A vetting tool that does not enforce every
 * rule the build enforces is worse than no vetting tool, because people trust
 * it.
 */
const RARE = new Set(['j', 'q', 'x', 'z', 'v', 'w', 'k']);

const words = fs
  .readFileSync(path.join(ROOT, 'data', 'enable1.txt'), 'utf8')
  .split('\n')
  .map((w) => w.trim().toLowerCase())
  .filter((w) => w.length >= 3 && !isBlocked(w));

const popular = new Set(
  fs
    .readFileSync(path.join(ROOT, 'data', 'popular.txt'), 'utf8')
    .split('\n')
    .map((w) => w.trim().toLowerCase())
);

const existing = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'themes.json'), 'utf8')
).puzzles.map((p) => p.base);
const claimed = new Set(existing);

/*
 * Claim the LETTER SET, not just the word.
 *
 * A base is only ever seen by the player as six letters on a wheel, so two
 * anagrams are the same puzzle wearing different names. Vetting on the word
 * alone let `mantle`, `mantel`, `mental` and `lament` through as four separate
 * boards, and `sacred`/`scared` as two — the build caught them, but only after
 * the clues were written, which is the cost this script exists to avoid.
 */
const letterKey = (w) => [...w].sort().join('');
const claimedSets = new Set(existing.map(letterKey));

/*
 * Bucket the wordlist by letter set. Testing every word against every candidate
 * base is 172k x 6k; testing sorted-letter-subsets is not. A word is spellable
 * from a base of six DISTINCT letters only when it repeats no letter itself,
 * which collapses the check to a subset test on a character set.
 */
const spellable = words.filter((w) => new Set(w).size === w.length);
const byKey = new Map();
for (const w of spellable) {
  const key = [...w].sort().join('');
  let list = byKey.get(key);
  if (!list) byKey.set(key, (list = []));
  list.push(w);
}

/** Every answer a base's letters can make, via subsets of its letter set. */
function answersFor(base) {
  const letters = [...base].sort();
  const out = [];
  // 2^6 subsets; only those of length >= 3 can hold a word.
  for (let mask = 0; mask < 1 << 6; mask += 1) {
    const sub = [];
    for (let i = 0; i < 6; i += 1) if (mask & (1 << i)) sub.push(letters[i]);
    if (sub.length < 3) continue;
    const hit = byKey.get(sub.join(''));
    if (hit) out.push(...hit);
  }
  return out;
}

const pool = [];
for (const base of words) {
  if (base.length !== 6) continue;
  if (new Set(base).size !== 6) continue;
  if (!popular.has(base)) continue;
  if (claimed.has(base)) continue;
  if (claimedSets.has(letterKey(base))) continue;
  if ([...base].filter((c) => RARE.has(c)).length > 1) continue;

  const answers = answersFor(base);
  if (answers.length < MIN_ANSWERS || answers.length > MAX_ANSWERS) continue;

  const rows = answers
    .filter((w) => w !== base && popular.has(w))
    .sort((a, b) => b.length - a.length || a.localeCompare(b));
  if (rows.length + 1 < MIN_COMMON_ROWS) continue;

  // The pool must not offer two anagrams of each other either, or two authors
  // pick the same wheel independently and one of them is wasted work.
  claimedSets.add(letterKey(base));
  pool.push({ base, answers: answers.length, rows });
}

const filters = process.argv.slice(2).map((s) => s.toLowerCase());
const shown = filters.length
  ? pool.filter((p) => filters.some((f) => p.base.includes(f) || p.rows.some((r) => r.includes(f))))
  : pool;

if (filters.length) {
  for (const p of shown.slice(0, 60)) {
    process.stdout.write(`${p.base}  (${p.answers})  ${p.rows.slice(0, 18).join(' ')}\n`);
  }
  process.stdout.write(`\n${shown.length} match${shown.length === 1 ? '' : 'es'}\n`);
} else {
  const OUT = path.join(ROOT, 'data', 'base-pool.json');
  fs.writeFileSync(OUT, JSON.stringify(pool, null, 1) + '\n');
  process.stdout.write(
    `${pool.length} viable bases -> ${OUT}\n` +
      `  answers ${MIN_ANSWERS}-${MAX_ANSWERS} · >=${MIN_COMMON_ROWS} common rows · ${claimed.size} already claimed\n`
  );
}
