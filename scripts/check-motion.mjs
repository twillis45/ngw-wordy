/**
 * Does reduced motion still say anything?
 *
 * `prefers-reduced-motion: reduce` used to collapse every animation on the
 * page to 0.01ms. That is the standard blanket rule and it is the right
 * floor, but several animations here are not decoration — they are the only
 * channel a piece of feedback has, and killing them removes information
 * rather than movement.
 *
 * The sharp case is the invalid word. The board rejects it in exactly two
 * ways: a haptic tap, which a desktop does not have, and the shake. With the
 * shake gone, a reduced-motion player on a laptop submits a wrong word and
 * gets nothing back — no way to tell "rejected" from "the key didn't
 * register". This script exists so that cannot silently return.
 *
 * What it asserts, in both media states:
 *
 *   reduce ON  — the signals that carry meaning still animate (non-trivial
 *                duration), and none of them animates by MOVING: no transform
 *                in the substituted keyframes, because translation and scale
 *                are the vestibular triggers the setting is actually about.
 *   reduce OFF — the real animations are intact, so a mistake in the reduced
 *                block cannot quietly become everyone's experience.
 *
 *   node scripts/check-motion.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');

/*
 * Class -> what it tells the player. Only classes that carry INFORMATION are
 * here; rings, sweeps and banners are ornament and keep the blanket kill.
 */
const SIGNALS = [
  { cls: 'anim-shake', says: 'this word was rejected' },
  { cls: 'anim-land', says: 'your letter landed in the row' },
  { cls: 'anim-pop', says: 'the letter registered' },
  { cls: 'anim-rise', says: 'a panel arrived' },
  { cls: 'anim-float', says: 'you scored' },
];

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json',
};

if (!fs.existsSync(OUT)) {
  console.error('✗ no out/ — run `npm run build` first');
  process.exit(2);
}

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(OUT, p);
  if (!file.startsWith(OUT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const browser = await launch({
  headless: true,
  userDataDir: path.join(ROOT, 'node_modules', '.cache', 'motion-chrome'),
});

const probe = async (reduce) => {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.emulateMediaFeatures([
    { name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' },
  ]);
  await page.goto(`${base}/`, { waitUntil: 'networkidle0' });
  const out = await page.evaluate((classes) => {
    /*
     * Measured on a real element in the real document, not by reading the
     * stylesheet: the blanket `*` rule and the per-class override are both
     * !important, so which one applies is a cascade question, and the cascade
     * is exactly the thing that could be got wrong.
     */
    const seen = {};
    for (const cls of classes) {
      const el = document.createElement('div');
      el.className = cls;
      el.style.cssText = 'position:absolute;visibility:hidden;width:20px;height:20px';
      document.body.appendChild(el);
      const cs = getComputedStyle(el);
      const name = cs.animationName;
      const ms = (() => {
        const d = cs.animationDuration.split(',')[0].trim();
        return d.endsWith('ms') ? parseFloat(d) : parseFloat(d) * 1000;
      })();
      // Does the resolved keyframe move anything?
      let moves = false;
      for (const sheet of document.styleSheets) {
        let rules;
        try { rules = sheet.cssRules; } catch { continue; }
        const walk = (list) => {
          for (const r of list) {
            if (r.cssRules && !r.name) walk(r.cssRules);
            if (r.name && r.name === name) {
              for (const k of r.cssRules) {
                const t = k.style.transform;
                if (t && /translate|scale|rotate/.test(t)) moves = true;
              }
            }
          }
        };
        walk(rules);
      }
      seen[cls] = { name, ms, moves };
      el.remove();
    }
    return seen;
  }, SIGNALS.map((s) => s.cls));
  await page.close();
  return out;
};

/*
 * The dial's counter-rotation contract.
 *
 * Three rotations share this one object: the tile's `transform` is the
 * parallax, the ring's `transform` is the detent (a sixth of a turn per
 * solved row), and the glyph's `rotate` cancels the detent so the letter
 * arrives upright. Get the last one wrong and every letter on the wheel lies
 * on its side the moment a row is solved — a failure that cannot happen on a
 * fresh board, so it would ship.
 *
 * What this asserts is the STRUCTURE that makes it work: a glyph element
 * exists inside every tile, and the ring's angle and the glyph's angle cancel.
 * It deliberately does not play a board — which word is solvable depends on
 * the date's puzzle — so the dynamic behaviour (60deg per solve, verified at
 * 0/1/2/3 rows) is checked by hand rather than here. This catches the
 * regression that is actually likely: the glyph wrapper being removed or its
 * class renamed, which silently breaks the shuffle counter too.
 */
const dial = await (async () => {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${base}/`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-wheel-tile]');
  const r = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('[data-wheel-tile]')];
    const glyphs = tiles.map((t) => t.querySelector('.dial-glyph')).filter(Boolean);
    const deg = (m) => {
      const t = m.match(/matrix\(([-0-9.]+),\s*([-0-9.]+)/);
      return t ? Math.atan2(+t[2], +t[1]) * 180 / Math.PI : 0;
    };
    const ring = tiles[0]?.parentElement?.parentElement;
    const ringDeg = ring ? deg(getComputedStyle(ring).transform) : null;
    /*
     * The TILE carries the detent counter, not the glyph. It was on the glyph
     * first, and that left the tiles themselves tumbling: at one detent they
     * sat at 60deg with upright letters inside, which a rounded square reads
     * as a lopsided diamond. The glyph keeps only the transient shuffle
     * counter, which is an animation and so is not measurable at rest.
     */
    const tileDeg = tiles[0] ? parseFloat(getComputedStyle(tiles[0]).rotate || '0') : null;
    return { tiles: tiles.length, glyphs: glyphs.length, ringDeg, tileDeg };
  });
  await page.close();
  return r;
})();

const on = await probe(true);
const off = await probe(false);
await browser.close();
server.close();

let failed = 0;
console.log('reduced motion ON — the signal must survive, without moving\n');
for (const { cls, says } of SIGNALS) {
  const r = on[cls];
  const why = [];
  if (r.ms < 40) why.push(`silenced (${r.ms}ms) — "${says}" has no other channel`);
  if (r.moves) why.push(`still moves (${r.name}) — translation is the thing the setting asks to remove`);
  if (why.length) { failed++; console.log(`✗  .${cls.padEnd(12)} ${why.join('; ')}`); }
  else console.log(`✔  .${cls.padEnd(12)} ${r.name} ${r.ms}ms, no movement — "${says}"`);
}

console.log('\nreduced motion OFF — the real animations must be intact\n');
for (const { cls } of SIGNALS) {
  const r = off[cls];
  if (r.ms < 40) { failed++; console.log(`✗  .${cls.padEnd(12)} only ${r.ms}ms — the reduced rule is leaking into everyone`); }
  else console.log(`✔  .${cls.padEnd(12)} ${r.name} ${r.ms}ms`);
}

console.log('\nthe dial — the detent and its counter-rotation\n');
if (dial.glyphs !== dial.tiles || dial.tiles === 0) {
  failed++;
  console.log(`✗  ${dial.glyphs} of ${dial.tiles} wheel tiles carry a .dial-glyph — without it the letters turn with the ring`);
} else if (Math.abs((dial.ringDeg ?? 0) + (dial.tileDeg ?? 0)) > 2) {
  failed++;
  console.log(`✗  ring at ${dial.ringDeg?.toFixed(1)}deg, tile at ${dial.tileDeg}deg — these must cancel or the tiles tumble as the dial advances`);
} else {
  console.log(`✔  ${dial.tiles} tiles upright (ring ${(dial.ringDeg ?? 0).toFixed(0)}deg cancelled by tile ${dial.tileDeg}deg), ${dial.glyphs} glyphs ready for the shuffle counter`);
}

if (failed) {
  console.log(`\n✗ motion regressed in ${failed} place${failed > 1 ? 's' : ''}`);
  process.exit(1);
}
console.log('\n✔ reduced motion removes the movement and keeps the message');
