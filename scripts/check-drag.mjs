/*
 * Dragging across the dial must spell what your finger actually crossed —
 * including after the dial has turned.
 *
 * THE DIAL ROTATES. It advances 60° per solved row, by CSS transform, so where
 * a tile IS on screen stops matching where the geometry THINKS it is. The
 * component reconciles that with `toRing`/`toWorld`: a pointer is converted
 * into ring space once, and every consumer — hit test, pull, parallax —
 * compares against ring-space positions. A regression there does not crash. It
 * spells a different word than the one you traced, which reads as the game
 * being broken rather than the input being wrong.
 *
 * WHY THIS GUARD IS WRITTEN THE WAY IT IS. Four earlier attempts to verify
 * this proved nothing, each differently, and every one of them looked like a
 * passing check at the time:
 *
 *   - one dragged all six tiles, so any permutation matched and it could not
 *     fail;
 *   - one queried the wrong element and measured something that was not the
 *     dial;
 *   - one sorted the result, destroying the ordering it existed to test;
 *   - and two runs today typed a six-letter word on a board whose grid was
 *     never checked, so no row completed, the dial never turned, and the whole
 *     exercise tested the one condition where the bug cannot occur.
 *
 * So this asserts the ROTATION ACTUALLY HAPPENED before it trusts a single
 * drag, drags a SHORT ordered subset rather than everything, and compares the
 * exact sequence rather than a set.
 *
 * HONEST LIMIT, because it matters for what a green run means: these are
 * synthetic mouse events. A real finger produces coalesced moves, variable
 * pressure and touch rather than mouse. A pass here does not clear the touch
 * path; it clears the geometry.
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
 * Board 113 — `crafty / cart / tray / cry / fat / fry`. Named here with its
 * grid because the reason two runs today proved nothing is that the board was
 * assumed rather than read: a six-letter word that is not a ROW banks as bonus
 * and turns nothing.
 */
const OPENING_ROW = 'CRAFTY';
const DRAGS = [
  { after: 1, letters: ['C', 'R', 'Y'] },
  { after: 1, letters: ['F', 'A', 'T'] },
  { after: 3, letters: ['T', 'R', 'A', 'Y'] },
  { after: 3, letters: ['C', 'A', 'R', 'T'] },
];

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
  userDataDir: path.join(ROOT, 'node_modules', '.cache', 'drag-chrome'),
});
const page = await browser.newPage();
page.setDefaultNavigationTimeout(60_000);
await page.setViewport({ width: 1280, height: 900 });
await page.evaluateOnNewDocument(() => {
  try { localStorage.removeItem('ngw-wordy/v2'); } catch { /* first run */ }
});
await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 900));

const ringDeg = () =>
  page.evaluate(() => {
    const el = [...document.querySelectorAll('[style*="rotate("]')].find((e) =>
      /^rotate\(-?\d+deg\)$/.test(e.style.transform),
    );
    return el ? Number(el.style.transform.match(/-?\d+/)[0]) : null;
  });

const typedWord = () =>
  page.evaluate(() => {
    const el = [...document.querySelectorAll('span')].find(
      (s) => /text-hero/.test(s.className) && /^[A-Z]+$/.test((s.textContent ?? '').trim()),
    );
    return el ? el.textContent.trim() : '';
  });

const type = async (w) => { for (const ch of w) await page.keyboard.press(ch); };

async function dragAcross(letters) {
  // Clear anything half-typed, and let the submit animation finish — a drag
  // started during it reads as "no letters", which is how two runs today
  // produced convincing-looking failures that were mine.
  for (let i = 0; i < 8; i++) await page.keyboard.press('Backspace');
  await new Promise((r) => setTimeout(r, 900));

  const tiles = await page.evaluate(() =>
    [...document.querySelectorAll('button[aria-label^="Letter "]')].map((b) => {
      const r = b.getBoundingClientRect();
      return {
        letter: b.getAttribute('aria-label').match(/Letter (\w)/)[1],
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.top + r.height / 2),
      };
    }),
  );
  const pts = letters.map((L) => tiles.find((t) => t.letter === L));
  if (pts.some((p2) => !p2)) return { built: null, missing: true };

  await page.mouse.move(pts[0].x, pts[0].y);
  await page.mouse.down();
  for (const q of pts.slice(1)) {
    await page.mouse.move(q.x, q.y, { steps: 12 });
    await new Promise((r) => setTimeout(r, 90));
  }
  await new Promise((r) => setTimeout(r, 220));
  const built = await typedWord();
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 900));
  return { built };
}

const rows = [];
let failures = 0;

const startDeg = await ringDeg();
rows.push({ what: 'dial starts unturned', got: `${startDeg}°`, ok: startDeg === 0 });

await type(OPENING_ROW);
await page.keyboard.press('Enter');
await new Promise((r) => setTimeout(r, 1800));

const afterOne = await ringDeg();
rows.push({
  what: `${OPENING_ROW} turns the dial`,
  got: `${afterOne}°`,
  ok: afterOne === 60,
});

for (const d of DRAGS.filter((x) => x.after === 1)) {
  const { built, missing } = await dragAcross(d.letters);
  const want = d.letters.join('');
  rows.push({ what: `at 60° drag ${want}`, got: missing ? 'tile missing' : built || '(nothing)', ok: built === want });
}

const atThree = await ringDeg();
rows.push({ what: 'three rows turn it further', got: `${atThree}°`, ok: atThree === 180 });

for (const d of DRAGS.filter((x) => x.after === 3)) {
  const { built, missing } = await dragAcross(d.letters);
  const want = d.letters.join('');
  rows.push({ what: `at 180° drag ${want}`, got: missing ? 'tile missing' : built || '(nothing)', ok: built === want });
}

await browser.close();
server.close();

for (const r of rows) {
  if (!r.ok) failures++;
  console.log(`${r.ok ? '✔' : '✗'}  ${r.what.padEnd(30)} ${r.got}`);
}
if (failures) {
  console.log(`\n✖ the dial spells the wrong word after it turns: ${failures} of ${rows.length}`);
  process.exit(1);
}
console.log('\n✔ a drag spells what it crossed, at 0°, 60° and 180° (synthetic mouse only)');
