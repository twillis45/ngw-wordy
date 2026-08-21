/**
 * The rank ladder, redrawn as the dial filling up.
 *
 * The board of 2026-08-21 scored the previous ladder 1/10 and the measurement
 * is why: seven photorealistic renders whose mean luminance at 32px went
 * 31.6, 49.7, 47.5, 47.9, 40.8, 62.1, 57.7 — three adjacent pairs under 5 of
 * 255 apart, and NOT MONOTONIC, so a player climbing from Solid to Fluent
 * watched their mark get darker. Form differed but did not order either. Two
 * channels, both wandering.
 *
 * WHAT REPLACES IT COMES FROM THE RULES, not from taste. The game is six
 * letters on a dial and six rows to fill. So the rank mark is the dial, and
 * rank is HOW MANY OF THE SIX ARE LIT. Novice none, Complete all six.
 *
 * That gives three properties the renders could not:
 *
 *   COUNT is the primary channel, and count is ordered by construction. You
 *   cannot draw four lit dots that read as fewer than three.
 *
 *   It survives greyscale and colour-vision deficiency, because counting is
 *   not seeing a hue. The accessibility seat blocked on exactly this, and the
 *   kit's own commitments already promised meaning would not ride on hue.
 *
 *   It is the SAME GEOMETRY as the app mark, so the family stops being two
 *   visual languages that happen to ship together.
 *
 * Value is a redundant second channel and rises monotonically — the lit dots
 * brighten as the ladder climbs — so the ordering survives even at a size
 * where you can no longer count.
 *
 * Checked against how this is done elsewhere before drawing anything: Life
 * Reset puts a roman numeral in each tier badge, Agoda uses filled versus
 * outlined on a connector, Crypto.com locked versus unlocked, DoorDash a
 * counter. All of them carry a second channel that is not hue, and all of
 * them are flat. None uses photorealism for a tier ladder.
 *
 *   node scripts/build-rank-marks.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/*
 * TWO destinations, one definition. `docs/brand/ranks` is the kit's copy and
 * `public/brand/ranks` is the one the app actually serves — written from the
 * same generator so the mark a player earns and the mark in the brand kit
 * cannot drift into being two different drawings.
 */
const OUT = path.join(ROOT, 'docs/brand/ranks');
const APP_OUT = path.join(ROOT, 'public/brand/ranks');

const RANKS = [
  'novice',
  'solid',
  'sharp',
  'clever',
  'fluent',
  'wordsmith',
  'complete',
];

/*
 * Geometry lifted from the wheel so the mark and the ranks are the same
 * object: six positions, first at the top, going clockwise.
 */
const R = 30;
const DOT = 9.5;
const CENTER = 50;

/*
 * The value ramp. Unlit dots hold one dim value so the ring is always
 * readable as SIX POSITIONS — a rank you have not reached still has to show
 * you the shape of what is left. Lit dots climb from steel to the accent.
 *
 * These are the app's own tokens, not new colours: steel-dark, steel-muted,
 * and the orange accent at increasing strength.
 */
const UNLIT = '#2b3038';
const LIT = [
  /*
   * The first lit step is deliberately not subtle. Novice to Solid changes
   * only ONE dot, so it is the narrowest rung on the ladder by construction —
   * measured at 4.1 of 255 with a dimmer opening value, against 11-27 for
   * every other step. Starting the ramp brighter buys that rung the same
   * clearance the rest get, which matters because it is the FIRST reward the
   * game ever gives and the one most likely to be dismissed as nothing.
   */
  '#5a6675',
  '#6e7c8c',
  '#8a8478',
  '#b08350',
  '#d4842c',
  '#f2831c',
];

const svg = (litCount) => {
  const dots = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = (CENTER + Math.cos(a) * R).toFixed(2);
    const y = (CENTER + Math.sin(a) * R).toFixed(2);
    const lit = i < litCount;
    /*
     * Lit dots are also slightly LARGER. A third redundant channel, and the
     * one that still works at 16px after both colour and count have failed.
     */
    const r = (lit ? DOT + 1.2 : DOT).toFixed(2);
    const fill = lit ? LIT[Math.min(litCount - 1, LIT.length - 1)] : UNLIT;
    return `  <circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
  }).join('\n');

  /*
   * The centre puck, present at every rank because it is present on the dial.
   * It brightens only at Complete — the one moment the whole wheel is spent.
   */
  const puck = litCount === 6 ? '#f2831c' : '#232830';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" role="img" aria-label="Rank ${litCount} of 6">
${dots}
  <circle cx="${CENTER}" cy="${CENTER}" r="6.5" fill="${puck}"/>
</svg>
`;
};

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(APP_OUT, { recursive: true });
RANKS.forEach((name, i) => {
  const body = svg(i);
  fs.writeFileSync(path.join(OUT, `rank-${i}-${name}.svg`), body);
  fs.writeFileSync(path.join(APP_OUT, `rank-${i}-${name}.svg`), body);
  console.log(`  rank-${i}-${name}.svg   ${i}/6 lit`);
});
console.log(`\n✔ ${RANKS.length} rank marks written to docs/brand/ranks/ and public/brand/ranks/`);
