import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Contrast claims made in prose, asserted in code.
 *
 * globals.css is full of measured ratios — "10.27:1 on a panel", "3.52:1",
 * "past the 3:1 floor" — and until now not one of them was checked by
 * anything. A number in a comment is a claim that was true when it was typed;
 * nothing stops a retune from falsifying it, and this file has already proved
 * that happens. Two comments in it WERE stale when this file was written: the
 * selection amber said "7.53:1 on the letter and 7.59:1 against the panel"
 * when the tokens computed 6.96 and 7.01, and the studio edge paragraph
 * reasoned about "#66717d gives 3.30:1 on a tile" one de-blue pass after the
 * token became #6c6e73. Both drifted the same way — the value moved and the
 * prose did not. Both are corrected, and both are asserted below, which is
 * the only version of "corrected" that stays true.
 *
 * So the hexes are READ FROM THE STYLESHEET rather than repeated here. A test
 * holding its own copy of #c2c4c8 would keep passing after somebody retuned
 * the token, which is the failure it exists to catch.
 */

const CSS = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

/**
 * The declarations inside one selector's block.
 *
 * Naive `indexOf(selector)` then `indexOf('}')` stops at the first nested
 * brace, and these blocks contain color-mix() and comments full of braces.
 * Counting depth from the opening brace is the only version that survives
 * the file as it actually reads.
 */
function block(selector: string): string {
  const start = CSS.indexOf(selector);
  if (start === -1) throw new Error(`no such selector in globals.css: ${selector}`);
  const open = CSS.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < CSS.length; i += 1) {
    if (CSS[i] === '{') depth += 1;
    else if (CSS[i] === '}') {
      depth -= 1;
      if (depth === 0) return CSS.slice(open + 1, i);
    }
  }
  throw new Error(`unterminated block for ${selector}`);
}

/** A custom property's hex value, or a failure naming what was missing. */
function token(scope: string, name: string): string {
  const m = block(scope).match(
    new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,6})\\b`)
  );
  if (!m) throw new Error(`--${name} is not a plain hex inside ${scope}`);
  return m[1];
}

function rgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** WCAG 2.x relative luminance. */
function luminance(hex: string): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.x contrast ratio, rounded the way the comments quote it. */
function ratio(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  const hi = Math.max(x, y);
  const lo = Math.min(x, y);
  return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2));
}

describe('contrast claims in globals.css', () => {
  /*
   * The claim, verbatim from the --color-text-secondary comment in the studio
   * block:
   *
   *   "#c2c4c8 is a luminance match, not a guess: 10.27:1 on a panel against
   *    the old 10.54:1, so nothing in the reading hierarchy moves — only the
   *    hue."
   *
   * That number is the whole argument for the change. Secondary text was
   * #a9caeb — 66 blue-over-red against a ramp built to sit near 3 — and the
   * defence for swapping it was that the READING did not move, only the
   * colour. If a later retune drifts the ratio, the swap silently stops being
   * a luminance match and becomes a legibility change nobody signed off.
   */
  const STUDIO = ":root[data-theme='studio']";

  it('studio secondary text holds 10.27:1 on a panel, as its comment claims', () => {
    const secondary = token(STUDIO, 'color-text-secondary');
    const panel = token(STUDIO, 'color-carbon-panel');
    expect(ratio(secondary, panel)).toBe(10.27);
  });

  it('and that ratio clears AAA for body text, which is why it can be quiet', () => {
    // 7:1 is WCAG 1.4.6. The comment's case is that the hue changed and the
    // legibility did not, so the floor it clears matters as much as the digits.
    const secondary = token(STUDIO, 'color-text-secondary');
    const panel = token(STUDIO, 'color-carbon-panel');
    expect(ratio(secondary, panel)).toBeGreaterThanOrEqual(7);
  });

  /*
   * The selection amber, from the --color-select comment in @theme:
   *
   *   "It is LIGHT with a dark letter, which is the opposite of every other
   *    tile, and that inversion is most of the effect: 6.96:1 on the letter
   *    and 6.99:1 against the panel behind it."
   *
   * The inversion IS the mechanic — every other tile is dark with a light
   * letter — so both halves have to hold: the ink must stay readable ON the
   * amber, and the amber must stay separable FROM the panel it sits on. One
   * number moving without the other means the tile has stopped being the
   * loudest thing on the board or stopped being legible, and the comment
   * calls it "the single most important job on the board".
   */
  const DARK = '@theme';

  it('the selection amber holds 6.96:1 on its own letter', () => {
    expect(ratio(token(DARK, 'color-select'), token(DARK, 'color-select-ink'))).toBe(6.96);
  });

  it('and 6.99:1 against the panel behind it', () => {
    /*
     * 7.01 until 2026-08-17. The amber did not move — the PANEL did, when the
     * carbon ramp was de-blued from #121518 to #141517. Two hundredths, from a
     * change that held luminance deliberately, and the gate caught it anyway,
     * which is the whole reason the figure is pinned to two decimals rather
     * than asserted as "about 7".
     */
    expect(ratio(token(DARK, 'color-select'), token(DARK, 'color-carbon-panel'))).toBe(6.99);
  });

  it('keeps the amber past AA on its letter, which is what makes it usable', () => {
    // 4.5:1 is WCAG 1.4.3. The comment's own defence of the colour is that the
    // ink contrast is "still well past AA" after the saturation raise.
    expect(
      ratio(token(DARK, 'color-select'), token(DARK, 'color-select-ink'))
    ).toBeGreaterThanOrEqual(4.5);
  });

  /*
   * The studio edge, from its comment: "the value below gives 3.52:1 on a
   * panel, 3.78:1 on the page and 3.30:1 on a raised surface. Past the 3:1
   * floor everywhere."
   *
   * The floor is the load-bearing part. This theme deletes the border from the
   * dial and its tiles and leans on fill separation instead, and the edge that
   * REMAINS — on chips, cards, the clue box, empty slots — is the only thing
   * identifying those components. WCAG 1.4.11 asks 3:1 of exactly that. The
   * edge was quietened from ~13:1 on purpose; this is the line it must not
   * cross while being quietened further.
   */
  it('the studio edge clears the 3:1 floor on every surface it outlines', () => {
    const edge = token(STUDIO, 'color-edge');
    expect(ratio(edge, token(STUDIO, 'color-carbon-panel'))).toBe(3.52);
    expect(ratio(edge, token(STUDIO, 'color-carbon-body'))).toBe(3.78);
    expect(ratio(edge, token(STUDIO, 'color-carbon-surface-2'))).toBe(3.3);
    for (const surface of ['color-carbon-panel', 'color-carbon-body', 'color-carbon-surface-2']) {
      expect(ratio(edge, token(STUDIO, surface))).toBeGreaterThanOrEqual(3);
    }
  });

  it('reads the hexes from the stylesheet, so a retune moves the test with it', () => {
    // Guards the guard: if this ever stops finding real hex values, the two
    // assertions above would be comparing something meaningless and still
    // reporting green.
    expect(token(STUDIO, 'color-text-secondary')).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(token(STUDIO, 'color-carbon-panel')).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});
