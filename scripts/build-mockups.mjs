/**
 * The marketing composites — device shots with a headline over them.
 *
 * WHY THIS SCRIPT EXISTS AT ALL. The six mockup-*.png in store/marketing were
 * made by hand on 2026-08-17 and refreshed at 12:06 on 2026-08-21. They embed
 * store screenshots, and those screenshots were replaced at 17:07 the same day
 * — after the dark de-blue, the studio panel lift, the light dimming, the rail
 * relayout and two new accents. So the only marketing assets that could not be
 * regenerated were also the only ones showing a product that no longer exists.
 *
 * Every other brand artifact in this repo is generated for exactly this reason:
 * build-og.mjs, build-feature-graphic.mjs, build-icons, build-marks. This was
 * the gap in that argument.
 *
 *   npm run build && npx serve -s out -l 4310
 *   node scripts/capture-store.mjs http://localhost:4310   # the screens first
 *   node scripts/build-mockups.mjs                          # then the frames
 *
 * The screenshots are read from disk rather than re-shot here on purpose: a
 * composite that quietly re-captures can disagree with the store listing it is
 * advertising, and the store shots are the ones with asserted dimensions.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './lib/browser.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)).replace(/\/scripts$/, '');
const SHOTS = path.join(ROOT, 'store', 'screenshots');
const OUT = path.join(ROOT, 'store', 'marketing');
const MARK = path.join(ROOT, 'docs', 'brand', 'mark.svg');

/*
 * Six surfaces, each with the line it is actually making. Copy lives here
 * rather than in the image, which is the whole point: a claim that changes can
 * be changed, and a claim that is wrong can be found by grep.
 *
 * The Apple frames take 6.7" (1290x2796) and the Play frames 1080x1920, which
 * are the store sizes — the composite IS the listing image, not a crop of it.
 */
const PANELS = [
  { shot: 'apple-6.7__1-board.png',    eyebrow: 'The wheel',     head: 'Six on the dial.\nSix words to find.', sub: 'Choose a board, spin the wheel,\nand spell every word it holds.' },
  { shot: 'apple-6.7__3-themes.png',   eyebrow: 'The catalogue', head: 'Three hundred\nhand-written boards.', sub: 'Fifteen themes, each one researched,\ncited, and read by a person.' },
  { shot: 'apple-6.7__4-progress.png', eyebrow: 'Your record',   head: 'A streak you can\nactually keep.', sub: 'Freezes for a missed day, a pause for a\nweek away. Nothing to lose by living.' },
  { shot: 'play-phone__2-solving.png', eyebrow: 'The dial',      head: 'The wheel turns\nas you solve.', sub: 'Every row you fill moves it sixty degrees\nand hands you another letter.' },
  { shot: 'play-phone__5-rules.png',   eyebrow: 'How it plays',  head: 'Learned in a\nsingle sentence.', sub: 'Six letters, six words, all from the wheel.\nNo timer, no penalty, no streak to protect.' },
  { shot: 'play-phone__6-light.png',   eyebrow: 'Four looks',    head: 'Dark, light, matte,\nand your own accent.', sub: 'Every one measured for contrast,\nnot chosen because it looked nice.' },
];

const dataUri = async (file, mime) =>
  `data:${mime};base64,${(await readFile(file)).toString('base64')}`;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const lines = (s) => esc(s).split('\n').join('<br>');

const run = async () => {
  const available = new Set(await readdir(SHOTS));
  const missing = PANELS.filter((p) => !available.has(p.shot));
  if (missing.length) {
    console.error('✗ these screenshots are not on disk — run capture-store first:');
    missing.forEach((m) => console.error(`    ${m.shot}`));
    process.exit(1);
  }

  const markUri = await dataUri(MARK, 'image/svg+xml');
  const browser = await launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const made = [];

  for (const panel of PANELS) {
    const apple = panel.shot.startsWith('apple');
    const W = apple ? 1290 : 1080;
    const H = apple ? 2796 : 1920;
    const shotUri = await dataUri(path.join(SHOTS, panel.shot), 'image/png');

    /*
     * The device is CSS, not a bitmap frame: a PNG bezel would have to be
     * re-cut for every screen size, and it is the thing most likely to go
     * stale silently — which is the failure this whole script is fixing.
     *
     * Perspective rather than flat, because a flat screenshot on a background
     * reads as a screenshot. The rotation is small; past about 8° the type
     * inside the phone stops being legible, and the point is to show the game.
     */
    const html = `<!doctype html><meta charset="utf-8"><style>
      * { margin: 0; box-sizing: border-box; }
      body {
        width: ${W}px; height: ${H}px; overflow: hidden; position: relative;
        background: #07080a;
        font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        display: flex; flex-direction: column; align-items: center;
      }
      /* Two soft pools so the ground is not a flat field. Same idea as the
         app's own ambient layer, and neutral for the same reason: a coloured
         glow would fight whichever accent the screenshot happens to show. */
      .glow { position: absolute; border-radius: 50%; filter: blur(${W * 0.09}px); }
      .g1 { width: ${W * 0.9}px; height: ${W * 0.9}px; top: ${H * 0.18}px; left: -${W * 0.25}px;
            background: rgba(98,100,102,0.13); }
      .g2 { width: ${W * 0.8}px; height: ${W * 0.8}px; bottom: ${H * 0.06}px; right: -${W * 0.2}px;
            background: rgba(98,100,102,0.10); }
      .eyebrow {
        margin-top: ${H * 0.031}px; padding: ${W * 0.012}px ${W * 0.037}px;
        border: 1px solid #2f3032; border-radius: 999px;
        color: #c2c4c8; font-size: ${W * 0.029}px; font-weight: 600;
        letter-spacing: 0.16em; text-transform: uppercase; z-index: 2;
      }
      h1 { margin-top: ${H * 0.022}px; color: #eef0f4; text-align: center;
           font-size: ${W * 0.078}px; font-weight: 800; line-height: 1.08;
           letter-spacing: -0.02em; z-index: 2; }
      /* The one accent moment, matching the shipped default. */
      h1 .dot { color: #e08c38; }
      p { margin-top: ${H * 0.014}px; color: #9a9ca0; text-align: center;
          font-size: ${W * 0.034}px; line-height: 1.45; z-index: 2; }
      /*
       * FLAT. No perspective, no rotation.
       *
       * The first version tilted the device — rotateY(-7deg) with rotateX and
       * rotateZ — and it was wrong for a reason specific to this product: the
       * dial is a CIRCLE. Any perspective transform renders it as an ellipse,
       * so the effect damages the exact thing the screenshot exists to show.
       * A tilt that distorts your hero element is not styling, it is a cost.
       *
       * It is also the wrong era. Straight-on presentation is what every
       * current top-grossing app uses, and a 3D-tilted phone reads as a 2016
       * template — which dates the product rather than the mockup.
       */
      .stage { flex: 1; display: flex; align-items: center; justify-content: center;
               width: 100%; z-index: 2; }
      .device {
        width: ${W * 0.70}px; padding: ${W * 0.010}px;
        border-radius: ${W * 0.058}px; background: #1a1b1d;
        border: 1px solid #3a3b3d;
        box-shadow: 0 ${W * 0.045}px ${W * 0.10}px rgba(0,0,0,0.58),
                    inset 0 1px 0 rgba(255,255,255,0.10);
      }
      .device img { display: block; width: 100%; border-radius: ${W * 0.052}px; }
      .foot { display: flex; flex-direction: column; align-items: center;
              gap: ${H * 0.008}px; margin-bottom: ${H * 0.030}px; z-index: 2; }
      .foot img { width: ${W * 0.055}px; }
      .foot span { color: #c2c4c8; font-size: ${W * 0.028}px; font-weight: 700;
                   letter-spacing: 0.22em; text-transform: uppercase; }
    </style>
    <div class="glow g1"></div><div class="glow g2"></div>
    <div class="eyebrow">${esc(panel.eyebrow)}</div>
    <h1>${lines(panel.head).replace(/\.$/, '<span class="dot">.</span>')}</h1>
    <p>${lines(panel.sub)}</p>
    <div class="stage"><div class="device"><img src="${shotUri}" alt=""></div></div>
    <div class="foot"><img src="${markUri}" alt=""><span>Six on the Dial</span></div>`;

    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const file = `mockup-${panel.shot}`;
    await page.screenshot({ path: path.join(OUT, file) });
    await page.close();

    /*
     * Dimensions asserted from the PNG header, same as capture-store: these
     * are listing images, and a store rejects a wrong size after upload rather
     * than before.
     */
    const buf = await readFile(path.join(OUT, file));
    const [w, h] = [buf.readUInt32BE(16), buf.readUInt32BE(20)];
    const ok = w === W && h === H;
    made.push({ file, w, h, ok });
    console.log(`  ${ok ? '✔' : '✗'} ${file.padEnd(34)} ${w}x${h}`);
  }

  await browser.close();
  const bad = made.filter((m) => !m.ok);
  if (bad.length) { console.log(`\n✖ ${bad.length} at the wrong size`); process.exit(1); }
  console.log(`\n✔ ${made.length} composites rebuilt from the current screenshots`);
};

await run();
