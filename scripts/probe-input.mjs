#!/usr/bin/env node
/**
 * Real pointer and key input against the production export.
 *
 * WHY THIS EXISTS. Verification of this component has been wrong twice, in the
 * same way both times: `element.click()` was used to "prove" tapping worked. It
 * proves nothing. A synthetic click bypasses hit-testing and event retargeting,
 * which is precisely where the bugs were — `setPointerCapture` on the container
 * was retargeting the real `click`, and no synthetic dispatch could ever see it.
 *
 * Everything here goes through CDP: `mouse.move` / `mouse.down` / `mouse.up`
 * and `keyboard.press`. The browser does its own hit-testing, fires its own
 * pointer sequence, and applies its own capture rules — so a pass here means
 * the thing a finger does works, not that a function is callable.
 *
 * It also measures the DIAL before and after, because "does the board hold
 * still while you interact with it" is the complaint that recurs, and position
 * is the only honest answer to it.
 *
 * Usage:
 *   npx serve out -p 4420
 *   node scripts/probe-input.mjs http://localhost:4420
 */
import { createRequire } from 'node:module';

// Puppeteer's own Chrome, required from a sibling checkout: both node installs
// here are x64 on an arm64 Mac, so a system Chrome fails cross-arch.
const require = createRequire('/Users/toddwillis/Code/ngw-core/');
const puppeteer = require('puppeteer');

const BASE = process.argv[2] || 'http://localhost:4420';

const VIEWPORTS = [
  { name: 'phone  390x844', width: 390, height: 844, mobile: true },
  { name: 'laptop 1440x900', width: 1440, height: 900, mobile: false },
];

/** Geometry that must not move while a player is interacting. */
async function geometry(page) {
  return page.evaluate(() => {
    const tile = document.querySelector('[data-wheel-tile]');
    const dial = tile?.parentElement;
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        cx: +(r.left + r.width / 2).toFixed(1),
        cy: +(r.top + r.height / 2).toFixed(1),
        w: +r.width.toFixed(1),
      };
    };
    return {
      dial: box(dial),
      tiles: [...document.querySelectorAll('[data-wheel-tile]')].map(box),
      selected: [...document.querySelectorAll('[data-wheel-tile]')].filter(
        (t) => t.getAttribute('aria-pressed') === 'true'
      ).length,
    };
  });
}

function drift(a, b) {
  const out = [];
  if (a.dial && b.dial) {
    const d = Math.hypot(b.dial.cx - a.dial.cx, b.dial.cy - a.dial.cy);
    if (d > 0.5) out.push(`dial moved ${d.toFixed(1)}px`);
    if (Math.abs(b.dial.w - a.dial.w) > 0.5) out.push(`dial resized ${a.dial.w}->${b.dial.w}`);
  }
  a.tiles.forEach((t, i) => {
    const u = b.tiles[i];
    if (!t || !u) return;
    const d = Math.hypot(u.cx - t.cx, u.cy - t.cy);
    if (d > 0.5) out.push(`tile#${i} moved ${d.toFixed(1)}px`);
  });
  return out;
}

const browser = await puppeteer.launch({ headless: 'new' });
let failures = 0;

for (const vp of VIEWPORTS) {
  const page = await browser.newPage();
  await page.setViewport({
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: 2,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
  });
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1100));

  // Dismiss the first-run explainer with a REAL key press.
  await page.keyboard.press('Enter');
  await new Promise((r) => setTimeout(r, 600));

  const before = await geometry(page);

  // A real click on a real letter, at its measured centre.
  const target = before.tiles[0];
  await page.mouse.move(target.cx, target.cy);
  await new Promise((r) => setTimeout(r, 60));
  await page.mouse.down();
  await new Promise((r) => setTimeout(r, 40));
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 350));

  const after = await geometry(page);
  const moved = drift(before, after);
  const selected = after.selected === 1;

  const problems = [...moved];
  if (!selected) problems.push(`click selected ${after.selected} letters, expected 1`);

  process.stdout.write(
    `${vp.name}  ${problems.length ? 'FAIL' : 'ok  '}  selected=${after.selected}  ` +
      `${problems.length ? problems.join('; ') : 'nothing moved'}\n`
  );
  if (problems.length) failures += 1;

  await page.close();
}

await browser.close();
process.exit(failures ? 1 : 0);
