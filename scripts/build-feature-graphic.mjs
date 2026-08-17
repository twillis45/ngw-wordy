/**
 * The Play feature graphic, 1024×500 — required on every Play listing.
 *
 * Built from the committed brand marks for the same reason the social card is
 * (build-og.mjs): the day the wordmark changes, this regenerates instead of
 * drifting.
 *
 *   node scripts/build-feature-graphic.mjs
 *
 * Two Play-specific rules shape the layout, and neither is a style choice:
 *
 * 1. Play crops this graphic on some surfaces, so the margins are generous and
 *    nothing that has to be read goes near an edge. The related constraint is
 *    NOT met and that is a deliberate call: when a promo video is attached, Play
 *    overlays a play button over the center, which here lands on "dial" and on
 *    the middle of the tagline. Clearing a ~96px center band would cap the
 *    visible wordmark near 390px on a 1024px canvas — a weak graphic to buy
 *    protection from a video that does not exist. **If a promo video is ever
 *    attached, re-run with a shorter tagline and a narrower WORDMARK_INK_W.**
 * 2. Play rejects an image with an alpha channel; it wants 24-bit PNG or JPEG.
 *    An opaque page screenshots as PNG color type 2 already, so no flatten step
 *    is needed — but that is a property of the capture, not a guarantee, so the
 *    color-type byte is asserted below exactly the way the dimensions are. If a
 *    future edit makes the ground transparent, this fails here rather than at
 *    the Play console.
 *
 * On sizing: both brand SVGs are mostly padded carbon ground, and the wordmark
 * paints that ground as a real rect, so getBBox() reports the whole canvas and
 * is no help. Sizing by canvas therefore lands the VISIBLE mark at some
 * unpredictable fraction of the width — the bug build-og.mjs works around with
 * hand-tuned offsets. Here the measured ink bounds are named constants instead,
 * and every offset is derived from them, so "the wordmark is 560px wide with a
 * 68px margin" is stated once and the arithmetic follows.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { launch } from './lib/browser.mjs';

const OUT = path.resolve('store/play-feature-graphic.png');
const W = 1024;
const H = 500;

/* PNG IHDR color type lives at byte 25: 2 is truecolor, 6 is truecolor+alpha. */
const COLOR_TYPE_RGB = 2;

/*
 * Ink bounds of the committed SVGs, in their own canvas units — measured by
 * rasterizing each one and scanning for pixels that differ from the ground,
 * because the painted background rect defeats getBBox(). Re-measure if a mark
 * is redrawn; the assertions below only catch the output size, not a mark that
 * silently moved inside its canvas.
 */
const WORDMARK = { canvas: [2048, 1331], ink: { x: 152, y: 560, w: 1744, h: 226 } };
const MARK = { canvas: [512, 512], ink: { x: 55.5, y: 33, w: 401, h: 446 } };

/* The layout, stated as the two things that actually matter. */
const MARGIN = 68; // left margin, shared by the wordmark and the tagline
const WORDMARK_INK_W = 560; // visible wordmark width
const WORDMARK_INK_MID_Y = 205; // vertical center of the visible wordmark
const MARK_INK_H = 233; // visible dial height
const MARK_MARGIN = 74; // right margin of the visible dial

/* Placement of a padded canvas such that its INK lands where we asked. */
const place = ({ canvas, ink }, scale) => ({
  canvasH: canvas[1] * scale,
  inkOffsetX: ink.x * scale,
  inkOffsetY: ink.y * scale,
  inkW: ink.w * scale,
  inkH: ink.h * scale,
  /* distance from the canvas's right edge to the ink's right edge */
  inkInsetRight: (canvas[0] - (ink.x + ink.w)) * scale,
});

const dataUri = async (file) => {
  const svg = await readFile(path.resolve('docs/brand', file), 'utf8');
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};

const run = async () => {
  const [wordmarkUri, markUri] = await Promise.all([
    dataUri('wordmark-horizontal.svg'),
    dataUri('mark.svg'),
  ]);

  const wm = place(WORDMARK, WORDMARK_INK_W / WORDMARK.ink.w);
  const mk = place(MARK, MARK_INK_H / MARK.ink.h);

  const wmLeft = MARGIN - wm.inkOffsetX;
  const wmTop = WORDMARK_INK_MID_Y - (wm.inkOffsetY + wm.inkH / 2);
  const markRight = MARK_MARGIN - mk.inkInsetRight;
  const markTop = H / 2 - (mk.inkOffsetY + mk.inkH / 2);
  /* The tagline sits a fixed gap under the wordmark's ink, not under its canvas. */
  const taglineTop = WORDMARK_INK_MID_Y + wm.inkH / 2 + 40;

  const html = `<!doctype html><meta charset="utf-8"><style>
    * { margin: 0; }
    body {
      width: ${W}px; height: ${H}px; overflow: hidden; position: relative;
      background: #07080a;
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    /* The padding around each mark's ink overflows the frame on purpose; the
       canvas ground is the same carbon as the body, so it crops invisibly. */
    .wordmark { position: absolute; height: ${wm.canvasH}px;
                left: ${wmLeft}px; top: ${wmTop}px; }
    .mark { position: absolute; height: ${mk.canvasH}px;
            right: ${markRight}px; top: ${markTop}px; }
    p { position: absolute; left: ${MARGIN}px; top: ${taglineTop}px;
        color: #9a9ca0; font-size: 30px; letter-spacing: 0.02em; }
    /* The one accent moment, matching the shipped default (matte orange). */
    strong { color: #e08c38; font-weight: 500; }
  </style>
  <img class="wordmark" src="${wordmarkUri}" alt="">
  <img class="mark" src="${markUri}" alt="">
  <p>A six-letter word game — <strong>one board a day</strong></p>`;

  const browser = await launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: OUT });
  await browser.close();

  const buf = await readFile(OUT);
  const [w, h, colorType] = [buf.readUInt32BE(16), buf.readUInt32BE(20), buf[25]];
  if (w !== W || h !== H) {
    throw new Error(`play-feature-graphic.png is ${w}×${h}, wanted ${W}×${H}`);
  }
  if (colorType !== COLOR_TYPE_RGB) {
    throw new Error(
      `play-feature-graphic.png has PNG color type ${colorType}, wanted ${COLOR_TYPE_RGB} (no alpha)`,
    );
  }
  process.stdout.write(`play-feature-graphic.png ${w}×${h}, ${buf.length} bytes, no alpha\n`);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
