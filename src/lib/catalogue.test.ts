import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * A ratchet on themed content quality.
 *
 * The complaint that started this work was that answer rows were not related
 * to their theme — "not clever, just obscure" — and the measured cause was
 * that bases were chosen for structural legality and the theme applied
 * afterwards, as a label. The authoring method now runs the other way
 * (see scripts/theme-yield.mjs), but a method only holds if something checks.
 *
 * This does NOT assert the catalogue is good. It asserts it does not get
 * WORSE, which is the honest guarantee available while most vocabularies are
 * still waiting on the cultural bench's sign-off. The floors below are the
 * measured state on the day they were written, minus a small margin so that
 * ordinary authoring does not trip them.
 */
const root = process.cwd();
const themes = JSON.parse(fs.readFileSync(path.join(root, 'data/themes.json'), 'utf8'));
const vocab = JSON.parse(fs.readFileSync(path.join(root, 'data/theme-vocab.json'), 'utf8'));

const distinct = (w: string) => new Set(w).size === w.length;

/** The theme's language, filtered the way the build filters it. */
function wordsFor(id: string): Set<string> {
  const entry = vocab[id];
  if (!entry) return new Set();
  const text =
    typeof entry === 'string'
      ? entry
      : Object.entries(entry)
          .filter(([k]) => !k.startsWith('_'))
          .map(([, v]) => String(v))
          .join(' ');
  return new Set(text.split(/\s+/).filter((w) => w.length >= 3 && w.length <= 6 && distinct(w)));
}

type Board = { base: string; theme: string; clues: Record<string, string> };
const boards: Board[] = themes.puzzles;

describe('themed catalogue quality', () => {
  it('every theme in themes.json has a vocabulary to be measured against', () => {
    // A theme with no vocabulary cannot be scored, so it cannot be held to the
    // bar — which is exactly how unmeasured content accumulates.
    const ids = new Set(boards.map((b) => b.theme));
    const missing = [...ids].filter((id) => !(id in vocab));
    expect(missing, `themes with no vocabulary: ${missing.join(', ')}`).toEqual([]);
  });

  it('The Nineties holds its authored standard', () => {
    // The one pack built vocabulary-first, and the only one whose word list was
    // shaped by the bench's ruling. It is the reference, so it is held hardest.
    const words = wordsFor('rnb90s');
    const pack = boards.filter((b) => b.theme === 'rnb90s');
    expect(pack.length).toBeGreaterThanOrEqual(12); // the bench's floor
    const onTheme = pack.map(
      (b) => Object.keys(b.clues).filter((w) => w !== b.base && words.has(w)).length
    );
    const mean = onTheme.reduce((a, c) => a + c, 0) / pack.length;
    // Measured 4.00 of 5 against every tier of its vocabulary, and 3.7 counting
    // only the two tiers a player RECOGNISES (acts and titles). Either way the
    // pack it replaced averaged 0.64.
    expect(mean).toBeGreaterThanOrEqual(3.6);
    // And no single board is allowed to be the old kind of board.
    expect(Math.min(...onTheme)).toBeGreaterThanOrEqual(3);
  });

  it('the catalogue-wide on-theme rate does not slide backwards', () => {
    /*
     * A ratchet, not a target. Most vocabularies here are unreviewed, so the
     * absolute number is a lower bound and moving it up is authoring work.
     * What this catches is the regression: a pack added the old way, or a
     * vocabulary quietly gutted, both of which would drop this.
     */
    let rows = 0;
    let onTheme = 0;
    for (const b of boards) {
      const words = wordsFor(b.theme);
      for (const w of Object.keys(b.clues)) {
        if (w === b.base) continue;
        rows += 1;
        if (words.has(w)) onTheme += 1;
      }
    }
    const rate = onTheme / rows;
    expect(rows).toBeGreaterThan(1000);
    // Measured 0.220 across 383 boards after the cultural bench signed off the
    // vocabularies — 421 on-theme rows of 1,913. The floor sits just under so
    // ordinary authoring has room, and a slide is still caught.
    expect(rate).toBeGreaterThanOrEqual(0.21);
  });

  it('no themed board is left with fewer than two on-theme rows', () => {
    /*
     * The floor the owner's complaint was actually about. `SLOWER -> swore
     * worse rose wore slow` scored ZERO, and boards like it are what made the
     * catalogue read as obscure rather than clever.
     *
     * Reported as a count with examples rather than a bare boolean, because
     * when this fails the useful information is WHICH boards and how many.
     */
    const bad = boards
      .map((b) => ({
        base: b.base,
        theme: b.theme,
        n: Object.keys(b.clues).filter((w) => w !== b.base && wordsFor(b.theme).has(w)).length,
      }))
      .filter((x) => x.n < 2);
    const sample = bad.slice(0, 5).map((x) => `${x.theme}/${x.base}(${x.n})`).join(', ');
    // 283 of 383, measured against the vocabularies the cultural bench SIGNED
    // OFF, and 102 of those score zero. That is the real size of the authoring
    // debt, stated rather than rounded off, and the assertion exists so it
    // cannot drift up while nobody is looking.
    //
    // The gap is authoring, not possibility: scripts/theme-yield.mjs reports
    // 183 boards the signed-off vocabularies can support at the bench's bar,
    // against 100 that currently clear it. Every board taken off this count is
    // the work.
    expect(bad.length, `boards under 2 on-theme rows: ${bad.length}. e.g. ${sample}`).toBeLessThanOrEqual(290);
  });
});
