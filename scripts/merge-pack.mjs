/**
 * Merge a staged pack from data/packs/ into data/themes.json.
 *
 * Two deletions happen here and both are deliberate:
 *
 *   1. The theme's existing boards are replaced wholesale. The pack IS the
 *      theme now — keeping the old ones alongside would reintroduce exactly
 *      the padding the pack exists to remove.
 *   2. Donor boards are dropped from other themes. A base is claimed by its
 *      letter-set, so a board can only live in one pack. Every donor board
 *      here was measured at 0-2 on-theme rows for its own theme before it was
 *      taken, so the donor loses its weakest board, not a good one. If that
 *      stops being true, this script should refuse rather than be edited.
 *
 * Nothing is committed. Run `git diff data/themes.json` before believing it.
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const at = (p) => path.join(ROOT, p);

const packPath = process.argv[2] ?? 'data/packs/nineties.json';

/*
 * check-pack is a GATE, not a suggestion.
 *
 * It was advisory, and that is how a board with an unspellable row reached the
 * catalogue: check-pack said `first: not spellable from births`, this script
 * merged the pack anyway, and only a re-run of the checker afterwards caught
 * it. Nothing else would have — `npm test` passed on the broken catalogue,
 * because the ratchet measures on-theme RATE and an unsolvable row is still an
 * on-theme row.
 *
 * Two commands where one had to be remembered in the right order is not a
 * process; it is a trap that fires on whoever is tired. Pass --force only to
 * inspect a diff you have no intention of committing.
 */
if (!process.argv.includes('--force')) {
  const { status } = spawnSync(
    process.execPath,
    [at('scripts/check-pack.mjs'), packPath],
    { stdio: 'inherit' }
  );
  if (status !== 0) {
    console.error(`\nrefusing to merge ${packPath} — fix the problems above.`);
    process.exit(1);
  }
}

const pack = JSON.parse(fs.readFileSync(at(packPath), 'utf8'));
const themes = JSON.parse(fs.readFileSync(at('data/themes.json'), 'utf8'));

const letterKey = (w) => [...w].sort().join('');
const wanted = new Set(pack.boards.map((b) => letterKey(b.base)));
const id = pack.theme.id;

const before = themes.puzzles.length;
const droppedDonors = themes.puzzles.filter(
  (p) => p.theme !== id && wanted.has(letterKey(p.base))
);
const droppedOwn = themes.puzzles.filter((p) => p.theme === id);

themes.puzzles = themes.puzzles.filter(
  (p) => p.theme !== id && !wanted.has(letterKey(p.base))
);

for (const b of pack.boards) {
  themes.puzzles.push({
    base: b.base,
    theme: id,
    clues: b.clues,
    prefer: Object.keys(b.clues).filter((w) => w !== b.base),
    scene: b.scene,
  });
}

const t = themes.themes.find((x) => x.id === id);
if (!t) throw new Error(`theme ${id} not found`);
t.name = pack.theme.name;
t.blurb = pack.theme.blurb;
t.category = pack.theme.category;

fs.writeFileSync(at('data/themes.json'), JSON.stringify(themes, null, 1) + '\n');

console.log(`${id} -> "${pack.theme.name}" (${pack.theme.category})`);
console.log(`  replaced ${droppedOwn.length} own boards with ${pack.boards.length}`);
console.log(`  took ${droppedDonors.length} bases from other packs:`);
for (const p of droppedDonors) console.log(`    ${p.base} from ${p.theme}`);
console.log(`  catalogue ${before} -> ${themes.puzzles.length}`);
