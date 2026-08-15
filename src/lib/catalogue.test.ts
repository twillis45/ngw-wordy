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
    // A catalogue exists at all. This started at 1000+ when it was 395 padded
    // boards; the rebuild deliberately shrank it toward boards that are about
    // something, so a row-count floor written against the old size fires on the
    // work succeeding.
    expect(rows).toBeGreaterThan(400);
    // Measured 0.641 across 88 boards, against 0.216 across 395 before the
    // rebuild. The floor moves up with each pack: a ratchet that never tightens
    // stops meaning anything.
    expect(rate).toBeGreaterThanOrEqual(0.60);
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
    /*
     * ZERO. Not a budget — the finish line.
     *
     * This began at 291 of 395 boards carrying fewer than two on-theme rows,
     * and 113 of those carried NONE. Every theme has now been rebuilt
     * vocabulary-first against a bench-signed word list, and the count is out.
     *
     * It is asserted at zero rather than at a tolerance because the owner's
     * original complaint was about exactly these boards, and leaving headroom
     * here would be leaving room to reintroduce them.
     */
    expect(bad.length, `boards under 2 on-theme rows: ${bad.length}. e.g. ${sample}`).toBe(0);
  });
});

/**
 * The pack rules, applied to the corpus that actually ships.
 *
 * `scripts/check-pack.mjs` holds these and runs on a STAGED pack file, by
 * hand, before a merge. That is the right place to catch a bad pack and the
 * wrong place to be the only check: what ships is `data/themes.json`, the
 * merged corpus, and a board edited there after its pack was merged is
 * measured by nothing. CI runs check-pack over `data/packs/*.json` now (#5),
 * which still leaves the merged file unwatched.
 *
 * I twice said this could not be done because themes.json did not carry the
 * pack grouping. It does — every puzzle has `theme`, all 14 themes have a
 * vocabulary entry, and the board counts agree with the pack files. That was a
 * claim made from memory instead of from the data.
 */
describe('the pack rules, on the merged corpus', () => {
  const tier = (entry: Record<string, string>, name: string) =>
    new Set(String(entry?.[name] ?? '').split(/\s+/).filter(Boolean));

  const byTheme = new Map<string, Board[]>();
  for (const b of boards.filter((b) => b.clues)) {
    if (!byTheme.has(b.theme)) byTheme.set(b.theme, []);
    byTheme.get(b.theme)!.push(b);
  }

  it('no shipped board is about nothing', () => {
    /*
     * Two on-theme rows, of either tier — the floor check-pack settled on
     * after the pair rule was measured running opposite to strength. See its
     * comment for why it is strength rather than composition.
     */
    const thin: string[] = [];
    for (const [id, group] of byTheme) {
      const entry = vocab[id] ?? {};
      const named = new Set([...tier(entry, 'named'), ...tier(entry, 'acts')]);
      const said = new Set([...tier(entry, 'said'), ...tier(entry, 'titles')]);
      for (const b of group) {
        const rows = Object.keys(b.clues).filter((w) => w !== b.base);
        const on = rows.filter((w) => named.has(w) || said.has(w)).length;
        if (on < 2) thin.push(`${id}/${b.base}: ${on} on-theme rows`);
      }
    }
    expect(thin, `${thin.length} boards are about nothing`).toEqual([]);
  });

  it('every pack still teaches somebody a name', () => {
    /*
     * A third of the boards must carry a row from the `named`/`acts` tier — a
     * pack of pure titles is one a player finishes without learning who made
     * any of it. The floor is a third because that is what the reference pack
     * can meet: rnb90s sits at 7 of 12, and it is the strongest in the
     * catalogue. Every other theme is currently at 100%, so this rule is doing
     * almost no work outside rnb90s — worth knowing before anyone reads a
     * green run as evidence the vocabularies are tight.
     */
    const short: string[] = [];
    for (const [id, group] of byTheme) {
      const entry = vocab[id] ?? {};
      const named = new Set([...tier(entry, 'named'), ...tier(entry, 'acts')]);
      const withName = group.filter((b) =>
        Object.keys(b.clues).filter((w) => w !== b.base).some((w) => named.has(w))
      ).length;
      const need = Math.ceil(group.length / 3);
      if (withName < need) short.push(`${id}: ${withName} of ${group.length} name an act, needs ${need}`);
    }
    expect(short, `${short.length} packs never name anybody`).toEqual([]);
  });

  it('no row word is worn out inside its own pack', () => {
    /*
     * check-pack's frequency cap: a row appearing more than three times in one
     * pack stops being the theme's language and starts being filler the base
     * pool made easy.
     */
    const over: string[] = [];
    for (const [id, group] of byTheme) {
      const freq = new Map<string, number>();
      for (const b of group) {
        for (const w of Object.keys(b.clues).filter((w) => w !== b.base)) {
          freq.set(w, (freq.get(w) ?? 0) + 1);
        }
      }
      for (const [w, n] of freq) if (n > 3) over.push(`${id}/${w} x${n}`);
    }
    expect(over, `${over.length} row words over the cap`).toEqual([]);
  });
});
