/**
 * Are the letter tiles still the hero, and is the dial still the size it was?
 *
 * The tray and the dial compete for one budget — vertical space — and the
 * comments on `--slot-h` in globals.css record that fight being settled twice
 * by hand. What they do NOT record, because nobody measured it, is that the
 * tile's WIDTH was derived from that same capped height by a `7 / 8` aspect
 * ratio. So a constraint that legitimately governs only the vertical axis was
 * shrinking the horizontal one too, on rows that were using 20–46% of the
 * width available to them. Measured 2026-08-19, full grid, clue mode off:
 *
 *   375x812   tile 22.8 x 26.0   row 157 of 342px   54% of the width unused
 *   768x1024  tile 22.8 x 26.0   row 157 of 592px   74% unused
 *   1280x720  tile 16.6 x 19.0   row 120 of 592px   80% unused
 *
 * The glyph was the visible symptom: `--slot-text` caps at 14px, which is
 * BELOW `--text-body` (15px), so the tile letter could never be as large as
 * the paragraph beside it no matter how tall the screen got.
 *
 * Two invariants, and the second is the whole reason this file exists rather
 * than a one-off measurement:
 *
 *   1. A tile is at least as WIDE as it is TALL. This is the fix, stated so a
 *      future `aspectRatio` cannot quietly undo it.
 *   2. The dial is NOT smaller than it was before the fix. Widening the tile
 *      is only free if it costs the wheel nothing, and "it looked fine" is not
 *      a measurement. The baselines below were captured on main at 9e0d0ba,
 *      the commit before the tile change.
 *
 * Invariant 2 is the one under real threat: every past attempt to give the
 * tray more room took it from the dial, which is the thing you actually drag.
 *
 *   node scripts/check-tiles.mjs            check
 *   node scripts/check-tiles.mjs --probe    print measurements, assert nothing
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');
const PROBE = process.argv.includes('--probe');

/*
 * Chosen to straddle the three sizing branches in globals.css, because the bug
 * is per-branch: the fluid clamp, the `min-width:768 and max-height:800` pin
 * that a landscape iPad lands on, and the `min-width:1280 and min-height:1000`
 * roomy branch. A fix that only moved the fluid ramp would pass a test that
 * sampled phones alone.
 */
const VIEWPORTS = [
  { w: 375, h: 667, note: 'iPhone SE — shortest phone, tightest clamp', dial: 217.9 },
  { w: 390, h: 844, note: 'iPhone 14 — the common case', dial: 235 },
  { w: 430, h: 932, note: 'Pro Max — fluid ramp at its ceiling', dial: 323 },
  { w: 768, h: 1024, note: 'iPad portrait', dial: 340 },
  { w: 1024, h: 768, note: 'iPad landscape — the pinned-short branch', dial: 200 },
  { w: 1280, h: 720, note: 'laptop, short — pinned-short branch', dial: 200 },
  { w: 1440, h: 900, note: 'laptop', dial: 263 },
  { w: 1920, h: 1080, note: 'desktop — the roomy branch', dial: 340 },
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
  userDataDir: path.join(ROOT, 'node_modules', '.cache', 'tiles-chrome'),
});
const results = [];

for (const vp of VIEWPORTS) {
  const page = await browser.newPage();
  await page.setViewport({ width: vp.w, height: vp.h });

  /*
   * Clue mode OFF. This measures the FULL grid — six word-shaped runs of
   * slots — because that is the shape the tiles are the hero of. Clue mode
   * collapses each row to a single length chip, which is a different widget
   * with its own sizing and would hide the regression entirely.
   */
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('ngw-wordy/v2', JSON.stringify({ clueMode: false, seenIntro: true }));
  });
  await page.goto(`${base}/`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-slot]', { timeout: 10_000 });

  const m = await page.evaluate(() => {
    const slots = [...document.querySelectorAll('[data-slot]')];
    if (!slots.length) return { error: 'no [data-slot]' };
    const boxes = slots.map((s) => s.getBoundingClientRect());

    /*
     * The dial is measured from the disc, not from the tile ring: the tiles
     * are positioned INSIDE it and a shrinking disc with unmoved tiles would
     * read as unchanged if we measured the tiles' extent.
     */
    const disc = document.querySelector('.liquid-disc');
    const d = disc ? disc.getBoundingClientRect() : null;

    /*
     * Row extents, to catch the failure mode a width increase actually has:
     * the longest row (six letters) running past the card it sits in.
     */
    const rows = {};
    slots.forEach((s, i) => {
      const k = Math.round(boxes[i].top / 4) * 4;
      (rows[k] = rows[k] || []).push(boxes[i]);
    });
    const card = slots[0].closest('section, article, main') || document.body;
    const cr = card.getBoundingClientRect();
    const widest = Object.values(rows)
      .map((rs) => Math.max(...rs.map((r) => r.right)) - Math.min(...rs.map((r) => r.left)))
      .reduce((a, b) => Math.max(a, b), 0);
    const spill = Object.values(rows).reduce((worst, rs) => {
      const over = Math.max(
        Math.max(...rs.map((r) => r.right)) - cr.right,
        cr.left - Math.min(...rs.map((r) => r.left)),
      );
      return Math.max(worst, over);
    }, -Infinity);

    /*
     * The focus system's one arithmetic invariant: a folded row must free
     * more height than the open rows are allowed to spend.
     *
     * Read from the two declared custom properties rather than re-derived.
     * Re-deriving is precisely what failed: the chip height was a literal in
     * WordTray and the spend was a different literal in globals.css, nothing
     * tied them together, and the first version shipped them as 0 freed and
     * 0.42 spent. The dial went 235 -> 202 over three solves on a phone.
     *
     * Not swept by faking --folded-n: raising that counter without folding
     * the matching rows describes a state the board cannot reach, so it fails
     * for a reason that is not a bug. The numbers are the thing under test.
     */
    /*
     * Does the folded row's WORD actually fit inside the folded row?
     *
     * Built here rather than reasoned about, because reasoning got it wrong
     * once already: the chip was given 0.7 of a row's height while keeping
     * the full --slot-text, and the word hung out of the bottom of the pill
     * on every solved row. That shipped past the numeric checks above, which
     * all passed — the tray height was right, the dial was right, and the
     * text was still outside the box.
     *
     * A real element with the real tokens and the real box model, measured
     * for overflow. Hidden and removed immediately; six letters because the
     * base row is the longest word a chip has to hold.
     */
    const trayEl = document.querySelector('.tray-focus');
    let chipOverflow = null;
    if (trayEl) {
      const probe = document.createElement('span');
      probe.style.cssText = [
        'height: calc(var(--slot-h) * var(--fold-chip))',
        'font-size: calc(var(--slot-text) * var(--fold-glyph))',
        'line-height: 1',
        'border: 1px solid transparent',
        'padding: 0 8px',
        'display: grid',
        'place-items: center',
        'position: absolute',
        'visibility: hidden',
        'box-sizing: border-box',
        'letter-spacing: 0.18em',
      ].join(';');
      probe.textContent = 'CRAFTY';
      trayEl.appendChild(probe);
      chipOverflow = {
        y: probe.scrollHeight - probe.clientHeight,
        x: probe.scrollWidth - probe.clientWidth,
      };
      probe.remove();
    }

    const fold = trayEl
      ? (() => {
          const cs = getComputedStyle(trayEl);
          const chip = parseFloat(cs.getPropertyValue('--fold-chip'));
          const spend = parseFloat(cs.getPropertyValue('--fold-spend'));
          return { chip, spend, freed: +(1 - chip).toFixed(3) };
        })()
      : null;

    return {
      fold,
      chipOverflow,
      tileW: +Math.min(...boxes.map((b) => b.width)).toFixed(1),
      tileH: +Math.min(...boxes.map((b) => b.height)).toFixed(1),
      fontPx: +parseFloat(getComputedStyle(slots[slots.length - 1]).fontSize).toFixed(1),
      bodyPx: +parseFloat(getComputedStyle(document.body).fontSize).toFixed(1),
      dial: d ? +Math.min(d.width, d.height).toFixed(1) : null,
      widestRow: +widest.toFixed(1),
      cardW: +cr.width.toFixed(1),
      spill: +spill.toFixed(1),
      docScrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  await page.close();
  results.push({ vp, ...m });
}

await browser.close();
server.close();

if (PROBE) {
  console.log('probe — no assertions\n');
  for (const r of results) {
    console.log(
      `${`${r.vp.w}x${r.vp.h}`.padEnd(10)} tile ${String(r.tileW).padStart(5)} x ${String(r.tileH).padEnd(5)}` +
        ` font ${String(r.fontPx).padStart(4)}  dial ${String(r.dial).padStart(6)}` +
        `  row ${String(r.widestRow).padStart(6)} of ${String(r.cardW).padEnd(6)} spill ${r.spill}`,
    );
  }
  process.exit(0);
}

let failed = 0;
for (const r of results) {
  const label = `${r.vp.w}x${r.vp.h}`.padEnd(10);
  const why = [];
  if (r.error) why.push(r.error);
  if (r.tileW < r.tileH) why.push(`tile narrower than tall (${r.tileW} x ${r.tileH})`);
  if (r.vp.dial && r.dial < r.vp.dial - 1) why.push(`dial shrank ${r.vp.dial} → ${r.dial}`);
  if (r.spill > 0.5) why.push(`row spills ${r.spill}px past its card`);
  /*
   * The tray may never be TALLER with rows folded than it was with none. That
   * is the whole safety property: the dial shares this budget, so a tray that
   * only ever shrinks cannot take from it.
   */
  if (r.chipOverflow && (r.chipOverflow.y > 0.5 || r.chipOverflow.x > 0.5)) {
    why.push(
      `folded row's word overflows its chip by ${r.chipOverflow.y}px vertically, ${r.chipOverflow.x}px horizontally`,
    );
  }
  if (r.fold) {
    const { chip, spend, freed } = r.fold;
    if (!(spend < freed)) {
      why.push(
        `folding frees ${freed} of a row but open rows spend ${spend} (chip ${chip}) — the tray will grow into the dial`,
      );
    }
  }
  if (r.docScrollX > 0) why.push(`page scrolls horizontally by ${r.docScrollX}px`);

  if (why.length) {
    failed++;
    console.log(`✗  ${label} ${why.join('; ')}  — ${r.vp.note}`);
  } else {
    const sw = r.fold
      ? `, fold frees ${r.fold.freed} spends ${r.fold.spend}`
      : '';
    console.log(
      `✔  ${label} tile ${r.tileW}x${r.tileH} (font ${r.fontPx} vs body ${r.bodyPx}), dial ${r.dial}${sw}`,
    );
  }
}

if (failed) {
  console.log(`\n✗ tiles regressed at ${failed} of ${results.length} viewports`);
  process.exit(1);
}
console.log(`\n✔ tiles hold at all ${results.length} viewports`);
