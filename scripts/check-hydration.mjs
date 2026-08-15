#!/usr/bin/env node
/**
 * The production export must hydrate without React throwing it away.
 *
 * Found 2026-08-14 while proving an unrelated lint change: every load of the
 * built site logged `Minified React error #418` — "the server rendered HTML
 * didn't match the client" — and React silently regenerated the tree on the
 * client. Invisible to a player, which is why it survived: the prerender was
 * being paid for at build time and discarded at run time.
 *
 * It is checked HERE rather than in `npm test` because it is a runtime fact
 * about the built artifact, like check-rail and check-intro. No unit test on
 * the source can see it; only a browser hydrating real server HTML can.
 *
 * Serve the export first, then:
 *   node scripts/check-hydration.mjs [http://localhost:4310]
 */
import { launch } from './lib/browser.mjs';

const BASE = process.argv[2] || 'http://localhost:4310';
const settle = (ms) => new Promise((r) => setTimeout(r, ms));

/*
 * React minifies its hydration failures in a production build, so the text is
 * a number. 418 is the mismatch itself; 423 and 425 are the same family, and
 * the unminified wording is matched too so this keeps working if the export is
 * ever built unminified.
 */
const HYDRATION = /Minified React error #(418|423|425)\b|Hydration failed|did not match the client/i;

/*
 * A share link is included because the first fix attempt for this class of bug
 * is usually to seed state from the URL during render, which would introduce a
 * mismatch on exactly these paths and on no other.
 */
const PATHS = [
  ['a plain load', ''],
  ['a #theme= share link', '#theme=texas'],
  ['a #play= share link', '#play=3'],
];

const run = async () => {
  const browser = await launch();

  const failures = [];
  const ok = (pass, msg) => {
    process.stdout.write(`${pass ? '✔' : '✖'}  ${msg}\n`);
    if (!pass) failures.push(msg);
  };

  for (const [label, hash] of PATHS) {
    // A fresh context per case: a previous case's storage changes which board
    // renders, and a different board is a different hydration.
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errs.push(m.text());
    });
    page.on('pageerror', (e) => errs.push(String(e)));

    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`${BASE}/${hash}`, { waitUntil: 'networkidle0' });
    await settle(1500);

    const hydration = errs.filter((e) => HYDRATION.test(e));
    ok(
      hydration.length === 0,
      `${label} hydrates the server HTML` +
        (hydration.length ? ` — ${hydration[0].slice(0, 160)}` : '')
    );

    /*
     * Do NOT try to diff the served HTML against the live DOM to find what
     * moved. Two attempts at that are in this file's history and both were
     * useless: React has already regenerated the tree, and Next injects its
     * own scripts at the top of <body> at runtime, so the two strings differ
     * at character 1 on a page that hydrates perfectly.
     *
     * The only thing that names the element is React's DEV build, which prints
     * the component tree with the offending props marked +/-. That is how the
     * fullscreen-button mismatch was found. Reproduce with:
     *
     *   npm run dev   →  load the page  →  read the console
     */
    if (hydration.length) {
      process.stdout.write(
        '   run `npm run dev` and load the page to see which element differs;\n' +
          '   a production build minifies this failure down to its number.\n'
      );
    }
    await ctx.close();
  }

  await browser.close();

  if (failures.length) {
    process.stdout.write(
      `\n✖ ${failures.length} of ${PATHS.length} loads threw away the prerender\n`
    );
    process.exit(1);
  }
  process.stdout.write('\n✔ the export hydrates on every path checked\n');
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
