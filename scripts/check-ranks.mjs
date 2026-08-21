/**
 * Does the rank ladder actually encode rank?
 *
 * The old one did not, and nothing in the repo could tell. Seven
 * photorealistic renders whose mean luminance at 32px ran 31.6, 49.7, 47.5,
 * 47.9, 40.8, 62.1, 57.7 — three adjacent pairs under 5 of 255 apart, and not
 * monotonic, so a player climbing from Solid to Fluent watched their mark get
 * DARKER. Form differed too but did not order. Two channels, both wandering.
 * That shipped, and it took a board convening and a hand measurement to find.
 *
 * The invariant, in one sentence: a ladder must have at least one visual
 * variable that only ever moves in one direction.
 *
 * Asserted three ways, because the failure had three parts:
 *
 *   MONOTONIC — every step brighter than the one below it. This is the part
 *   that was actually broken.
 *
 *   SEPARATED — no step so small it reads as no step. A ladder whose rungs
 *   are 0.4 of 255 apart is a ladder with fewer rungs than it claims.
 *
 *   SURVIVES GREYSCALE — the ordering must hold with hue removed, because the
 *   kit's accessibility commitments promise meaning is never carried by hue
 *   alone, and roughly 8% of men would otherwise be reading a flat ladder.
 *
 *   node scripts/check-ranks.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RANKS = ['novice', 'solid', 'sharp', 'clever', 'fluent', 'wordsmith', 'complete'];

/*
 * The size the rail actually draws them, not the size they look good at. The
 * old ladder's silhouettes were separable at 3x magnification and mud at 32,
 * which is exactly how a review that only ever enlarges artwork misses this.
 */
const SIZE = 32;
/* Below this a step reads as no step. The old ladder had three under 5. */
const MIN_GAP = 6;

const dir = path.join(ROOT, 'docs/brand/ranks');
const server = http.createServer((req, res) => {
  const name = path.basename(decodeURIComponent(req.url));
  /*
   * A real page at the same origin, because the measurement draws these into
   * a canvas and reads the pixels back. From about:blank there is no origin,
   * the images never load, and getImageData would taint anyway.
   */
  if (!name.endsWith('.svg')) {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><title>ranks</title>');
    return;
  }
  const f = path.join(dir, name);
  if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': 'image/svg+xml' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const browser = await launch({
  headless: true,
  userDataDir: path.join(ROOT, 'node_modules', '.cache', 'ranks-chrome'),
});
const page = await browser.newPage();

const measure = async (grey) =>
  page.evaluate(
    async ({ names, size, grey, base }) => {
      const load = (src) =>
        new Promise((res, rej) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = rej;
          i.src = src;
        });
      const out = [];
      for (let n = 0; n < names.length; n++) {
        const img = await load(`${base}/rank-${n}-${names[n]}.svg`);
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        const x = c.getContext('2d');
        if (grey) x.filter = 'grayscale(1)';
        x.drawImage(img, 0, 0, size, size);
        const d = x.getImageData(0, 0, size, size).data;
        let L = 0;
        let px = 0;
        for (let p = 0; p < d.length; p += 4) {
          if (d[p + 3] < 20) continue;
          L += 0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2];
          px++;
        }
        out.push({ name: names[n], lum: +(L / px).toFixed(1) });
      }
      return out;
    },
    { names: RANKS, size: SIZE, grey, base }
  );

await page.goto(base, { waitUntil: 'domcontentloaded' });
const colour = await measure(false);
const grey = await measure(true);
await browser.close();
server.close();

let failed = 0;
const report = (label, rows) => {
  console.log(`\n${label}`);
  let prev = null;
  for (const r of rows) {
    const gap = prev === null ? null : +(r.lum - prev).toFixed(1);
    let flag = '  ';
    if (gap !== null && gap <= 0) {
      failed++;
      flag = '✗ ';
    } else if (gap !== null && gap < MIN_GAP) {
      failed++;
      flag = '✗ ';
    } else if (gap !== null) flag = '✔ ';
    const gapText =
      gap === null
        ? ''
        : gap <= 0
          ? `  ${gap} — DARKER than the rank below it`
          : gap < MIN_GAP
            ? `  +${gap} — under the ${MIN_GAP} floor, reads as no step`
            : `  +${gap}`;
    console.log(`${flag} ${r.name.padEnd(11)} ${String(r.lum).padStart(6)}${gapText}`);
    prev = r.lum;
  }
  const spread = (rows[rows.length - 1].lum - rows[0].lum).toFixed(1);
  console.log(`   spread across the ladder: ${spread} of 255`);
};

report('in colour', colour);
report('in greyscale — hue removed', grey);

if (failed) {
  console.log(`\n✗ the ladder does not encode rank at ${failed} step${failed > 1 ? 's' : ''}`);
  process.exit(1);
}
console.log('\n✔ every rung is brighter than the one below it, in colour and in greyscale');
