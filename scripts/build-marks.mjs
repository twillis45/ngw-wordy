/**
 * The mark, in the three forms a kit actually has to hand someone.
 *
 * The board of 2026-08-21 found the mark works down to about 32px and then
 * stops: at 16px the six tiles merge into a smudge and the accent tile — the
 * only thing distinguishing this from a generic six-dot loader — is the first
 * thing to go. It also found there was no one-colour version at all, which is
 * the version a kit gets asked for most (a stamp, an embroidery, a partner's
 * single-ink footer, a system tray).
 *
 * Three files, one geometry:
 *
 *   mark.svg        the full mark. Accent tile at the six o'clock position,
 *                   centre puck present. Minimum 32px.
 *   mark-mono.svg   one ink. No accent, no puck — the accent cannot survive a
 *                   single colour and a puck at one ink reads as a seventh
 *                   dot rather than a centre. Minimum 32px.
 *   mark-small.svg  for 16-24px. Fewer pixels means fewer elements: the puck
 *                   is dropped (it renders under one pixel at 16 and only
 *                   muddies the middle) and the tiles are enlarged with the
 *                   ring pulled in, so six shapes still resolve as six.
 *
 * `check-marks.mjs` renders each at its documented minimum and counts the
 * separable shapes. A mark that reads as five dots is not the mark.
 *
 *   node scripts/build-marks.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/brand');
/*
 * `src/app/icon.svg` is Next's file convention for the site icon, so writing
 * the small variant there is what actually connects this work to the product.
 * Without it the 16px fix lives in the kit and the browser tab keeps whatever
 * the PNG pipeline last produced — a guard (check-marks) watching a file
 * nothing ships.
 */
const APP_ICON = path.join(ROOT, 'src/app/icon.svg');

const INK = '#eef0f4';
const ACCENT = '#f2831c';

/*
 * `radius` is how far the tiles sit from centre and `tile` how big they are,
 * both as a fraction of the 512 box. The small variant trades ring radius for
 * tile size: pulling the ring in and growing the tiles keeps the GAP between
 * neighbours roughly constant in absolute pixels as the whole thing shrinks,
 * which is the thing that actually decides whether six shapes still read as
 * six.
 */
const build = ({ radius, tile, accent, puck }) => {
  /*
   * A tile must fit inside the box: its centre sits `radius` from the middle
   * and it extends `tile/2` beyond that. The first version of this generator
   * used radius 0.42 with tile 0.215 — 0.5275, so the top and bottom tiles
   * hung outside the viewBox and the canonical mark was silently reissued
   * clipped. Asserted rather than remembered.
   */
  if (radius + tile / 2 > 0.5) {
    throw new Error(
      `radius ${radius} + half-tile ${tile / 2} = ${radius + tile / 2} — the tiles leave the box`
    );
  }
  const C = 256;
  const R = 512 * radius;
  const T = 512 * tile;
  const shapes = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = (C + Math.cos(a) * R - T / 2).toFixed(2);
    const y = (C + Math.sin(a) * R - T / 2).toFixed(2);
    /* The accent sits at six o'clock — index 3, bottom of the dial. */
    const fill = accent && i === 3 ? ACCENT : INK;
    return `<rect x="${x}" y="${y}" width="${T.toFixed(2)}" height="${T.toFixed(
      2
    )}" rx="${(T * 0.32).toFixed(2)}" fill="${fill}"/>`;
  });
  if (puck) shapes.push(`<circle cx="${C}" cy="${C}" r="24" fill="${INK}"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Six on the Dial">
<g>
${shapes.map((s) => `  ${s}`).join('\n')}
</g>
</svg>
`;
};

/*
 * The app icon: the same six tiles, inset on a filled ground.
 *
 * Generated here rather than hand-kept, because it was the one mark in the
 * family nobody generated and therefore the one that could drift from the
 * rest without anything noticing. Its ring is TIGHTER than the bare mark's
 * (0.293 against 0.328) and that is deliberate, not drift: the icon sits on
 * a rounded square that both stores composite into their own shapes, so the
 * mark has to hold clear of an edge the bare mark does not have.
 *
 * `scripts/build-icons.py` redraws these same proportions in Pillow for the
 * PNG sizes the stores require, and states them as fractions of 1024 —
 * 300/1024 ring, 196/1024 tile, 44/1024 puck. Those are asserted against this
 * file by check-marks, so the two implementations cannot drift apart quietly.
 */
const ICON_RING = 300 / 1024;
const ICON_TILE = 196 / 1024;
const ICON_PUCK = 44 / 1024;

const iconSvg = () => {
  const C = 512;
  const R = 1024 * ICON_RING;
  const T = 1024 * ICON_TILE;
  const tiles = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = (C + Math.cos(a) * R - T / 2).toFixed(2);
    const y = (C + Math.sin(a) * R - T / 2).toFixed(2);
    const fill = i === 3 ? ACCENT : INK;
    return `<rect x="${x}" y="${y}" width="${T.toFixed(2)}" height="${T.toFixed(2)}" rx="${(T * 0.32).toFixed(2)}" fill="${fill}"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="Six on the Dial">
<rect width="1024" height="1024" rx="232" fill="#141517"/>
<rect x="6" y="6" width="1012" height="1012" rx="226" fill="none" stroke="#27282a" stroke-width="12"/>
<g>
${tiles.map((t) => `  ${t}`).join('\n')}
  <circle cx="512" cy="512" r="${(1024 * ICON_PUCK).toFixed(2)}" fill="${INK}"/>
</g>
</svg>
`;
};

const files = {
  'mark.svg': build({ radius: 0.328, tile: 0.215, accent: true, puck: true }),
  'mark-mono.svg': build({ radius: 0.328, tile: 0.215, accent: false, puck: false }),
    /*
   * At 16px the geometry is decided by one inequality. Neighbouring tiles sit
   * 60 degrees apart, so the distance between their centres is exactly
   * `radius` (2 * r * sin30 = r). To stay separable they need
   * radius > tile + about a pixel of clear air:
   *
   *     16 * 0.355 = 5.7px centres,  16 * 0.26 = 4.2px tiles,  1.5px gap
   *
   * The first attempt used radius 0.30 with tile 0.28 — 4.8px centres and
   * 4.5px tiles, a 0.3px gap — and rasterised to a single blob. check-marks
   * caught it; the eye at review size would not have.
   */
  'mark-small.svg': build({ radius: 0.355, tile: 0.26, accent: true, puck: false }),
  'icon.svg': iconSvg(),
};

for (const [name, svg] of Object.entries(files)) {
  fs.writeFileSync(path.join(OUT, name), svg);
  console.log(`  ${name}`);
}
fs.writeFileSync(APP_ICON, files['mark-small.svg']);
console.log('  src/app/icon.svg  (from mark-small)');
console.log('\n✔ marks written to docs/brand/ and src/app/');
