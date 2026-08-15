/**
 * Shoot the completion sheet in each of the states it can now take.
 *
 * The sheet used to render three tiles unconditionally, so a first clear read
 * `23 / 0 / 0`. It now renders only the stats that can mean something, which
 * makes the COLUMN COUNT variable — and a variable Tailwind grid is exactly
 * the kind of thing that compiles to nothing and collapses silently. The unit
 * tests cover which stats survive; only pixels cover how they sit.
 *
 * Usage: node scripts/capture-complete.mjs http://localhost:4310
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { launch } from './lib/browser.mjs';

const BASE = process.argv[2] || 'http://localhost:4310';
const OUT = path.resolve('review-artifacts');
const KEY = 'ngw-wordy/v2';

/** The warm-up 1 board, in the order the review played it. */
const BOARD = ['CRY', 'FAT', 'FRY', 'CART', 'TRAY', 'CRAFTY'];

const settle = (ms) => new Promise((r) => setTimeout(r, ms));

async function seed(page, mutate) {
  await page.evaluateOnNewDocument(
    (key, src) => {
      const fn = new Function('store', src);
      let store = {};
      try {
        store = JSON.parse(localStorage.getItem(key) || '{}');
      } catch {}
      localStorage.setItem(key, JSON.stringify(fn(store) || store));
    },
    KEY,
    mutate
  );
}

/**
 * Measure the sheet rather than trusting the screenshot.
 *
 * A tile reading "0" is the whole bug; asserting on the rendered text is the
 * only check that stays true after somebody edits the component.
 */
async function readSheet(page) {
  return page.evaluate(() => {
    const dl = document.querySelector('[aria-label="Puzzle cleared"] dl');
    if (!dl) return null;
    const tiles = [...dl.children].map((t) => ({
      value: t.querySelector('dd')?.textContent?.trim(),
      label: t.querySelector('dt')?.textContent?.trim(),
      width: Math.round(t.getBoundingClientRect().width),
    }));
    return { columns: getComputedStyle(dl).gridTemplateColumns.split(' ').length, tiles };
  });
}

const run = async () => {
  await mkdir(OUT, { recursive: true });
  const browser = await launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });

  // Each case names the state a player would actually be in.
  const CASES = [
    { name: 'first-clear', store: 'return store;' },
    {
      /*
       * lastPlayed MUST be yesterday, not just a streak number. `touchStreak`
       * resets to 1 for any other value — by design, or the streak stops
       * meaning "showed up today" — so seeding the count alone produces a
       * streak of 1 and proves nothing.
       */
      name: 'returning-streak',
      store: `
        const d = new Date(); d.setDate(d.getDate() - 1);
        const p = (n) => String(n).padStart(2, '0');
        store.lastPlayed = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
        store.streak = 6;
        store.bestStreak = 6;
        return store;`,
    },
  ];

  const findings = [];

  for (const c of CASES) {
    /*
     * A FRESH context per case, not just a fresh page.
     *
     * Pages in one browser share localStorage per origin, so the second case
     * opened the board the first case had already cleared — solved on arrival,
     * no transition, no sheet. The screenshot showed a finished board and the
     * measurement returned null, which is the only reason it was caught.
     */
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await seed(page, c.store);
    await page.goto(BASE, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'studio'));
    await settle(900);

    for (const w of BOARD) {
      for (const ch of w) await page.keyboard.press(ch);
      await page.keyboard.press('Enter');
      await settle(300);
    }
    await settle(1200);

    const sheet = await readSheet(page);
    findings.push({ case: c.name, ...sheet });
    await page.screenshot({ path: path.join(OUT, `complete-${c.name}.png`) });
    process.stdout.write(`  complete-${c.name}.png\n`);
    await page.close();
    await ctx.close();
  }

  await browser.close();
  console.log(JSON.stringify(findings, null, 2));
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
