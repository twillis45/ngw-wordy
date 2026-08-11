/**
 * Everything needed to author one pack, in one view.
 *
 * `theme-yield.mjs` says WHICH boards a theme can support. Authoring then needs
 * the rest: each candidate's full legal row set, which of those rows are
 * on-theme and in which tier, and which are merely legal filler. Assembling
 * that by hand per board is where the time went on the first two packs.
 *
 *   node scripts/pack-draft.mjs church 14
 *
 * Rows are ordered on-theme first, so the five that make the board are usually
 * the first five printed. What the tool CANNOT do is the bench's test — do the
 * six rows describe one moment? — which is why this prints candidates for a
 * person to choose between rather than emitting a pack.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isBlocked } from './lib/blocklist.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const theme = process.argv[2];
const want = Number(process.argv[3] ?? 14);
if (!theme) {
  console.error('usage: node scripts/pack-draft.mjs <theme> [count]');
  process.exit(1);
}

const distinct = (w) => new Set(w).size === w.length;
const enable = read('data/enable1.txt').split('\n').map((w) => w.trim()).filter(Boolean);
const popular = new Set(read('data/popular.txt').split('\n').map((w) => w.trim()).filter(Boolean));
const serviceable = enable.filter(
  (w) => w.length >= 3 && w.length <= 6 && distinct(w) && popular.has(w) && !isBlocked(w)
);

const vocabFile = JSON.parse(read('data/theme-vocab.json'));
const entry = vocabFile[theme];
if (!entry) {
  console.error(`no vocabulary for "${theme}"`);
  process.exit(1);
}
const tiers = Object.fromEntries(
  Object.entries(entry).filter(([k]) => !k.startsWith('_'))
);
/** word -> tier, first tier wins so `named` outranks `said`. */
const tierOf = new Map();
for (const [name, words] of Object.entries(tiers))
  for (const w of String(words).split(/\s+/)) if (w && !tierOf.has(w)) tierOf.set(w, name);

const yieldReport = JSON.parse(read('data/theme-yield.json'));
const t = yieldReport.find((x) => x.id === theme);
if (!t) {
  console.error(`"${theme}" is not in data/theme-yield.json — run theme-yield.mjs --json first`);
  process.exit(1);
}

// Same frequency cap the packs ship under: no row word in more than three boards.
const use = {};
const pack = [];
for (const b of t.boards) {
  const rows = b.rows.map((r) => r.split(':')[0]);
  if (rows.some((w) => (use[w] ?? 0) >= 3)) continue;
  rows.forEach((w) => (use[w] = (use[w] ?? 0) + 1));
  pack.push(b);
  if (pack.length >= want) break;
}

const mark = (w) => {
  const tier = tierOf.get(w);
  if (tier === 'named' || tier === 'acts') return `${w}*`; // the board's reason to exist
  if (tier === 'said' || tier === 'titles') return `${w}+`; // what the theme says
  if (tier) return `${w}~`; // texture, counts toward nothing
  return w; // legal filler
};

console.log(`${theme} — ${t.shipped} shipped, ${pack.length} candidates below`);
console.log(`  * = named (required)   + = said (required)   ~ = texture   plain = filler\n`);

for (const b of pack) {
  const set = new Set(b.base);
  const legal = serviceable.filter((w) => w !== b.base && [...w].every((c) => set.has(c)));
  const on = legal.filter((w) => tierOf.has(w));
  const rest = legal.filter((w) => !tierOf.has(w));
  const owner = b.owner ? `  [taking from ${b.owner}]` : '  [free]';
  console.log(`${b.base.toUpperCase()}  ${b.known} on-theme${owner}`);
  console.log(`   ${on.map(mark).join(' ')}`);
  if (rest.length) console.log(`   filler: ${rest.slice(0, 12).join(' ')}`);
  console.log('');
}
