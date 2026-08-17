/**
 * Store listing screenshots, at the exact pixel sizes the stores accept.
 *
 * STORE_READINESS 2.3 and 2.5. Separate from capture-review.mjs on purpose:
 * that one shoots seven viewports × six states for the BOARD to review, and
 * none of its sizes is a store size. This shoots few states at exact
 * dimensions, because the constraint here is upload validation rather than
 * design coverage.
 *
 * THE DIMENSIONS ARE ASSERTED, not assumed. App Store Connect rejects a
 * screenshot that is a single pixel off, and it rejects it after the upload,
 * at the end of a filing session. A deviceScaleFactor that silently rounds —
 * an odd CSS width at 3x is the usual way — produces a plausible-looking PNG
 * that fails there instead of here. So every shot is measured from its own
 * PNG header and the run fails loudly on a mismatch.
 *
 * Shoots the PRODUCTION export, like the review harness:
 *
 *   npm run build && npx serve -s out -l 4310
 *   node scripts/capture-store.mjs http://localhost:4310
 *
 * Apple's required set moves — it has changed twice in two years, and
 * STORE_READINESS 3.3 already warns that store minimums are checked at build
 * time rather than trusted from memory. The three iPhone classes below are the
 * ones currently accepted; CONFIRM against App Store Connect before filing and
 * add a row here rather than resizing a PNG by hand.
 */
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { launch } from './lib/browser.mjs';

const BASE = process.argv[2] || 'http://localhost:4310';
const OUT = path.resolve('store/screenshots');

/** css × dsf must land EXACTLY on the store pixel size. */
const TARGETS = [
  { name: 'apple-6.9', width: 440, dsf: 3, height: 956, expect: [1320, 2868] },
  { name: 'apple-6.7', width: 430, dsf: 3, height: 932, expect: [1290, 2796] },
  { name: 'apple-6.5', width: 414, dsf: 3, height: 896, expect: [1242, 2688] },
  // Play: 9:16, min 320px, max 3840px on any side.
  { name: 'play-phone', width: 360, dsf: 3, height: 640, expect: [1080, 1920] },
];

const KEY = 'ngw-wordy/v2';
const settle = (ms = 900) => new Promise((r) => setTimeout(r, ms));

/** Read width/height straight from the PNG IHDR — no image library needed. */
async function pngSize(file) {
  const buf = await readFile(file);
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

async function shot(page, file, expect) {
  await page.screenshot({ path: file });
  const [w, h] = await pngSize(file);
  const ok = w === expect[0] && h === expect[1];
  process.stdout.write(
    `  ${path.basename(file).padEnd(34)} ${w}×${h}` +
      (ok ? '  ok\n' : `  MISMATCH — store wants ${expect[0]}×${expect[1]}\n`)
  );
  return ok;
}

/**
 * Solve rows on WHATEVER board is up today, and prove it worked.
 *
 * The first version typed a hardcoded CAFE / CUT / ACE / FACE. The daily
 * rotates, so on a wheel of A C Y T F R every one of them was rejected and the
 * harness cheerfully shot a store screenshot reading "Not a word" in red over
 * an empty 0/6 grid. capture-review.mjs already learned this lesson once, in
 * its own words: a capture harness that silently shoots the wrong screen is
 * worse than one that fails.
 *
 * So the words come from the board being displayed — matched out of the
 * shipped puzzle file by its letters — and the row counter has to move.
 */
async function solveSome(page, puzzles, want = 4) {
  const letters = await page.$$eval('button', (bs) =>
    bs
      .map((b) => (b.textContent || '').trim())
      .filter((t) => /^[A-Za-z]$/.test(t))
      .map((t) => t.toLowerCase())
  );
  if (letters.length !== 6) throw new Error(`read ${letters.length} wheel letters, expected 6`);

  const key = [...letters].sort().join('');
  const puzzle = puzzles.find((p) => [...p.letters].sort().join('') === key);
  if (!puzzle) throw new Error(`no puzzle in the shipped file for wheel "${key}"`);

  const before = await rowsSolved(page);
  // Shortest first: more rows filled for the same number of keystrokes, and it
  // leaves the six-letter base unsolved so the board still reads as in-play.
  const words = [...puzzle.grid]
    .filter((w) => w !== puzzle.base)
    .sort((a, b) => a.length - b.length)
    .slice(0, want);

  for (const w of words) {
    for (const ch of w) await page.keyboard.press(ch.toUpperCase());
    await page.keyboard.press('Enter');
    await settle(300);
  }

  const after = await rowsSolved(page);
  if (after <= before) {
    throw new Error(
      `played ${words.join(', ')} on wheel "${key}" and the grid did not move ` +
        `(${before} → ${after}) — refusing to ship a screenshot of a failed board`
    );
  }
  return after;
}

/** Read the "N/6 rows" counter out of the page. */
function rowsSolved(page) {
  return page.evaluate(() => {
    const m = document.body.innerText.match(/(\d+)\s*\/\s*6\s*rows/i);
    return m ? Number(m[1]) : 0;
  });
}

const run = async () => {
  await mkdir(OUT, { recursive: true });
  const puzzles = JSON.parse(
    await readFile(path.resolve('public/data/puzzles.json'), 'utf8')
  ).puzzles;
  const browser = await launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });

  let bad = 0;
  for (const t of TARGETS) {
    process.stdout.write(`\n${t.name}  (${t.width}×${t.height} @${t.dsf}x)\n`);
    const page = await browser.newPage();
    await page.setViewport({
      width: t.width,
      height: t.height,
      deviceScaleFactor: t.dsf,
      isMobile: true,
      hasTouch: true,
    });

    // A store screenshot should show the product working, not an empty board.
    await page.evaluateOnNewDocument((k) => localStorage.removeItem(k), KEY);
    await page.goto(BASE, { waitUntil: 'networkidle0' });
    await settle();
    if (!(await shot(page, path.join(OUT, `${t.name}__1-board.png`), t.expect))) bad++;

    const solved = await solveSome(page, puzzles);
    process.stdout.write(`    solved ${solved}/6 rows\n`);
    if (!(await shot(page, path.join(OUT, `${t.name}__2-solving.png`), t.expect))) bad++;

    await page.evaluate(() =>
      document.documentElement.setAttribute('data-theme', 'light')
    );
    await settle(500);
    if (!(await shot(page, path.join(OUT, `${t.name}__3-light.png`), t.expect))) bad++;

    await page.close();
  }

  await browser.close();

  if (bad) {
    process.stdout.write(`\n${bad} screenshot(s) at the wrong size — not fileable.\n`);
    process.exit(1);
  }
  process.stdout.write(`\nAll shots at store dimensions. Wrote to ${OUT}\n`);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
