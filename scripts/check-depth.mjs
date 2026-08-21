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

/*
 * EVERY PANEL, not just the cards on the board.
 *
 * "Panels that launch" are the sheets, and they are the half most likely to be
 * missed: they only exist once something is clicked, so a guard that measures
 * the resting page never sees them at all. Each one is opened by its own real
 * control and measured while it is up.
 */
const PANELS = [
  { label: 'Puzzles', open: 'Puzzles and themes' },
  { label: 'How to play', open: 'How to play' },
  { label: 'Your progress', open: 'Rank and progress details' },
];

const measured = [];

const grabCards = () => page.evaluate(() => {
  const theme = document.documentElement.getAttribute('data-theme');
  const out = [];
  for (const s of document.querySelectorAll('section.liquid')) {
    const h2 = s.querySelector('h2');
    if (!h2 || !s.offsetParent) continue;
    const b = s.getBoundingClientRect();
    if (b.width < 120 || b.height < 60) continue;
    out.push({ name: h2.textContent.trim(), kind: 'card',
      x: Math.round(b.left + 20), w: Math.round(b.width - 40),
      top: Math.round(b.top), mid: Math.round(b.top + Math.min(40, b.height / 2)) });
  }
  return { theme, out };
});

const cards = await grabCards();
measured.push(...cards.out);

for (const panel of PANELS) {
  const opened = await page.evaluate((aria) => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      (x.getAttribute('aria-label') ?? '').includes(aria));
    if (!b) return false;
    b.click();
    return true;
  }, panel.open);
  if (!opened) { measured.push({ name: panel.label, kind: 'panel', missing: true }); continue; }
  await new Promise((r) => setTimeout(r, 500));
  const box = await page.evaluate(() => {
    const d = document.querySelector('[role=dialog]');
    if (!d) return null;
    const el = [...d.children].find((c) => c.classList.contains('liquid')) ?? d.firstElementChild;
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.left + 30), w: Math.round(b.width - 60),
      top: Math.round(b.top), mid: Math.round(b.top + Math.min(50, b.height / 2)) };
  });
  if (box) measured.push({ name: panel.label, kind: 'panel', ...box });
  else measured.push({ name: panel.label, kind: 'panel', missing: true });
  // Screenshot while it is UP, then close for the next one.
  const shot = await page.screenshot({ type: 'png' });
  measured[measured.length - 1].shot = shot;
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 400));
}

/*
 * THE DIAL, checked as a live selector match rather than as pixels.
 *
 * `div:has(> .liquid-disc) > button` matched nothing from the day the dial
 * gained its ring wrappers, and nothing complained: a selector that matches
 * nothing throws no error and reads as "the defaults look fine". The tiles
 * quietly fell back to `.liquid-raised` and lost both their fill and their
 * lift, and the CSS kept describing ratios for a rule that had not run in
 * weeks.
 *
 * So this asserts the match itself, which is the thing that broke — plus the
 * two facts that depend on it: the tiles are the same material as the wheel,
 * and they are lifted with the TILE value rather than the panel one.
 */
const dial = await page.evaluate(() => {
  const tile = [...document.querySelectorAll('button')]
    .find((b) => /tile 1 of 6/.test(b.getAttribute('aria-label') ?? ''));
  const disc = document.querySelector('.liquid-disc');
  if (!tile || !disc) return { missing: true };
  const t = getComputedStyle(tile);
  return {
    matches: tile.matches('div:has(> .liquid-disc) button.rounded-2xl'),
    tileBg: t.backgroundColor,
    discBg: getComputedStyle(disc).backgroundColor,
    tileLift: t.boxShadow.includes('0.17'),
  };
});

const dialChecks = dial.missing
  ? [['dial', false, 'no dial on the page to measure']]
  : [
      /*
       * This tests the DOM SHAPE, not the stylesheet — it stayed green while
       * the CSS was broken, because it matches its own hardcoded string rather
       * than asking whether the rule applied. Kept because a shape change is
       * the thing that breaks the rule, and named for what it actually checks.
       * The two below are what catch the breakage itself.
       */
      ['dial shape', dial.matches, 'the dial no longer has the shape the CSS targets'],
      ['tile fill', dial.tileBg === dial.discBg,
        `tile ${dial.tileBg} does not match the wheel ${dial.discBg}`],
      ['tile lift', dial.tileLift, 'tiles lost --raise-light-tile to a broader rule'],
    ];

const baseShot = await page.screenshot({ type: 'png' });
await browser.close();
server.close();

const decode = async (buf) => {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  return { data, info };
};
const baseImg = await decode(baseShot);

const lumRow = (img, x, w, y) => {
  const { data, info } = img;
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
for (const c of measured) {
  if (c.missing) {
    bad++;
    console.log(`✗  ${c.name.padEnd(16)} ${c.kind} never opened — cannot be measured`);
    continue;
  }
  const img = c.shot ? await decode(c.shot) : baseImg;
  // +1 clears the border itself; the lit edge is the pixel just inside it.
  const edge = lumRow(img, c.x, c.w, c.top + 1);
  const body = lumRow(img, c.x, c.w, c.mid);
  const lift = edge - body;
  const ok = lift >= MIN_EDGE_LIFT;
  if (!ok) bad++;
  console.log(`${ok ? '✔' : '✗'}  ${c.name.padEnd(16)} ${c.kind.padEnd(5)} top edge ${lift >= 0 ? '+' : ''}${lift.toFixed(1)} over its own face`);
}
for (const [name, ok, why] of dialChecks) {
  if (!ok) bad++;
  console.log(`${ok ? '✔' : '✗'}  ${name.padEnd(16)} ${ok ? 'holds' : why}`);
}

if (bad) {
  console.log(`\n✖ studio has gone flat: ${bad} of ${measured.length} surfaces have no lit edge`);
  process.exit(1);
}
console.log(`\n✔ studio sits on the page — ${measured.length} surfaces lit, dial matches the wheel`);
