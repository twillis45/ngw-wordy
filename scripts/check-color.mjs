/*
 * The dark theme must stay neutral carbon.
 *
 * The de-blue of 2026-08-17 neutralised the carbon ramp to a flat b-r=+3 and
 * wrote down why, and then nothing re-checked it — so the value survived and
 * the RESULT did not. Cards are painted with `liquid`, which is
 * `--glass-body`: 22% steel over the panel. Steel is #4e6877, b-r=+41, so
 * every card composited to roughly +11 while the token it sat on was +3, and
 * backdrop-saturate 1.8 amplified the difference rather than hiding it.
 *
 * That is why this measures PIXELS and not custom properties. Reading tokens
 * would have passed the whole time: each one was individually correct. The
 * blue only exists once the layers are composited — glass over panel over
 * ambient pool, through a saturate filter — which is a thing only the renderer
 * knows.
 *
 * b-r on the composited pixel is the whole metric. Positive is cool, negative
 * is warm, and the recorded preference for this system is "most of the blue
 * removed (blue ~3 over red), still a hair warm-cool-balanced, never steel."
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
 * TWO thresholds, because the ground and the cards are different materials.
 *
 * The page ground is the carbon ramp with nothing composited over it, so it
 * should read the ramp's own documented value: +3. The cards are glass over
 * ambient through a saturate filter, and their honest floor is around +4.7 —
 * antialiased text, rim highlights and the pools all bleed a little colour
 * into any region large enough to average.
 *
 * One shared +6 let a real regression through. The guard-mutation harness
 * reverted a SINGLE ambient pool to steel and check-color passed: ground moved
 * +3.0 -> +4.2 and every card stayed put, all of it under +6. I had red-proofed
 * this guard by reverting all five substitutions at once, which fails loudly
 * and proves less than it looks — a guard that only catches the whole fix being
 * undone does not catch drift, and drift is the actual failure mode here. The
 * ramp is measured against its own number now.
 */
const GROUND_MAX = 3.6;
const CARD_MAX = 6;

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
  userDataDir: path.join(ROOT, 'node_modules', '.cache', 'color-chrome'),
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto(`${base}/`, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
await new Promise((r) => setTimeout(r, 700));

/*
 * Sample the CARDS, by their own boxes, rather than fixed coordinates. A
 * hardcoded rectangle silently starts measuring something else the first time
 * the layout moves, which is the failure this whole file exists because of.
 * The inset skips each card's rim, which is deliberately light and would drag
 * a small sample cool on its own.
 */
/*
 * Sample only pixels the CARD ITSELF paints.
 *
 * The first version of this took a fixed rectangle inside each card, which
 * quietly measured whatever happened to sit there — day-cell chips, tabular
 * figures, antialiased text — and reported their colour as the card's. It sent
 * me to de-blue a specular token that turned out to touch none of those
 * pixels: the numbers did not move at all.
 *
 * So each point is hit-tested, and only the ones where the section is itself
 * the topmost element count. That is the material, with nothing on top of it.
 */
const regions = await page.evaluate(() => {
  const pick = (el, name) => {
    const b = el.getBoundingClientRect();
    const pts = [];
    for (let y = Math.round(b.top) + 6; y < b.bottom - 6; y += 3) {
      for (let x = Math.round(b.left) + 6; x < b.right - 6; x += 3) {
        if (document.elementFromPoint(x, y) === el) pts.push([x, y]);
      }
    }
    return { name, pts };
  };
  const out = [];
  const bodyEl = document.body;
  out.push(pick(bodyEl, 'page ground'));
  for (const s of document.querySelectorAll('section')) {
    const h2 = s.querySelector('h2');
    if (!h2 || !s.offsetParent) continue;
    const b = s.getBoundingClientRect();
    if (b.width < 80 || b.height < 60) continue;
    out.push(pick(s, `card: ${h2.textContent.trim()}`));
  }
  return out.filter((r) => r.pts.length >= 40);
});

const shot = await page.screenshot({ type: 'png' });
const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });

const read = (pts) => {
  let r = 0, g = 0, b = 0, n = 0;
  for (const [x, y] of pts) {
    if (x < 0 || y < 0 || x >= info.width || y >= info.height) continue;
    const i = (y * info.width + x) * info.channels;
    r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
  }
  return n ? { r: r / n, g: g / n, b: b / n, n } : null;
};

const rows = regions.map((rg) => {
  const px = read(rg.pts);
  return { name: rg.name, ...px, br: px ? px.b - px.r : null };
});

await browser.close();
server.close();

let bad = 0;
for (const t of rows) {
  const limit = t.name === 'page ground' ? GROUND_MAX : CARD_MAX;
  const ok = t.br !== null && t.br <= limit;
  if (!ok) bad++;
  console.log(
    `${ok ? '✔' : '✗'}  ${t.name.padEnd(22)} b-r ${t.br === null ? 'n/a' : (t.br >= 0 ? '+' : '') + t.br.toFixed(1)}` +
    `  (limit +${limit}, rgb ${t.r?.toFixed(0)}, ${t.g?.toFixed(0)}, ${t.b?.toFixed(0)})`
  );
}
if (bad) {
  console.log(`\n✖ dark theme has drifted cool: ${bad} of ${rows.length} regions over their limit`);
  process.exit(1);
}
console.log(`\n✔ dark stays neutral carbon — ground at the ramp's +3, cards under +${CARD_MAX}`);
