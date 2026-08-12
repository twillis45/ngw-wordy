/**
 * Score a candidate theme BEFORE it is allowed anywhere near the catalogue.
 *
 * The intake half of the pack pipeline. A trend source suggests a theme; this
 * says whether the theme can carry a pack, which is a completely different
 * question and the only one that has ever been decisive.
 *
 *   node scripts/candidate.mjs                 score every draft
 *   node scripts/candidate.mjs camping         score one
 *   node scripts/candidate.mjs --promote gym   copy a passing draft into
 *                                              data/theme-vocab.json
 *
 * Drafts live in data/candidates/<id>.txt and never touch theme-vocab.json
 * until promoted, so a candidate costs nothing to test and nothing to abandon.
 * Format is a header of `# key: value` lines, then free-form words:
 *
 *   # name: The Long Way Out
 *   # shelf: The Long Way
 *   # source: Glimpse - camping renaissance, 58M US households
 *   tent pole stake rope ...
 *
 * WHY THIS EXISTS: Laundry Day and Caribbean were authored, shipped, and then
 * measured — both were unviable at any wheel size and had to be cut, and no
 * rewrite could have saved either. Measuring first costs ten minutes.
 *
 * READ THE NUMBER CORRECTLY. Density scales hard with vocabulary depth: the
 * same theme drafted at 35 words scored 11 and at 207 words scored 453. A
 * thin draft that fails has told you about the draft. Write ~140 words before
 * believing a "no".
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const DIR = path.join(ROOT, 'data/candidates');

const enable = read('data/enable1.txt').split('\n').map((s) => s.trim()).filter(Boolean);
const popular = new Set(read('data/popular.txt').split('\n').map((s) => s.trim()).filter(Boolean));
const cnt = (w) => { const m = new Map(); for (const c of w) m.set(c, (m.get(c) || 0) + 1); return m; };
const fits = (w, bm) => { const wm = cnt(w); for (const [c, n] of wm) if ((bm.get(c) || 0) < n) return false; return true; };
const okBase = (b) => b.length === 6 && popular.has(b) && new Set(b).size >= 5;

const DENSITY_FLOOR = 12;
/** Below this the score is about the draft, not the theme. */
const DEPTH_ADVISORY = 120;

function parse(file) {
  const raw = fs.readFileSync(path.join(DIR, file), 'utf8');
  const meta = {};
  const words = [];
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*#\s*([a-z]+)\s*:\s*(.+)$/i);
    if (m) { meta[m[1].toLowerCase()] = m[2].trim(); continue; }
    if (line.trim().startsWith('#')) continue;
    words.push(...line.split(/\s+/).filter(Boolean));
  }
  return { id: file.replace(/\.txt$/, ''), meta, drafted: words };
}

function score(drafted) {
  const words = [...new Set(drafted)].filter((w) => w.length >= 3 && w.length <= 6 && popular.has(w));
  const set = new Set(words);
  let dense = 0, best = 0;
  const prizes = [];
  for (const b of enable) {
    if (!okBase(b)) continue;
    const bm = cnt(b);
    let n = 0;
    for (const w of words) if (w !== b && fits(w, bm)) n++;
    if (n >= 3) dense++;
    if (n > best) best = n;
    if (set.has(b) && n >= 3) prizes.push([b, n]);
  }
  return { kept: words.length, dense, best, prizes: prizes.sort((a, b) => b[1] - a[1]) };
}

if (!fs.existsSync(DIR)) {
  console.error(`no ${path.relative(ROOT, DIR)} — nothing drafted yet.`);
  process.exit(0);
}

const promote = process.argv.indexOf('--promote');
const only = process.argv.slice(2).find((a) => !a.startsWith('--') && a !== process.argv[promote + 1]);

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.txt'));
const scored = files.map((f) => {
  const c = parse(f);
  return { ...c, ...score(c.drafted) };
}).sort((a, b) => b.dense - a.dense);

if (promote !== -1) {
  const id = process.argv[promote + 1];
  const c = scored.find((x) => x.id === id);
  if (!c) { console.error(`no draft data/candidates/${id}.txt`); process.exit(1); }
  if (c.dense < DENSITY_FLOOR) {
    console.error(`refusing: ${id} scores ${c.dense}, under the floor of ${DENSITY_FLOOR}.`);
    console.error('Deepen the draft toward ~140 words and score it again.');
    process.exit(1);
  }
  const P = path.join(ROOT, 'data/theme-vocab.json');
  const v = JSON.parse(fs.readFileSync(P, 'utf8'));
  if (v[id]) { console.error(`refusing: ${id} already exists in theme-vocab.json.`); process.exit(1); }
  v[id] = {
    _note: `${c.meta.shelf ? 'Shelf: ' + c.meta.shelf + '. ' : ''}${c.meta.source ? 'Trend signal: ' + c.meta.source + '. ' : ''}Promoted from data/candidates/${id}.txt at ${c.kept} usable words, density ${c.dense}. Tiers below are UNSORTED — split into named/said/voice before authoring.`,
    named: c.drafted.join(' '),
  };
  fs.writeFileSync(P, JSON.stringify(v, null, 2) + '\n');
  console.log(`promoted ${id} -> data/theme-vocab.json (density ${c.dense}).`);
  console.log('Next: split the vocabulary into named/said/voice tiers, then run');
  console.log('  node scripts/theme-yield.mjs --json && node scripts/pack-draft.mjs ' + id);
  process.exit(0);
}

const show = only ? scored.filter((c) => c.id === only) : scored;
console.log('candidate      kept  density>=3  best  prize   gate      shelf');
for (const c of show) {
  const gate = c.dense >= DENSITY_FLOOR ? 'PASS' : 'FAIL';
  console.log(
    c.id.padEnd(14), String(c.kept).padStart(4), String(c.dense).padStart(11),
    String(c.best).padStart(5), String(c.prizes.length).padStart(6),
    '   ' + gate.padEnd(9), c.meta.shelf ?? '—'
  );
}
const thin = show.filter((c) => c.drafted.length < DEPTH_ADVISORY);
if (thin.length) {
  console.log(`\n${thin.length} draft(s) under ${DEPTH_ADVISORY} words — the score is about the draft, not the theme:`);
  for (const c of thin) console.log(`  ${c.id} (${c.drafted.length} words)`);
}
console.log('\nSources and cadence: docs/PACK_PIPELINE.md');
