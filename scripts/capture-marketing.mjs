/**
 * Marketing stills for a landing page and a campaign video.
 *
 * DIFFERENT JOB FROM THE OTHER TWO CAPTURE SCRIPTS, and worth saying so before
 * anyone merges them:
 *
 *   capture-store.mjs   few states, EXACT store pixel sizes, because the
 *                       constraint is upload validation.
 *   capture-review.mjs  seven viewports x six states, because the constraint
 *                       is design coverage for the board.
 *   this one            the states that SELL, at sizes a video editor and a
 *                       hero section can actually use, and every look the game
 *                       ships — four themes and four accents.
 *
 * WHY IT EXISTS NOW. The store screenshots on disk were shot at 03:22 today,
 * before the dark de-blue, the studio panel lift, the light dimming, the rail
 * relayout and both new accents. They are pictures of an app that no longer
 * exists. Anything cut from them would be advertising the wrong product.
 *
 * Shoots the PRODUCTION export, like the other two:
 *
 *   npm run build && npx serve -s out -l 4310
 *   node scripts/capture-marketing.mjs http://localhost:4310
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './lib/browser.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)).replace(/\/scripts$/, '');
const BASE = process.argv[2] || 'http://localhost:4310';
const OUT = path.join(ROOT, 'store', 'marketing');

/*
 * Two shapes, because a campaign needs both and they are not crops of each
 * other: the dial is a fixed circle, so a phone frame and a 16:9 frame compose
 * completely differently. 2x on both — a landing page hero on a retina display
 * is the whole point, and video gets downscaled cleanly from more pixels.
 */
const FRAMES = [
  { name: 'hero-1920x1080', width: 1920, height: 1080, dsf: 2 },
  { name: 'phone-390x844', width: 390, height: 844, dsf: 3 },
];

/* Every look the game actually ships. A campaign that shows one is lying by omission. */
const LOOKS = [
  { name: 'dark-matte', theme: 'dark', accent: 'matte' },
  { name: 'dark-green', theme: 'dark', accent: 'default' },
  { name: 'dark-tide', theme: 'dark', accent: 'tide' },
  { name: 'dark-plum', theme: 'dark', accent: 'plum' },
  { name: 'light-matte', theme: 'light', accent: 'matte' },
  { name: 'studio', theme: 'studio', accent: 'matte' },
];

const settle = (page, ms = 900) => page.evaluate((m) => new Promise((r) => setTimeout(r, m)), ms).catch(() => {});

async function seedLook(page, look) {
  await page.evaluateOnNewDocument((l) => {
    try {
      localStorage.setItem('ngw-wordy/theme', l.theme);
      /*
       * 'default' is STORED, not removed.
       *
       * Removing the key does not select Signal green — the shipped default is
       * matte, so an absent value resolves to matte through the pre-paint
       * script. The first run of this shot ten stills of the wrong accent
       * because of that, and the only reason it is not on a landing page is
       * that every still asserts the look it claims to be.
       */
      localStorage.setItem('ngw-wordy/accent', l.accent);
      localStorage.removeItem('ngw-wordy/v2');
    } catch { /* first paint still gets the default */ }
  }, look);
}

const playWords = async (page, words) => {
  for (const w of words) {
    for (const ch of w) await page.keyboard.press(ch.toUpperCase());
    await page.keyboard.press('Enter');
    await settle(page, 300);
  }
};

/*
 * Board 113 — crafty / cart / tray / cry / fat / fry. Named with its grid
 * because a six-letter word that is NOT a row banks as bonus and turns
 * nothing, which is how a whole afternoon of drag probes tested the one
 * condition that could not fail. A marketing shot of a "mid-solve" board that
 * never solved anything would be the same mistake, in public.
 */
const OPENING = ['CRAFTY'];
const MIDWAY = ['CRY', 'FAT'];

const STATES = [
  {
    name: '1-fresh',
    what: 'an untouched board — the shot that has to carry the whole idea',
    go: async () => {},
  },
  {
    name: '2-first-word',
    what: 'the six-letter row banked and the dial turned 60°',
    go: async (page) => { await playWords(page, OPENING); await settle(page, 1100); },
  },
  {
    name: '3-midway',
    what: 'three rows down, the wheel escalating',
    go: async (page) => { await playWords(page, [...OPENING, ...MIDWAY]); await settle(page, 1100); },
  },
  {
    name: '4-progress',
    what: 'rank, record and streak — the reason to come back tomorrow',
    go: async (page) => {
      await playWords(page, OPENING);
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) =>
          /rank and progress/i.test(x.getAttribute('aria-label') ?? ''));
        b?.click();
      });
      await settle(page, 900);
    },
  },
  {
    name: '5-themes',
    what: 'the catalogue — 300 hand-authored themed boards',
    go: async (page) => {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) =>
          /puzzles and themes/i.test(x.getAttribute('aria-label') ?? ''));
        b?.click();
      });
      await settle(page, 900);
    },
  },
];

fs.mkdirSync(OUT, { recursive: true });
const browser = await launch({ headless: true });
const manifest = [];
let shots = 0;

for (const frame of FRAMES) {
  for (const look of LOOKS) {
    for (const state of STATES) {
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(60_000);
      await page.setViewport({
        width: frame.width, height: frame.height, deviceScaleFactor: frame.dsf,
        isMobile: frame.width < 500, hasTouch: frame.width < 500,
      });
      await seedLook(page, look);
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await settle(page, 1100);
      await state.go(page);

      const file = `${frame.name}__${look.name}__${state.name}.png`;
      await page.screenshot({ path: path.join(OUT, file) });

      /*
       * Assert the LOOK actually applied. Seeding storage and trusting it is
       * how two accents shipped this afternoon that did not apply at all —
       * the control said Tide and the page stayed green. A campaign shot of
       * the wrong theme is the same failure with a bigger audience.
       */
      const seen = await page.evaluate(() => ({
        theme: document.documentElement.getAttribute('data-theme'),
        accent: document.documentElement.getAttribute('data-accent'),
      }));
      const wantAccent = look.accent === 'default' ? null : look.accent;
      const ok = seen.theme === look.theme && seen.accent === wantAccent;
      manifest.push({ file, ...look, state: state.name, what: state.what, ok, seen });
      if (!ok) process.stdout.write(`  ! ${file} — wanted ${look.theme}/${look.accent}, got ${seen.theme}/${seen.accent}\n`);
      shots += 1;
      await page.close();
    }
  }
  process.stdout.write(`  ${frame.name}: ${LOOKS.length * STATES.length} shots\n`);
}

await browser.close();

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
const wrong = manifest.filter((m) => !m.ok);
console.log(`\n${shots} stills -> store/marketing/`);
console.log(`${FRAMES.length} frames x ${LOOKS.length} looks x ${STATES.length} states`);
if (wrong.length) {
  console.log(`\n✖ ${wrong.length} shot the wrong look — do not ship these`);
  process.exit(1);
}
console.log('✔ every still is the look it claims to be');
