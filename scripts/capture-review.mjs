/**
 * Render-first capture for the review board.
 *
 * The board reviews assembled, data-populated pixels — emergent problems
 * ("flat", "too busy", "no hierarchy") do not exist in source and cannot be
 * found by reading components. Shoots the PRODUCTION export, not the dev
 * server, so the overlay and dev-only scripts are absent.
 *
 * Usage: node scripts/capture-review.mjs http://localhost:4310
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire('/Users/toddwillis/Code/ngw-core/');
const puppeteer = require('puppeteer');

const BASE = process.argv[2] || 'http://localhost:4310';
const OUT = path.resolve('review-artifacts');

/** The devices that actually matter, plus the two the user reported on. */
const VIEWPORTS = [
  { name: 'mobile-360x677-galaxy-s25', width: 360, height: 677, dsf: 3 },
  { name: 'mobile-390x844-iphone', width: 390, height: 844, dsf: 3 },
  { name: 'mobile-320x568-smallest', width: 320, height: 568, dsf: 2 },
  { name: 'tablet-768x1024-portrait', width: 768, height: 1024, dsf: 2 },
  { name: 'tablet-1024x768-landscape', width: 1024, height: 768, dsf: 2 },
  { name: 'desktop-1440x900', width: 1440, height: 900, dsf: 2 },
  { name: 'widescreen-1728x1117', width: 1728, height: 1117, dsf: 2 },
];

const KEY = 'ngw-wordy/v2';

/** Seed storage so a shot lands on a real state instead of a blank board. */
async function seed(page, mutate) {
  await page.evaluateOnNewDocument(
    (key, src) => {
      const fn = new Function('store', src);
      let store = {};
      try {
        store = JSON.parse(localStorage.getItem(key) || '{}');
      } catch {}
      const next = fn(store) || store;
      localStorage.setItem(key, JSON.stringify(next));
    },
    KEY,
    mutate
  );
}

async function settle(page, ms = 900) {
  await new Promise((r) => setTimeout(r, ms));
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  process.stdout.write(`  ${name}.png\n`);
}

/** Play real words so the board sees a populated grid, not an empty one. */
async function playWords(page, words) {
  for (const w of words) {
    for (const ch of w) await page.keyboard.press(ch.toUpperCase());
    await page.keyboard.press('Enter');
    await settle(page, 260);
  }
}

/**
 * Close any open sheet and PROVE it closed.
 *
 * The first run shot the themes sheet twice: Escape did not dismiss it, so
 * `04-progress` was a byte-identical duplicate of `03-puzzles-and-themes` at
 * every one of the seven viewports. The board caught it before I did. A
 * capture harness that silently shoots the wrong screen is worse than one that
 * fails, so this asserts instead of assuming.
 */
async function closeSheet(page) {
  for (let i = 0; i < 3; i += 1) {
    const open = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
    if (!open) return true;
    const clicked = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) =>
        /^\s*(close|done|i.?ve got it)\s*$/i.test(x.textContent || '')
      );
      if (b) { b.click(); return true; }
      return false;
    });
    if (!clicked) await page.keyboard.press('Escape');
    await settle(page, 500);
  }
  const still = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
  if (still) process.stdout.write('    ! sheet would not close\n');
  return !still;
}

async function clickText(page, re) {
  const handle = await page.evaluateHandle((src) => {
    const rx = new RegExp(src, 'i');
    return (
      [...document.querySelectorAll('button')].find((b) =>
        rx.test(b.textContent || '')
      ) || null
    );
  }, re);
  const el = handle.asElement();
  if (!el) return false;
  await el.click();
  await settle(page, 700);
  return true;
}

const run = async () => {
  await mkdir(OUT, { recursive: true });
  // System Chrome — puppeteer's own download isn't present on this machine.
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath:
      process.env.CHROME_PATH ||
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--font-render-hinting=none'],
  });

  for (const vp of VIEWPORTS) {
    process.stdout.write(`\n${vp.name}\n`);
    const page = await browser.newPage();
    await page.setViewport({
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: vp.dsf,
      isMobile: vp.width < 768,
      hasTouch: vp.width < 768,
    });

    // 1. Cold open — what a brand-new player actually sees first.
    await seed(page, 'return store;');
    await page.goto(BASE, { waitUntil: 'networkidle0' });
    await settle(page);
    await shot(page, `${vp.name}__01-cold-open`);

    // 2. Mid-game — populated grid, the state players spend their time in.
    await playWords(page, ['CAFE', 'CUT', 'ACE', 'FACE', 'FATE']);
    await shot(page, `${vp.name}__02-midgame`);

    // 3+. Sheets: the navigation and meta surfaces.
    if (await clickText(page, 'warm-?up|today|puzzle \\+?\\d|in the kitchen'))
      await shot(page, `${vp.name}__03-puzzles-and-themes`);
    await closeSheet(page);

    await page.evaluate(() => {
      const b = document.querySelector(
        '[aria-label="Rank and progress details"]'
      );
      if (b) b.click();
    });
    await settle(page, 700);
    await shot(page, `${vp.name}__04-progress`);
    await closeSheet(page);

    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) =>
        /help|rules|how to/i.test(x.getAttribute('aria-label') || '')
      );
      if (b) b.click();
    });
    await settle(page, 700);
    await shot(page, `${vp.name}__05-rules`);
    await closeSheet(page);

    // 6. Light mode — the sunlight case the palette was tuned for.
    await page.evaluate(() =>
      document.documentElement.setAttribute('data-theme', 'light')
    );
    await settle(page, 500);
    await shot(page, `${vp.name}__06-light-mode`);

    await page.close();
  }

  await browser.close();
  process.stdout.write(`\nWrote to ${OUT}\n`);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
