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

if (failed) {
  console.log(`\n✗ motion regressed in ${failed} place${failed > 1 ? 's' : ''}`);
  process.exit(1);
}
console.log('\n✔ reduced motion removes the movement and keeps the message');
