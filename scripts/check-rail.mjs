/**
 * Does the evidence rail still fit?
 *
 * This rail has been re-fixed on four separate dates — 8/8, 8/10, 8/11, 8/14 —
 * and every fix was verified by measuring once, by hand, at whichever window
 * had just exposed it. A measurement nobody can repeat is not a guard, which
 * is why the fifth regression was always going to arrive the same way as the
 * first four: silently, on a window size that had not been checked.
 *
 * The invariant is one sentence: at every viewport we support, the Streak card
 * is fully visible without scrolling the rail. Streak is the floor of the
 * column and the last thing laid out, so it is what gets cut first — clipping
 * it costs the whole card, where the ladder above it loses height gracefully
 * because it scrolls.
 *
 * The sizes below are not a sample. Each one is a window that actually broke
 * this rail, taken from the commits that fixed it.
 *
 *   node scripts/check-rail.mjs          check
 *   KEEP=1 node scripts/check-rail.mjs   leave the server up for poking
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');

/*
 * Every entry is a window this rail has actually failed at, not a guess at
 * common hardware. 898x586 is the one from ede3ee0 (overflowed 52px, cut
 * Streak by 47); 1900x980 is the maximised-Chrome case from the howTo card
 * comment, wide but short, which a width-only breakpoint let through; 1440x900
 * fitted fine at the time and is here to catch a fix that trades one window
 * for another.
 */
const VIEWPORTS = [
  { w: 898, h: 586, note: 'ede3ee0 — overflowed 52px, Streak cut by 47' },
  { w: 1900, h: 980, note: 'maximised Chrome, wide but short' },
  { w: 1440, h: 900, note: 'fitted before — regression canary' },
  { w: 1280, h: 800, note: 'smallest desktop with the rail' },
  { w: 1512, h: 982, note: 'MacBook Pro 14 default' },
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

/*
 * An isolated userDataDir, not the default one: without it Chrome attaches to
 * the profile a running Chrome already holds a lock on, and the launch hangs
 * until puppeteer times out waiting for a WS endpoint that never appears.
 */
const browser = await launch({
  headless: true,
  userDataDir: path.join(ROOT, 'node_modules', '.cache', 'rail-chrome'),
});
const results = [];

for (const vp of VIEWPORTS) {
  const page = await browser.newPage();
  await page.setViewport({ width: vp.w, height: vp.h });
  await page.goto(`${base}/`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.rail-scroll', { timeout: 10_000 });

  const m = await page.evaluate(() => {
    const rail = document.querySelector('.rail-scroll');
    if (!rail) return { error: 'no .rail-scroll' };
    if (getComputedStyle(rail).display === 'none') return { hidden: true };

    const card = [...rail.querySelectorAll('section')].find(
      (s) => s.querySelector('h2')?.textContent?.trim() === 'Streak',
    );
    if (!card) return { error: 'no Streak card' };

    /*
     * Measured at scrollTop 0 deliberately. The rail CAN scroll — that is what
     * lets the ladder give up height — but Streak sitting below the fold is
     * the exact failure being guarded, so a card you have to scroll to find
     * counts as cut, not as present.
     */
    rail.scrollTop = 0;
    const r = rail.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    return {
      overflow: Math.max(0, rail.scrollHeight - rail.clientHeight),
      cutBy: Math.max(0, Math.round(c.bottom - r.bottom)),
      streakHeight: Math.round(c.height),
    };
  });

  await page.close();

  if (m.hidden) { results.push({ vp, skip: true }); continue; }
  if (m.error) { results.push({ vp, fail: true, why: m.error }); continue; }

  const fail = m.cutBy > 0;
  results.push({ vp, fail, ...m });
}

await browser.close();
server.close();

let failed = 0;
for (const r of results) {
  const label = `${r.vp.w}x${r.vp.h}`.padEnd(10);
  if (r.skip) { console.log(`—  ${label} rail hidden at this width`); continue; }
  if (r.fail) {
    failed++;
    console.log(`✗  ${label} Streak cut by ${r.cutBy ?? '?'}px${r.why ? ` (${r.why})` : ''}  — ${r.vp.note}`);
  } else {
    console.log(`✔  ${label} Streak fully visible (rail overflow ${r.overflow}px)`);
  }
}

if (failed) {
  console.log(`\n✗ rail regressed at ${failed} of ${results.length} viewports`);
  process.exit(1);
}
console.log(`\n✔ rail holds at all ${results.length} viewports`);
