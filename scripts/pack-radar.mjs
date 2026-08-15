/**
 * The catalogue's standing health check — what to build next, and what rotted.
 *
 * The half of the pack pipeline that needs NO NETWORK. Trend signals need the
 * web and a judgement call; everything here is arithmetic over files already in
 * the repo, so it runs the same on a laptop, in CI, or from a scheduled agent
 * with nothing but a checkout.
 *
 * That split is the point. A periodic process that depends on the web fails
 * quietly when the web is unavailable and tells you nothing; this half always
 * has an answer, and it is the half that actually decides what to author.
 *
 *   node scripts/pack-radar.mjs           report
 *   node scripts/pack-radar.mjs --json    machine-readable, for a scheduled run
 *
 * Reports, never gates. Exit code is 0 even when it finds problems — the
 * catalogue is allowed to have known gaps, and a check that blocks a build for
 * saying "stoop still has no boards" would just get muted.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const readJson = (p) => JSON.parse(read(p));

const themes = readJson('data/themes.json');
const vocab = readJson('data/theme-vocab.json');
const enable = read('data/enable1.txt').split('\n').map((s) => s.trim()).filter(Boolean);
const popular = new Set(read('data/popular.txt').split('\n').map((s) => s.trim()).filter(Boolean));

const cnt = (w) => { const m = new Map(); for (const c of w) m.set(c, (m.get(c) || 0) + 1); return m; };
const fits = (w, bm) => { const wm = cnt(w); for (const [c, n] of wm) if ((bm.get(c) || 0) < n) return false; return true; };
const okBase = (b) => b.length === 6 && popular.has(b) && new Set(b).size >= 5;

/** The theme's language, filtered the way the build filters it. */
function wordsFor(id) {
  const e = vocab[id];
  if (!e) return [];
  const text = typeof e === 'string'
    ? e
    : Object.entries(e).filter(([k]) => !k.startsWith('_')).map(([, v]) => String(v)).join(' ');
  return [...new Set(text.split(/\s+/))].filter((w) => w.length >= 3 && w.length <= 6 && popular.has(w));
}

/** Bases able to spell 3+ of the theme's words — the documented gate. */
function density(words) {
  const set = new Set(words);
  let dense = 0, best = 0, prize = 0;
  for (const b of enable) {
    if (!okBase(b)) continue;
    const bm = cnt(b);
    let n = 0;
    for (const w of words) if (w !== b && fits(w, bm)) n++;
    if (n >= 3) dense++;
    if (n > best) best = n;
    if (set.has(b) && n >= 3) prize++;
  }
  return { dense, best, prize };
}

const DENSITY_FLOOR = 12;   // scripts/viability.mjs
const BOARD_FLOOR = 4;      // "a theme under 4 puzzles is a demo, not a set"
const ONTHEME_FLOOR = 0.6;  // src/lib/catalogue.test.ts ratchet

const boards = {};
for (const p of themes.puzzles) boards[p.theme] = (boards[p.theme] ?? 0) + 1;

const rows = [];
for (const t of themes.themes) {
  const words = wordsFor(t.id);
  const { dense, best, prize } = density(words);
  const pack = themes.puzzles.filter((b) => b.theme === t.id);
  let rowsTotal = 0, onTheme = 0;
  const set = new Set(words);
  for (const b of pack) {
    for (const w of Object.keys(b.clues)) {
      if (w === b.base) continue;
      rowsTotal += 1;
      if (set.has(w)) onTheme += 1;
    }
  }
  rows.push({
    id: t.id, name: t.name, category: t.category,
    boards: boards[t.id] ?? 0, words: words.length,
    dense, best, prize,
    onTheme: rowsTotal ? onTheme / rowsTotal : null,
  });
}

/* ---------- findings: things a person should actually do ---------- */
const findings = [];

for (const r of rows) {
  if (r.boards === 0 && r.dense >= DENSITY_FLOOR) {
    findings.push({
      level: 'ready',
      theme: r.id,
      what: `has a vocabulary (${r.words} words, density ${r.dense}) and ZERO boards — it is a theme already paid for`,
    });
  }
  if (r.boards > 0 && r.boards < BOARD_FLOOR) {
    findings.push({
      level: 'thin',
      theme: r.id,
      what: `${r.boards} boards — under the floor of ${BOARD_FLOOR}; a demo, not a set`,
    });
  }
  if (r.boards > 0 && r.dense < DENSITY_FLOOR) {
    findings.push({
      level: 'unviable',
      theme: r.id,
      what: `SHIPPED with density ${r.dense}, below the floor of ${DENSITY_FLOOR} — this is the Laundry Day shape`,
    });
  }
  if (r.onTheme !== null && r.onTheme < ONTHEME_FLOOR) {
    findings.push({
      level: 'weak',
      theme: r.id,
      what: `on-theme ${r.onTheme.toFixed(3)}, under the ${ONTHEME_FLOOR} floor — deepen the vocabulary before authoring more`,
    });
  }
  if (r.boards > 0 && r.words < 100) {
    findings.push({
      level: 'shallow',
      theme: r.id,
      what: `${r.words} usable words — the packs that reach 0.80 carry ~140. Depth is the lever`,
    });
  }
}

// A theme in the vocabulary file that nobody has put on a shelf yet.
for (const id of Object.keys(vocab)) {
  if (id.startsWith('_')) continue;
  if (!themes.themes.some((t) => t.id === id)) {
    const words = wordsFor(id);
    const { dense } = density(words);
    findings.push({
      level: dense >= DENSITY_FLOOR ? 'ready' : 'draft',
      theme: id,
      what: `vocabulary exists (${words.length} words, density ${dense}) but the theme is not in themes.json`,
    });
  }
}

const json = process.argv.includes('--json');
if (json) {
  console.log(JSON.stringify({ generated: null, rows, findings }, null, 2));
} else {
  console.log('theme          boards  words  density  best  prize  on-theme');
  for (const r of [...rows].sort((a, b) => b.boards - a.boards)) {
    console.log(
      r.id.padEnd(14),
      String(r.boards).padStart(6),
      String(r.words).padStart(6),
      String(r.dense).padStart(8),
      String(r.best).padStart(5),
      String(r.prize).padStart(6),
      r.onTheme === null ? '     —' : r.onTheme.toFixed(3).padStart(9)
    );
  }
  const order = ['unviable', 'weak', 'thin', 'ready', 'shallow', 'draft'];
  console.log(`\n${findings.length} finding(s):`);
  for (const level of order) {
    for (const f of findings.filter((x) => x.level === level)) {
      console.log(`  [${level}] ${f.theme}: ${f.what}`);
    }
  }
  console.log('\nReports only — never gates. See docs/PACK_PIPELINE.md for the trend half.');
}
