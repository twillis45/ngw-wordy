/**
 * The first-run teach: assert it appears, and assert it leaves.
 *
 * The 2026-08-14 board review recorded "there is no first-run explainer at all
 * on a cleared profile" and held Ease of use off a 9 for it. Measured on the
 * production export, that is false — the line renders on a cold profile and
 * retires after the first word, exactly as designed. The finding came from
 * looking rather than measuring, which is the same failure mode the rail and
 * the contrast comments already cost this repo.
 *
 * Both halves matter and they fail in opposite directions:
 *
 * - Gone on a cold profile is a new player with no goal statement.
 * - Still there after the first word is a teach that outstays its welcome,
 *   which is what `markIntroSeen` exists to prevent. The board ruled the teach
 *   should end by being ACTED on rather than clicked away, so "it disappeared
 *   because a word was banked" is the behaviour under test.
 *
 * Usage: node scripts/check-intro.mjs [http://localhost:4310]
 */
import { launch } from './lib/browser.mjs';

const BASE = process.argv[2] || 'http://localhost:4310';
const LINE = 'Six letters. Six words. All from the wheel.';
const settle = (ms) => new Promise((r) => setTimeout(r, ms));

/** Read the page's own text, not React state — this is a player-facing claim. */
const readTeach = (page) =>
  page.evaluate(
    (line) => ({
      intro: document.body.innerText.includes(line),
      seenIntro: (() => {
        try {
          return JSON.parse(localStorage.getItem('ngw-wordy/v2') || '{}').seenIntro ?? null;
        } catch {
          return null;
        }
      })(),
    }),
    LINE
  );

const run = async () => {
  const browser = await launch();

  const failures = [];
  const ok = (pass, msg) => {
    process.stdout.write(`${pass ? '✔' : '✖'}  ${msg}\n`);
    if (!pass) failures.push(msg);
  };

  // A fresh context per run, or a previous run's seenIntro answers for us.
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await settle(1200);

  const cold = await readTeach(page);
  ok(cold.intro, 'cold profile shows the first-run teach');

  // One word is the whole ask, so one word is what retires it.
  for (const ch of 'CRY') await page.keyboard.press(ch);
  await page.keyboard.press('Enter');
  await settle(1000);

  const after = await readTeach(page);
  ok(!after.intro, 'teach retires once a word has been banked');
  ok(after.seenIntro === true, 'and the retirement is persisted as seenIntro');

  await browser.close();

  if (failures.length) {
    process.stdout.write(`\n✖ first-run teach broken: ${failures.length} of 3\n`);
    process.exit(1);
  }
  process.stdout.write('\n✔ first-run teach appears on a cold profile and retires when obeyed\n');
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
