#!/usr/bin/env node
/**
 * Query and validate the grounded cultural canon.
 *
 * The canon (data/canon.json) records what the themed clues rest on: which
 * factual claims were checked, against what, and which are still open. See
 * docs/research/CANON.md for the entry contract.
 *
 * Usage:
 *   node scripts/canon.mjs               summary by cluster and verdict
 *   node scripts/canon.mjs juneteenth    entries grounding one cluster
 *   node scripts/canon.mjs --open        only what still needs a human
 *   node scripts/canon.mjs --check       validate refs, sources, schema
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const canon = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'canon.json'), 'utf8'));
const themes = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'themes.json'), 'utf8'));

const VERDICTS = ['verified', 'corrected', 'unverifiable', 'tone'];
const KINDS = ['primary', 'scholarship', 'community'];

/** theme/base/word -> the live clue text, for reference checking. */
const live = new Map();
for (const p of themes.puzzles) {
  for (const [word, clue] of Object.entries(p.clues)) {
    live.set(`${p.theme}/${p.base}/${word}`, clue);
  }
}

/**
 * Validate the store.
 *
 * The reference check is the one that earns its keep: a citation pointing at a
 * clue that has since been rewritten is worse than no citation, because it
 * reads as evidence for text nobody ever checked.
 */
export function check(entries = canon.entries) {
  const errs = [];
  const ids = new Set();
  for (const e of entries) {
    const at = e.id ?? '(no id)';
    if (!e.id) errs.push('an entry has no id');
    if (ids.has(e.id)) errs.push(`${at}: duplicate id`);
    ids.add(e.id);
    if (!e.cluster) errs.push(`${at}: no cluster`);
    if (!e.claim) errs.push(`${at}: no claim`);
    if (!VERDICTS.includes(e.verdict)) errs.push(`${at}: verdict "${e.verdict}" not one of ${VERDICTS.join('/')}`);

    const sources = e.sources ?? [];
    // A tone question is a question, not an assertion, so it needs no source.
    // Everything else is a claim about the world and does.
    if (e.verdict !== 'tone' && sources.length === 0) {
      errs.push(`${at}: ${e.verdict} entry with no source`);
    }
    for (const s of sources) {
      if (!s.url || !/^https?:\/\//.test(s.url)) errs.push(`${at}: source without a URL`);
      if (!KINDS.includes(s.kind)) errs.push(`${at}: source kind "${s.kind}" not one of ${KINDS.join('/')}`);
    }

    for (const c of e.clues ?? []) {
      const key = `${c.theme}/${c.base}/${c.word}`;
      if (!live.has(key)) errs.push(`${at}: cites ${key}, which is not a live clue`);
    }
    if (e.verdict === 'corrected' && !e.replacement) {
      errs.push(`${at}: corrected but carries no replacement`);
    }
  }
  return errs;
}

const arg = process.argv[2];

if (arg === '--check') {
  const errs = check();
  if (errs.length) {
    process.stdout.write(`${errs.length} problem(s):\n${errs.map((e) => `  - ${e}`).join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write(`canon OK — ${canon.entries.length} entries, all references resolve\n`);
} else if (arg === '--open') {
  const open = canon.entries.filter((e) => e.verdict === 'tone' || e.verdict === 'unverifiable');
  if (!open.length) process.stdout.write('nothing open\n');
  for (const e of open) {
    process.stdout.write(`\n[${e.verdict}] ${e.cluster} — ${e.claim}\n  ${e.detail ?? ''}\n`);
    for (const c of e.clues ?? []) {
      process.stdout.write(`    ${c.theme}/${c.base}/${c.word}: ${live.get(`${c.theme}/${c.base}/${c.word}`) ?? '(missing)'}\n`);
    }
  }
} else if (arg && !arg.startsWith('-')) {
  const hits = canon.entries.filter((e) => e.cluster === arg);
  if (!hits.length) process.stdout.write(`no entries for cluster "${arg}"\n`);
  for (const e of hits) {
    process.stdout.write(`\n[${e.verdict}] ${e.claim}\n`);
    if (e.detail) process.stdout.write(`  ${e.detail}\n`);
    for (const s of e.sources ?? []) process.stdout.write(`  · (${s.kind}) ${s.title} ${s.url}\n`);
  }
} else {
  const byCluster = new Map();
  for (const e of canon.entries) {
    const row = byCluster.get(e.cluster) ?? { verified: 0, corrected: 0, unverifiable: 0, tone: 0 };
    row[e.verdict] += 1;
    byCluster.set(e.cluster, row);
  }
  if (!byCluster.size) {
    process.stdout.write('canon is empty — research is still running.\n');
  }
  for (const [cluster, r] of [...byCluster].sort()) {
    process.stdout.write(
      `${cluster.padEnd(18)} verified ${String(r.verified).padStart(3)} · corrected ${String(r.corrected).padStart(3)}` +
        ` · unverifiable ${String(r.unverifiable).padStart(3)} · needs a human ${String(r.tone).padStart(3)}\n`
    );
  }
  const errs = check();
  process.stdout.write(`\n${canon.entries.length} entries · ${errs.length ? `${errs.length} PROBLEMS (run --check)` : 'all references resolve'}\n`);
}
