/**
 * Build the packet a paid community reader actually receives.
 *
 * STORE_READINESS 1.10 is the only blocker no engineering closes: `AGENTS.md`
 * budgets "a real reader per pack before anything ships commercially", and it
 * has not happened for any pack. This script produces the thing you hand them.
 *
 * It is NOT `canon.mjs --brief`. That brief covers only what RESEARCH could not
 * settle — four questions, none of them in the three biggest packs — because it
 * is generated from canon.json and canon.json records research, not review. A
 * reader looking at an unreviewed pack needs the pack.
 *
 * Two things it marks that a plain clue dump would not:
 *
 *   1. Clues carrying a CANON CITATION. Those are factual claims with a source
 *      behind them, so "that's wrong" costs more than an edit — `npm test`
 *      fails when a cited clue changes without its canon entry, deliberately.
 *      A reader should know which sentences are load-bearing.
 *   2. The theme's OPEN questions, inlined from canon.json, so the reader is not
 *      asked to rediscover what research already flagged and could not settle.
 *
 *   node scripts/reader-packet.mjs cookout       one pack
 *   node scripts/reader-packet.mjs --all         every pack with boards
 *
 * Writes docs/research/packets/<theme>.md. Reads data/themes.json — the merged
 * corpus, which is what actually ships — so a packet can never quote a clue that
 * was replaced in a rebuild. The existing READER_BRIEF does exactly that today:
 * two of its four questions cite boards that are no longer in the corpus.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const at = (p) => path.join(ROOT, p);
const readJson = (p) => JSON.parse(fs.readFileSync(at(p), 'utf8'));

const themes = readJson('data/themes.json');
const canon = readJson('data/canon.json');
const OUT_DIR = at('docs/research/packets');

/** theme id -> Map("base|word" -> canon entry), so a clue can be marked. */
function citationIndex() {
  const idx = new Map();
  for (const e of canon.entries ?? []) {
    for (const c of e.clues ?? []) {
      const key = `${c.theme}|${c.base}|${c.word}`;
      idx.set(key, e);
    }
  }
  return idx;
}

/*
 * Canon CLUSTERS are research-doc names; packs are theme ids. Nothing in the
 * repo mapped one to the other, and the obvious fallback — follow the clue
 * citations — does not work: the vocabulary-first rebuild CLEARED the citations
 * on 33 of 38 entries, so only `the-nineties` still points at a live clue.
 * `canon --check` passes regardless, because a cleared reference resolves
 * trivially.
 *
 * So the map is explicit, and anything it cannot route is REPORTED rather than
 * dropped. A research finding that silently reaches no reader is the same
 * failure as no research at all.
 */
const CLUSTER_THEMES = {
  foodways: ['cookout', 'sunday', 'texas'],
  'the-shop': ['barbershop', 'beautysupply'],
  'the-nineties': ['rnb90s'],
  'music-and-games': ['rnb90s', 'spades', 'steppers'],
  institutions: ['hbcu', 'church'],
  juneteenth: ['juneteenth'],
};

/** Questions research could not settle, for one theme. */
function openFor(themeId) {
  return (canon.entries ?? []).filter(
    (e) =>
      ['tone', 'unverifiable'].includes(e.verdict) &&
      ((CLUSTER_THEMES[e.cluster] ?? []).includes(themeId) ||
        (e.clues ?? []).some((c) => c.theme === themeId))
  );
}

/** Open findings this run could not route to any pack. */
function unroutable() {
  const open = (canon.entries ?? []).filter((e) =>
    ['tone', 'unverifiable'].includes(e.verdict)
  );
  return open.filter(
    (e) => !(CLUSTER_THEMES[e.cluster] ?? []).length && !(e.clues ?? []).length
  );
}

function packet(themeId) {
  const theme = themes.themes.find((t) => t.id === themeId);
  if (!theme) throw new Error(`no such theme: ${themeId}`);
  const boards = themes.puzzles.filter((p) => p.theme === themeId);
  if (!boards.length) throw new Error(`${themeId} has no boards`);

  const cites = citationIndex();
  const clueCount = boards.reduce((n, b) => n + Object.keys(b.clues ?? {}).length, 0);
  const L = [];

  L.push(`# Reader packet — ${theme.name}`);
  L.push('');
  L.push(`*${theme.blurb}*`);
  L.push('');
  L.push(
    `**${boards.length} boards · ${clueCount} clues.** Generated from ` +
      '`data/themes.json`, the corpus that actually ships.'
  );
  L.push('');
  L.push('## What we are asking you for');
  L.push('');
  L.push(
    'This is a word game. Each board is six letters, and every row is a word ' +
      'spelled from them. The clue is what the player reads.'
  );
  L.push('');
  L.push(
    'The clues in this pack were written from research and from a structured ' +
      'review process — **not** from community consultation. That distinction ' +
      'is written into the project rules, and you are the part that was missing. ' +
      'You are being paid for judgment, not for proofreading.'
  );
  L.push('');
  L.push('The question for every clue is the same: **does this land?**');
  L.push('');
  L.push('- If it lands, say so. "It\'s fine" is a real answer and a useful one.');
  L.push('- If it does not, say what is wrong — inaccurate, flattening, dated, ');
  L.push('  a stereotype, too inside, not inside enough, or just not how anyone talks.');
  L.push('- If it is close, say what would fix it.');
  L.push('');
  L.push(
    'You do not need to be fair to the writing. A clue that is merely *fine* ' +
      'is worth flagging if it should have been better.'
  );
  L.push('');
  L.push('**⚑ marks a clue with a source behind it.** Those are factual claims — ');
  L.push('if one is wrong, that matters more than a clue that is only flat, and it ');
  L.push('takes a correction to the record as well as to the sentence.');
  L.push('');

  const open = openFor(themeId);
  if (open.length) {
    L.push('## Questions research could not settle');
    L.push('');
    L.push('These are already known to be open. They need someone who has lived it.');
    L.push('');
    for (const e of open) {
      L.push(`### ${e.claim}`);
      L.push('');
      L.push(e.detail.replace(/\s*\[\d{4}-\d{2}-\d{2}:[^\]]*\]/g, '').trim());
      L.push('');
      /*
       * A finding whose citations were cleared is no longer attached to any
       * shipped clue, and its wording may quote one that was replaced — which
       * is exactly how READER_BRIEF.md ended up asking about "the old word for
       * the cut", a clue that is not in the corpus. Say so rather than let a
       * paid reader spend judgement on text nobody ships.
       */
      if (!(e.clues ?? []).length) {
        L.push(
          '> ⚠︎ This finding is no longer attached to a specific clue — the ' +
            'board it was raised against was replaced in a rebuild. If it ' +
            'quotes wording you cannot find in the boards below, answer the ' +
            'question in general and ignore the quote.'
        );
        L.push('');
      }
      L.push('**Your answer:**');
      L.push('');
      L.push('');
    }
  }

  L.push('## The boards');
  L.push('');
  for (const [i, b] of boards.entries()) {
    L.push(`### ${i + 1}. ${b.base.toUpperCase()}`);
    if (b.scene) L.push(`*${b.scene}*`);
    L.push('');
    const rows = Object.entries(b.clues ?? {}).sort(
      (a, x) => x[0].length - a[0].length
    );
    for (const [word, clue] of rows) {
      const cited = cites.get(`${themeId}|${b.base}|${word}`);
      L.push(`- ${cited ? '⚑ ' : ''}**${word}** — ${clue}`);
    }
    L.push('');
    L.push('**Verdict:**');
    L.push('');
    L.push('');
  }

  L.push('## The pack as a whole');
  L.push('');
  L.push('Three questions the individual clues cannot answer:');
  L.push('');
  L.push('1. **Is anything missing?** What belongs in a pack about this and is not here?');
  L.push('2. **Is anyone missing?** Whose version of this is not represented — ');
  L.push('   a region, a generation, a denomination, a class position?');
  L.push('3. **Would you send this to someone?** If not, what would have to change?');
  L.push('');
  L.push('**Your answer:**');
  L.push('');
  L.push('');
  L.push('---');
  L.push('');
  L.push('*Reader: ______________________  Date: ______________*');
  L.push('');
  return L.join('\n');
}

const arg = process.argv[2];
if (!arg) {
  console.error('usage: node scripts/reader-packet.mjs <theme-id> | --all');
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const counts = {};
for (const p of themes.puzzles) counts[p.theme] = (counts[p.theme] ?? 0) + 1;
const targets =
  arg === '--all'
    ? themes.themes.map((t) => t.id).filter((id) => counts[id])
    : [arg];

for (const id of targets) {
  const md = packet(id);
  const file = path.join(OUT_DIR, `${id}.md`);
  fs.writeFileSync(file, md);
  const cited = (md.match(/⚑/g) ?? []).length - 1; // less the legend
  const open = openFor(id).length;
  console.log(
    `  ${path.relative(ROOT, file)}  ${counts[id]} boards · ` +
      `${Math.max(0, cited)} cited clues · ${open} open question(s)`
  );
}

const orphans = unroutable();
if (orphans.length) {
  console.log(
    `\n${orphans.length} open finding(s) reach NO pack — cluster unmapped and ` +
      'citations cleared:'
  );
  for (const e of orphans) console.log(`  [${e.cluster}] ${e.claim.slice(0, 78)}`);
  console.log('Add the cluster to CLUSTER_THEMES, or re-cite the entry.');
}
