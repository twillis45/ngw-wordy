/*
 * Studio's panels must sit ON the page, not be printed on it.
 *
 * Studio Matte turns off every glass token — specular, caustic, rim light,
 * backdrop blur — and that is correct, it is a matte system. But the theme
 * also owns a MATTE way of raising an object, `--raise-light` over
 * `--raise-shadow`, and for a long time only the dial used it. Cards and
 * sheets were a fill inside a hairline: measured, a panel sat at 1.08:1
 * against its own ground where the same panel in dark is 1.32:1, so the border
 * carried all of the identification and the surface carried none.
 *
 * This measures the EFFECT, not the declaration. A token test would have
 * passed throughout — every glass token was correctly transparent, and that
 * was the whole problem. So: a lifted card has a top edge lighter than its own
 * interior, and that is a fact about pixels.
 *
 * The de-blue of 2026-08-17 was written down, reasoned out, and undone by
 * accumulation because nothing re-checked it. This is the re-check.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './lib/browser.mjs';
import sharp from 'sharp';

const ROOT = path.dirname(fileURLToPath(import.meta.url)).replace(/\/scripts$/, '');
const OUT = path.join(ROOT, 'out');
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
  '.webmanifest':'application/manifest+json', '.ico':'image/x-icon', '.woff2':'font/woff2' };

/*
 * 1.5/255 of luminance across the top edge. Deliberately small: the point is
 * that the edge EXISTS, and --raise-light is 0.085 white over a near-black
 * panel, which is a couple of levels and no more. Anything at zero is the
 * flat card this guard was written for.
 */
const MIN_EDGE_LIFT = 1.5;

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
  userDataDir: path.join(ROOT, 'node_modules', '.cache', 'depth-chrome'),
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
await page.goto(`${base}/`, { waitUntil: 'networkidle0' });
// The app's own switch, not a hand-set attribute — React resets the element.
await page.evaluate(() => localStorage.setItem('ngw-wordy/theme', 'studio'));
await page.reload({ waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 700));

const cards = await page.evaluate(() => {
  const theme = document.documentElement.getAttribute('data-theme');
  const out = [];
  for (const s of document.querySelectorAll('section.liquid')) {
    const h2 = s.querySelector('h2');
    if (!h2 || !s.offsetParent) continue;
    const b = s.getBoundingClientRect();
    if (b.width < 120 || b.height < 60) continue;
    out.push({ name: h2.textContent.trim(),
      x: Math.round(b.left + 20), w: Math.round(b.width - 40),
      top: Math.round(b.top), mid: Math.round(b.top + Math.min(40, b.height / 2)) });
  }
  return { theme, out };
});

const shot = await page.screenshot({ type: 'png' });
const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
await browser.close();
server.close();

const lumRow = (x, w, y) => {
  let sum = 0, n = 0;
  for (let xx = x; xx < x + w; xx++) {
    if (xx < 0 || y < 0 || xx >= info.width || y >= info.height) continue;
    const i = (y * info.width + xx) * info.channels;
    sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; n++;
  }
  return n ? sum / n : null;
};

if (cards.theme !== 'studio') {
  console.log(`✖ studio did not apply — data-theme is "${cards.theme}"`);
  process.exit(1);
}

let bad = 0;
for (const c of cards.out) {
  // +1 clears the border itself; the lit edge is the pixel just inside it.
  const edge = lumRow(c.x, c.w, c.top + 1);
  const body = lumRow(c.x, c.w, c.mid);
  const lift = edge - body;
  const ok = lift >= MIN_EDGE_LIFT;
  if (!ok) bad++;
  console.log(`${ok ? '✔' : '✗'}  ${c.name.padEnd(14)} top edge ${lift >= 0 ? '+' : ''}${lift.toFixed(1)} over its own face`);
}
if (bad) {
  console.log(`\n✖ studio panels have gone flat: ${bad} of ${cards.out.length} have no lit edge`);
  process.exit(1);
}
console.log(`\n✔ studio panels sit on the page — every card has a lit top edge`);
