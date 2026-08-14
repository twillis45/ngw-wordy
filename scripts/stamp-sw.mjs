/**
 * Stamp the service worker's cache name with a build fingerprint.
 *
 * The cache version WAS a hand-edited constant, and its own comment recorded
 * the flaw: "any future content correction must bump this too." That is a
 * correctness guarantee resting on human memory, and it failed — a live deploy
 * and a local rebuild both kept serving superseded assets in one session, and
 * the only cure was unregistering the worker by hand. Players cannot do that,
 * and a store binary cannot be fixed by redeploying.
 *
 * The fingerprint hashes asset CONTENT, not filenames, and that distinction was
 * bought by getting it wrong: hashing names looked deterministic and was not,
 * because Next mints a fresh build id per run and the whole
 * `_next/static/<buildId>/` path moves with it. Two identical builds produced
 * two different cache names, which would evict every player's warm cache on any
 * redeploy — the opposite of the intent.
 *
 * Content hashing gives the property actually wanted: a build that changes
 * nothing produces the same id, and any real change to shipped bytes moves it.
 * puzzles.json is included for the same reason it always mattered — its URL is
 * stable, so nothing else would move when the catalogue is corrected, and
 * reaching installed players with a correction is why this exists at all.
 *
 * Runs after `next build`, over the export in out/.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');
const SW = path.join(OUT, 'sw.js');

if (!fs.existsSync(SW)) {
  console.error('stamp-sw: no out/sw.js — run next build first.');
  process.exit(1);
}

/** Every emitted asset path, sorted so the hash is order-independent. */
function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(path.relative(OUT, full));
  }
  return acc;
}

const names = walk(path.join(OUT, '_next')).sort();
const hash = createHash('sha256');

/*
 * Content only — never the path. `_next/static/<buildId>/…` carries a build id
 * that changes on every run, so any name in the digest makes it change too.
 * Each file's own digest is folded in, sorted, so the result does not depend on
 * traversal order either.
 */
const digests = names
  .map((rel) => createHash('sha256').update(fs.readFileSync(path.join(OUT, rel))).digest('hex'))
  .sort();
for (const d of digests) hash.update(d);

/*
 * puzzles.json too. Its URL never changes, so nothing else in this hash would
 * move when the catalogue does — and shipping a corrected catalogue to an
 * already-installed player is the original reason a version constant existed.
 */
const puzzles = path.join(OUT, 'data', 'puzzles.json');
if (fs.existsSync(puzzles)) hash.update(fs.readFileSync(puzzles));

const id = `wordy-${hash.digest('hex').slice(0, 12)}`;
const src = fs.readFileSync(SW, 'utf8');

if (!src.includes('__BUILD_ID__')) {
  console.error('stamp-sw: placeholder __BUILD_ID__ not found in out/sw.js.');
  console.error('The worker would ship with a dev cache name. Failing the build.');
  process.exit(1);
}

fs.writeFileSync(SW, src.replaceAll('__BUILD_ID__', id));
console.log(`stamp-sw: ${id} (${names.length} assets)`);
