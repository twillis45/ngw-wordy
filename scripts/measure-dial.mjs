/**
 * What does the dial's letter rule cost the catalogue?
 *
 * Today a base is six DISTINCT letters, so a row can never repeat one. That
 * single rule deletes `cool`, `free`, `greens`, `grill`, `sweet`, `coffee` and
 * every other doubled-letter word from every theme vocabulary in the game, and
 * it is the reason narrow themes score zero however well their vocabulary is
 * written.
 *
 * This measures three dials against the SAME vocabularies and the same
 * 3-of-5 bar, so the comparison is like-for-like:
 *
 *   A  6 tiles, 6 distinct   — what ships today
 *   B  6 tiles, 5 distinct   — one letter doubled (GREENS, LETTER)
 *   C  7 tiles, 6 distinct   — six letters plus a duplicate of one (SUNDAYS)
 *
 * B is NOT strictly better than A: it trades a letter of alphabet for the
 * doubles, so it can spell fewer things overall. C strictly contains A — every
 * board legal today is still legal — at the cost of a seventh tile on the dial
 * and a seven-letter prize word.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isBlocked } from './lib/blocklist.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const BAR = Number(process.env.BAR ?? 3);
const MAXROW = Number(process.env.MAXROW ?? 6);
const CAP = Number(process.env.CAP ?? 3);

const enable = new Set(read('data/enable1.txt').split('\n').map((w) => w.trim()).filter(Boolean));
const popular = new Set(read('data/popular.txt').split('\n').map((w) => w.trim()).filter(Boolean));
const vocabFile = JSON.parse(read('data/theme-vocab.json'));

/** Letter counts, as a 26-slot vector. */
function counts(w) {
  const v = new Uint8Array(26);
  for (const c of w) v[c.charCodeAt(0) - 97]++;
  return v;
}
/** Can `word` be spelled from `tiles`, using each tile at most once? */
function fits(word, tiles) {
  for (let i = 0; i < 26; i++) if (word[i] > tiles[i]) return false;
  return true;
}
const distinctCount = (w) => new Set(w).size;
const key = (w) => [...w].sort().join('');

/** Candidate bases per dial shape. */
const DIALS = {
  A: { label: '6 tiles, 6 distinct  (ships today)', len: 6, distinct: 6 },
  B: { label: '6 tiles, 5 distinct  (one doubled)', len: 6, distinct: 5 },
  C: { label: '7 tiles, 6 distinct  (six + a dup) ', len: 7, distinct: 6 },
  D: { label: '7 tiles, 7 distinct  (one more letter)', len: 7, distinct: 7 },
  E: { label: '8 tiles, 8 distinct  (two more)      ', len: 8, distinct: 8 },
};
for (const d of Object.values(DIALS)) {
  d.bases = [...enable].filter(
    (w) => w.length === d.len && distinctCount(w) === d.distinct && popular.has(w) && !isBlocked(w)
  );
  d.tiles = new Map(d.bases.map((b) => [b, counts(b)]));
}

/** Theme vocabulary, filtered only by what the BUILD needs — not by the dial. */
function vocabOf(entry) {
  const tiers = typeof entry === 'string' ? { titles: entry } : entry;
  const tierOf = new Map();
  for (const [name, words] of Object.entries(tiers)) {
    if (name.startsWith('_')) continue;
    for (const w of String(words).split(/\s+/)) if (w && !tierOf.has(w)) tierOf.set(w, name);
  }
  const out = [];
  const seen = new Set();
  for (const [w, tier] of tierOf) {
    if (w.length < 3 || w.length > MAXROW) continue;
    if (!enable.has(w) || !popular.has(w) || isBlocked(w)) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    out.push({ w, tier, c: counts(w) });
  }
  // plurals fold onto their stem: `plate`/`plates` is one idea
  for (const f of out) f.stem = seen.has(f.w.replace(/s$/, '')) && f.w.endsWith('s') ? f.w.slice(0, -1) : f.w;
  return out;
}

const results = {};
for (const [id, dial] of Object.entries(DIALS)) {
  let total = 0;
  const per = [];
  for (const [theme, entry] of Object.entries(vocabFile)) {
    if (theme.startsWith('_')) continue;
    const vocab = vocabOf(entry);
    const boards = [];
    for (const base of dial.bases) {
      const tiles = dial.tiles.get(base);
      const hit = vocab.filter((f) => f.w !== base && fits(f.c, tiles));
      const stems = new Set(hit.map((f) => f.stem));
      const known = new Set(hit.filter((f) => f.tier !== 'voice').map((f) => f.stem)).size;
      if (stems.size >= BAR && known >= BAR) boards.push({ base, known, rows: [...stems] });
    }
    // one board per idea-set, then the frequency cap
    const byIdeas = new Map();
    for (const b of boards.sort((x, y) => y.known - x.known))
      if (!byIdeas.has(b.rows.slice().sort().join(' '))) byIdeas.set(b.rows.slice().sort().join(' '), b);
    const seenSet = new Set();
    const use = {};
    const pack = [];
    for (const b of [...byIdeas.values()].sort((x, y) => y.known - x.known)) {
      if (seenSet.has(key(b.base))) continue;
      if (b.rows.some((w) => (use[w] ?? 0) >= CAP)) continue;
      b.rows.forEach((w) => (use[w] = (use[w] ?? 0) + 1));
      seenSet.add(key(b.base));
      pack.push(b);
    }
    total += pack.length;
    per.push({ theme, vocab: vocab.length, pack: pack.length, best: pack[0] });
  }
  results[id] = { total, per };
}

console.log(`bar ${BAR}-of-5 recognisable rows · no row word in more than ${CAP} boards\n`);
console.log('dial                                  bases   boards   vs today');
for (const [id, d] of Object.entries(DIALS)) {
  const t = results[id].total;
  const delta = id === 'A' ? '—' : `${t >= results.A.total ? '+' : ''}${t - results.A.total}  (${(t / results.A.total).toFixed(1)}x)`;
  console.log(`${id}  ${d.label}  ${String(d.bases.length).padStart(5)}   ${String(t).padStart(6)}   ${delta}`);
}

console.log('\nper theme:');
console.log('theme          A(today)    B     C     D     E');
const themes = results.A.per.map((p) => p.theme);
for (const t of themes) {
  const a = results.A.per.find((p) => p.theme === t).pack;
  const b = results.B.per.find((p) => p.theme === t).pack;
  const c = results.C.per.find((p) => p.theme === t).pack;
  const d = results.D.per.find((p) => p.theme === t).pack;
  const e = results.E.per.find((p) => p.theme === t).pack;
  console.log(t.padEnd(14), String(a).padStart(8), String(b).padStart(5), String(c).padStart(5), String(d).padStart(5), String(e).padStart(5));
}

if (process.argv.includes('--samples')) {
  console.log('\nwhat dial C unlocks, for themes that score zero today:');
  for (const t of ['hbcu', 'gogo', 'homecoming', 'carolina', 'church']) {
    const c = results.C.per.find((p) => p.theme === t);
    if (c?.best) console.log('  ', t.padEnd(12), c.best.base.toUpperCase().padEnd(9), c.best.rows.join(' '));
    else console.log('  ', t.padEnd(12), 'still nothing');
  }
}
