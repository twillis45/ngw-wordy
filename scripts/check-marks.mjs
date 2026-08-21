/**
 * Does the mark still read as six things at the size it is used?
 *
 * The board of 2026-08-21 found the mark works to about 32px and then stops:
 * at 16 the tiles merge and the accent — the only thing separating this from
 * a generic six-dot loader — goes first. Nothing in the repo could tell,
 * because a mark is always reviewed enlarged and never at the size a favicon
 * actually draws it.
 *
 * So: rasterise each variant at its DOCUMENTED MINIMUM and count the
 * separable shapes by flood-filling the alpha channel. Six shapes means six
 * shapes. Five means two tiles have merged and the mark has quietly become
 * something else.
 *
 * This is also the guard that documents the minimums. A size written in a
 * kit and enforced nowhere is a suggestion; this makes changing the geometry
 * without rechecking the sizes fail.
 *
 *   node scripts/check-marks.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'docs/brand');

/*
 * Each variant with the smallest size the kit permits it at. `shapes` is what
 * must remain separable — the small variant drops the centre puck, so it is
 * six rather than seven.
 */
const VARIANTS = [
  { file: 'mark.svg', min: 32, shapes: 7, note: 'full mark, with the centre puck' },
  { file: 'mark-mono.svg', min: 32, shapes: 6, note: 'one ink, no puck' },
  { file: 'mark-small.svg', min: 16, shapes: 6, note: 'for 16-24px' },
  { file: 'icon.svg', min: 29, shapes: null, note: 'app icon — filled tile, not counted' },
];

const server = http.createServer((req, res) => {
  const name = path.basename(decodeURIComponent(req.url));
  if (!name.endsWith('.svg')) {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><title>marks</title>');
    return;
  }
  const f = path.join(DIR, name);
  if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': 'image/svg+xml' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const browser = await launch({
  headless: true,
  userDataDir: path.join(ROOT, 'node_modules', '.cache', 'marks-chrome'),
});
const page = await browser.newPage();
await page.goto(base, { waitUntil: 'domcontentloaded' });

const results = await page.evaluate(
  async ({ variants, base }) => {
    const load = (src) =>
      new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = src;
      });

    const out = [];
    for (const v of variants) {
      const img = await load(`${base}/${v.file}`);
      const c = document.createElement('canvas');
      c.width = v.min;
      c.height = v.min;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0, v.min, v.min);
      const d = x.getImageData(0, 0, v.min, v.min).data;

      /*
       * A pixel counts as ink at half alpha. Anti-aliasing means a merged
       * pair still has a faint bridge, and a threshold that treats every
       * ghost pixel as ink would report one blob for a mark that reads
       * perfectly well.
       */
      const ink = [];
      for (let i = 0; i < v.min * v.min; i++) ink.push(d[i * 4 + 3] > 127);

      const seen = new Array(v.min * v.min).fill(false);
      let blobs = 0;
      for (let i = 0; i < ink.length; i++) {
        if (!ink[i] || seen[i]) continue;
        blobs++;
        const stack = [i];
        seen[i] = true;
        while (stack.length) {
          const p = stack.pop();
          const px = p % v.min;
          const py = (p / v.min) | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = px + dx;
            const ny = py + dy;
            if (nx < 0 || ny < 0 || nx >= v.min || ny >= v.min) continue;
            const n = ny * v.min + nx;
            if (ink[n] && !seen[n]) { seen[n] = true; stack.push(n); }
          }
        }
      }
      out.push({ ...v, blobs, inkPixels: ink.filter(Boolean).length });
    }
    return out;
  },
  { variants: VARIANTS, base }
);

await browser.close();
server.close();

let failed = 0;
for (const r of results) {
  const label = `${r.file} @ ${r.min}px`.padEnd(28);
  if (r.shapes === null) {
    console.log(`—  ${label} ${r.blobs} shape(s) — ${r.note}`);
    continue;
  }
  if (r.blobs !== r.shapes) {
    failed++;
    console.log(
      `✗  ${label} reads as ${r.blobs}, should be ${r.shapes} — ${
        r.blobs < r.shapes ? 'shapes have merged' : 'the mark has broken apart'
      }`
    );
  } else {
    console.log(`✔  ${label} ${r.blobs} separable shapes — ${r.note}`);
  }
}

if (failed) {
  console.log(`\n✗ the mark stops reading at ${failed} of its documented sizes`);
  process.exit(1);
}
console.log('\n✔ every variant still reads as itself at its documented minimum');
