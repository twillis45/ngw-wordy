/*
 * A setting that does not take is worse than a setting that is missing.
 *
 * Two accents were added and neither applied: `applyAccent` still read
 * `next === 'matte'` and DELETED the attribute for anything else, so choosing
 * Tide set the label to "Tide" and left the page green. The pre-paint script
 * had the same two-value assumption and would have painted any stored accent
 * orange on the first frame — two bugs cancelling into one wrong colour, which
 * is precisely why nothing looked broken enough to notice.
 *
 * No test caught it. The unit tests checked that the COLOURS were readable and
 * the labels existed; nothing drove the control and asked whether the page
 * changed. That gap is what this file is.
 *
 * THE EXPECTATIONS ARE DERIVED FROM SOURCE, not restated here. The accent
 * order comes from accent.ts and the colours from globals.css, so a fifth
 * accent is covered the day it is added rather than the day somebody
 * remembers this file. A guard that has to be updated by hand to keep working
 * is the kind that quietly stops.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './lib/browser.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)).replace(/\/scripts$/, '');
const OUT = path.join(ROOT, 'out');
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
  '.webmanifest':'application/manifest+json', '.ico':'image/x-icon', '.woff2':'font/woff2' };

/*
 * COMMENTS STRIPPED BEFORE ANY PARSING.
 *
 * Three times in one day a regex in this repo read prose as code: a pitch test
 * matched the "Was 620Hz" note recording an old value, an anchor audit read a
 * number the mutation harness had just written, and this file matched
 * ACCENT_LABELS on a comment describing what the settings row prints and
 * derived an empty map. Every one of those failed loudly against correct code,
 * which is the good outcome — the bad one is a regex that matches a comment
 * and produces a plausible wrong answer.
 *
 * globals.css is the sharpest case: it is a file whose comments discuss hex
 * values constantly, and the default accent is read as "the first
 * --color-success in the file". So the text is stripped first and the patterns
 * only ever see code.
 */
const strip = (t) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const src = (f) => strip(fs.readFileSync(path.join(ROOT, f), 'utf8'));

/* Accent order, from the source of truth rather than a copy of it. */
const accentOrder = (() => {
  const m = src('src/lib/accent.ts').match(/export const ACCENT_ORDER: Accent\[\] = \[([^\]]+)\]/);
  return m ? m[1].split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean) : [];
})();

/* Labels, likewise. */
const accentLabels = (() => {
  /*
   * Anchored on `export const`, because the first mention of ACCENT_LABELS in
   * this file is inside a comment describing what the settings row prints. The
   * unanchored version matched that prose, ran forward to an unrelated brace,
   * and derived an empty label map — so every accent row failed while the app
   * was correct. Third time today a regex has read a comment as code.
   */
  const block = src('src/lib/accent.ts').match(/export const ACCENT_LABELS[^{]*\{([\s\S]*?)\}/);
  const out = {};
  if (block) for (const m of block[1].matchAll(/(\w+):\s*'([^']+)'/g)) out[m[1]] = m[2];
  return out;
})();

/*
 * The dark-mode colour each accent resolves to. `default` has no attribute
 * block by design — it IS the bare :root value — so it is read from the dark
 * root instead.
 */
const accentColour = (() => {
  const css = src('src/app/globals.css');
  const out = {};
  for (const m of css.matchAll(/:root\[data-accent='(\w+)'\]\s*\{([^}]*)\}/g)) {
    const c = m[2].match(/--color-success:\s*([^;]+);/);
    if (c && !out[m[1]]) out[m[1]] = c[1].trim();
  }
  const root = css.match(/--color-success:\s*(#[0-9a-fA-F]{6});/);
  if (root) out.default = root[1];
  return out;
})();

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(OUT, p);
  if (!file.startsWith(OUT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('nf'); return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const browser = await launch({
  headless: true,
  userDataDir: path.join(ROOT, 'node_modules', '.cache', 'settings-chrome'),
});
const page = await browser.newPage();
page.setDefaultNavigationTimeout(60_000);
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 900));

const openSettings = () =>
  page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      /How to play/.test(x.getAttribute('aria-label') ?? ''),
    );
    b?.click();
  });

const rows = [];
await openSettings();
await new Promise((r) => setTimeout(r, 700));

/*
 * Cycle the real control once per accent and ask the PAGE what happened —
 * both the attribute the CSS keys on and the value it resolves to. Reading
 * only the label is what let this ship.
 */
for (let i = 0; i < accentOrder.length; i++) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      /^Accent:/.test(x.getAttribute('aria-label') ?? ''),
    );
    b?.click();
  });
  await new Promise((r) => setTimeout(r, 260));
  const seen = await page.evaluate(() => ({
    label: [...document.querySelectorAll('button')]
      .find((x) => /^Accent:/.test(x.getAttribute('aria-label') ?? ''))
      ?.textContent.trim(),
    attr: document.documentElement.getAttribute('data-accent'),
    css: getComputedStyle(document.documentElement).getPropertyValue('--color-success').trim(),
  }));
  const key = Object.keys(accentLabels).find((k) => accentLabels[k] === seen.label);
  const want = key ? accentColour[key] : null;
  const attrOk = key === 'default' ? seen.attr === null : seen.attr === key;
  const cssOk = !!want && seen.css.toLowerCase() === want.toLowerCase();
  rows.push({
    what: `accent ${seen.label ?? '?'}`,
    got: `attr=${seen.attr} css=${seen.css}`,
    ok: attrOk && cssOk,
  });
}

/*
 * The pre-paint path, which is the half that would have flashed. Seeded and
 * reloaded — and deliberately NOT clearing storage on navigation, because a
 * probe that clears the value it is about to measure reports a bug that is its
 * own. That happened while writing this.
 */
for (const key of [...accentOrder, 'garbage']) {
  await page.evaluate((v) => localStorage.setItem('ngw-wordy/accent', v), key);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const attr = await page.evaluate(() => document.documentElement.getAttribute('data-accent'));
  const want = key === 'default' ? null : accentOrder.includes(key) ? key : 'matte';
  rows.push({ what: `pre-paint ${key}`, got: `attr=${attr}`, ok: attr === want });
}

/* Feedback intensity: stored, restored, and shown. */
for (const [stored, label] of [['strong', 'Strong'], ['soft', 'Soft'], ['normal', 'Normal']]) {
  await page.evaluate((v) => {
    if (v === 'normal') localStorage.removeItem('ngw-wordy/feedback');
    else localStorage.setItem('ngw-wordy/feedback', v);
  }, stored);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 800));
  await openSettings();
  await new Promise((r) => setTimeout(r, 600));
  const shown = await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .find((x) => /Feedback strength/.test(x.getAttribute('aria-label') ?? ''))
      ?.textContent.trim(),
  );
  rows.push({ what: `feedback ${stored}`, got: shown ?? '(missing)', ok: shown === label });
}

await browser.close();
server.close();

let bad = 0;
for (const r of rows) {
  if (!r.ok) bad++;
  console.log(`${r.ok ? '✔' : '✗'}  ${r.what.padEnd(22)} ${r.got}`);
}
if (bad) {
  console.log(`\n✖ a setting says it changed and did not: ${bad} of ${rows.length}`);
  process.exit(1);
}
console.log(`\n✔ every setting takes — ${accentOrder.length} accents applied, restored, and shown`);
