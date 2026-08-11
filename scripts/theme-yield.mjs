/**
 * Vocabulary-first board discovery.
 *
 * The old pipeline ran base -> rows -> clues: pick a base that is structurally
 * legal, accept whatever rows the letters happen to spell, then write clues
 * that drag those rows toward the theme. That is how `SLOWER -> swore worse
 * rose wore slow` ended up in a 90s R&B pack, and why the rows read obscure
 * rather than clever. The clue was doing work the board could not support.
 *
 * This runs the other way: vocabulary -> boards -> clues.
 *
 *   1. `data/theme-vocab.json` states the theme's language.
 *   2. Every legal six-letter base is scored by how many DISTINCT vocabulary
 *      ideas it spells. Plurals fold onto their stem — `label` and `labels`
 *      are one idea, and counting them twice is how a thin board looks full.
 *   3. Boards that clear the bar ARE the pack. Pack size is an output, not a
 *      target. Filling a pack past what its vocabulary supports is what
 *      produced the padding in the first place.
 *
 * A theme that yields four boards is a four-board theme. Group it under a
 * category with its siblings rather than padding it to twenty.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isBlocked } from './lib/blocklist.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** How many distinct ideas a board must spell to be worth authoring. */
const BAR = Number(process.env.BAR ?? 2);
/** A base is six letters on a dial, so these are the same puzzle. */
const letterKey = (w) => [...w].sort().join('');
const mask = (w) => [...w].reduce((m, c) => m | (1 << (c.charCodeAt(0) - 97)), 0);
const distinct = (w) => new Set(w).size === w.length;

const enable = new Set(
  read('data/enable1.txt')
    .split('\n')
    .map((w) => w.trim())
    .filter(Boolean)
);
const popular = new Set(
  read('data/popular.txt')
    .split('\n')
    .map((w) => w.trim())
    .filter(Boolean)
);
const vocabFile = JSON.parse(read('data/theme-vocab.json'));
const themes = JSON.parse(read('data/themes.json'));
const claimed = new Map(themes.puzzles.map((p) => [letterKey(p.base), p.theme]));

/**
 * A vocabulary word is usable as a row only if the build would ever serve it:
 * in the dictionary, common enough to be fair, and short enough to fit.
 */
/**
 * A vocabulary is either a flat string or tiers. Tiers exist because not every
 * on-theme word is equally on-theme: a row reading `silk` or `creep` is a thing
 * the player RECOGNISES, and a row reading `sigh` is merely music-adjacent.
 * Ranking by raw count put the generic boards on top.
 */
const TIER_WEIGHT = {
  // Tier 1 — the named things a person in this world would recognise on sight:
  // acts and records for music, dishes and games for a cookout, the roles and
  // rites for a church. A row here is the reason a board exists.
  acts: 3,
  named: 3,
  // Tier 2 — what people inside the world actually SAY. Jargon, verbs, terms of
  // art. True to the theme, but a row here alone does not make a board.
  titles: 2,
  said: 2,
  // Tier 3 — supporting texture. Never a board's reason to exist, and the
  // `known` count deliberately excludes it.
  voice: 1,
};

function tiersOf(entry) {
  if (typeof entry === 'string') return { titles: entry };
  // Underscore keys are prose — a `_blocked` note explaining why a theme is
  // empty was being tokenised as vocabulary, so a theme with no words scored
  // seven boards off its own explanation.
  return Object.fromEntries(Object.entries(entry).filter(([k]) => !k.startsWith('_')));
}

function usable(list) {
  // Collect the surface forms first, then fold, so a plural listed BEFORE its
  // stem still merges. Doing it in one pass double-counted `order`/`orders`.
  const words = new Set();
  for (const raw of list.split(/\s+/)) {
    const w = raw.trim().toLowerCase();
    if (w.length < 3 || w.length > 6) continue;
    // A base is six DISTINCT letters, so a row can never repeat one. The
    // subset test below is a bitmask and would happily accept `cool` from
    // {c,o,l,...}; it cannot be the thing that enforces this.
    if (!distinct(w)) continue;
    if (!enable.has(w) || !popular.has(w) || isBlocked(w)) continue;
    words.add(w);
  }
  const seen = new Map(); // stem -> Set of surface forms
  for (const w of words) {
    const stem = w.endsWith('s') && words.has(w.slice(0, -1)) ? w.slice(0, -1) : w;
    if (!seen.has(stem)) seen.set(stem, new Set());
    seen.get(stem).add(w);
  }
  return seen;
}

const bases = [...enable].filter(
  (w) => w.length === 6 && distinct(w) && popular.has(w) && !isBlocked(w)
);

const report = [];
for (const [id, list] of Object.entries(vocabFile)) {
  if (id.startsWith('_')) continue;
  const tiers = tiersOf(list);
  const ideas = usable(Object.values(tiers).join(' '));
  const tierOf = new Map();
  for (const [name, words] of Object.entries(tiers))
    for (const w of words.split(/\s+/)) if (!tierOf.has(w)) tierOf.set(w, name);

  const forms = [...ideas].flatMap(([stem, ws]) =>
    [...ws].map((w) => ({ w, stem, m: mask(w), tier: tierOf.get(w) ?? 'voice' }))
  );

  const boards = [];
  for (const base of bases) {
    const bm = mask(base);
    const hit = forms.filter((f) => (f.m & ~bm) === 0 && f.w !== base);
    const n = new Set(hit.map((f) => f.stem)).size;
    // Rank by recognition, not by count: one `silk` outweighs three `sigh`s.
    const best = new Map();
    for (const f of hit)
      if (!best.has(f.stem) || TIER_WEIGHT[f.tier] > TIER_WEIGHT[best.get(f.stem).tier])
        best.set(f.stem, f);
    const picked = [...best.values()];
    const weight = picked.reduce((s, f) => s + TIER_WEIGHT[f.tier], 0);
    const known = picked.filter((f) => f.tier !== 'voice').length;

    /*
     * THE BENCH'S BAR, and it replaced a flat count rather than adding to one.
     *
     * Three texture hits makes a word-list, not a scene — and the third tier
     * was defined from the start as never being a board's reason to exist, so
     * letting it clear the bar contradicted the file's own rule. A board needs
     * at least one row the player RECOGNISES and at least one the theme
     * actually SAYS. Texture counts toward neither, which is what `known`
     * already encodes.
     *
     * Keeping BAR at 3 ON TOP of this was the mistake: it scored HBCU at zero
     * against a vocabulary the bench had just rebuilt, which is the tool
     * contradicting the ruling it exists to implement.
     *
     * One part of their standard no machine can run, recorded so nobody
     * mistakes this for the whole test: do the six rows describe ONE moment?
     * Six correct nouns from six different afternoons fails at five-of-five.
     */
    const found = new Set(picked.map((f) => f.tier));
    if (!(found.has('named') || found.has('acts'))) continue;
    if (!(found.has('said') || found.has('titles'))) continue;
    if (known < BAR) continue;
    boards.push({
      base,
      ideas: n,
      known,
      weight,
      rows: picked.map((f) => `${f.w}:${f.tier}`),
      owner: claimed.get(letterKey(base)),
    });
  }
  // One board per set of ideas, not per letter-set. `DANCER`, `DANCES`,
  // `DEACON` and `CANDLE` are four different dials that all spell exactly
  // `dean cane dance` — to a player that is the same puzzle four times, and
  // counting them separately is how a two-board theme reports as five.
  const byKey = new Map();
  for (const b of boards.sort((a, c) => c.known - a.known || c.weight - a.weight)) {
    const k = [...new Set(b.rows.map((r) => r.split(":")[0]))].sort().join(" ");
    if (!byKey.has(k)) byKey.set(k, b);
  }
  const final = [...byKey.values()].sort((a, c) => c.known - a.known || c.weight - a.weight);
  const shipped = themes.puzzles.filter((p) => p.theme === id).length;
  report.push({ id, vocab: ideas.size, shipped, supported: final.length, boards: final });
}

report.sort((a, b) => b.supported - a.supported);

if (process.argv.includes('--json')) {
  fs.writeFileSync(path.join(ROOT, 'data/theme-yield.json'), JSON.stringify(report, null, 1));
  console.log(`wrote data/theme-yield.json — bar ${BAR}+ distinct ideas`);
} else {
  console.log(`bar: ${BAR}+ distinct on-theme ideas per board\n`);
  console.log('theme         vocab  shipped  supported   verdict');
  for (const r of report) {
    const gap = r.shipped - r.supported;
    const verdict = gap > 0 ? `cut ${gap}` : gap < 0 ? `room for ${-gap}` : 'right-sized';
    console.log(
      r.id.padEnd(13),
      String(r.vocab).padStart(5),
      String(r.shipped).padStart(8),
      String(r.supported).padStart(10),
      '  ' + verdict
    );
  }
  const totShipped = report.reduce((n, r) => n + r.shipped, 0);
  const totSupported = report.reduce((n, r) => n + r.supported, 0);
  console.log(`\ntotal: ${totShipped} shipped, ${totSupported} supported by vocabulary`);
  if (process.argv.includes('--boards')) {
    for (const r of report) {
      console.log(`\n${r.id} — ${r.supported} boards`);
      for (const b of r.boards.slice(0, 12))
        console.log(
          '  ',
          b.base.toUpperCase().padEnd(8),
          b.ideas,
          (b.owner ? `[${b.owner}]` : '[free]').padEnd(13),
          b.rows.join(' ')
        );
    }
  }
}
