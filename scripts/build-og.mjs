/**
 * The social card, 1200×630 — the one image every chat app unfurls.
 *
 * Built from the committed brand wordmark rather than hand-laid text, so the
 * day the wordmark changes this regenerates instead of drifting. The card is
 * the horizontal wordmark on the carbon ground with one muted line under it;
 * the wordmark already carries the six-tile wheel as the O in "on", so the
 * mark and the name arrive together.
 *
 *   node scripts/build-og.mjs
 *
 * Dimensions are asserted from the PNG header, same rule as
 * capture-store.mjs: a card that is off by a pixel fails here, not in a
 * crawler.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { launch } from './lib/browser.mjs';

const OUT = path.resolve('public/og.png');
const W = 1200;
const H = 630;

const run = async () => {
  const svg = await readFile(path.resolve('docs/brand/wordmark-horizontal.svg'), 'utf8');
  const b64 = Buffer.from(svg).toString('base64');
  const html = `<!doctype html><meta charset="utf-8"><style>
    * { margin: 0; }
    body {
      width: ${W}px; height: ${H}px; overflow: hidden;
      background: #07080a;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 8px;
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    /* The wordmark SVG carries its own carbon ground, so it composites
       seamlessly; sized by height and the 2048:1331 ratio takes care of
       the rest. */
    img { height: 400px; }
    p {
      color: #9a9ca0; font-size: 30px; letter-spacing: 0.02em;
      margin-top: -48px; /* the SVG's own ground has generous padding */
    }
  </style>
  <img src="data:image/svg+xml;base64,${b64}" alt="">
  <p>A six-letter word game, one board a day</p>`;

  const browser = await launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: OUT });
  await browser.close();

  const buf = await readFile(OUT);
  const [w, h] = [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  if (w !== W || h !== H) {
    throw new Error(`og.png is ${w}×${h}, wanted ${W}×${H}`);
  }
  await writeFile(OUT, buf);
  process.stdout.write(`og.png ${w}×${h}, ${buf.length} bytes\n`);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
