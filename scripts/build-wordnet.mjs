#!/usr/bin/env node
/**
 * Build data/wordnet.json — the clue source.
 *
 * REPLACES Webster's 1913, which was wrong on three counts at once:
 *
 *   1. Archaic. It defines a 1913 vocabulary in 1913 prose, so clues arrived
 *      full of "The issue in a writ of right" and needed a register filter to
 *      keep taxonomy and mineralogy out of a word game.
 *   2. Bigoted in places. Its ordinary entries use the racial language of
 *      their era — `obis` shipped with "sorcery... practiced among the negroes
 *      of the" — which had to be filtered at build time rather than fixed.
 *   3. Legally murky. The JSON transcription came from a repository that also
 *      carries a GPLv2 grant over its outputs. The underlying text is US
 *      public domain, but the provenance was never clean.
 *
 * WordNet is modern, curated by lexicographers, and its glosses are SHORT —
 * which is what a clue wants. Princeton's licence is permissive and explicitly
 * allows commercial use, so the provenance question closes too.
 *
 * Output shape is identical to the old webster.json ({ word: definition }), so
 * nothing downstream of `indexSource` had to change.
 *
 * Usage: node scripts/build-wordnet.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const DICT = require('wordnet-db').path;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'data', 'wordnet.json');

const POS = ['noun', 'verb', 'adj', 'adv'];

/**
 * Glosses carry usage examples after the definition, quoted WordNet-style with
 * a backtick and a single quote: "a domesticated carnivore; `the cat sat'".
 * The example is not a definition and reads as noise in a clue, so it goes.
 */
function cleanGloss(raw) {
  let g = raw.split(/;\s*[`"]/)[0].trim();
  // Some glosses are themselves a list of near-synonyms separated by
  // semicolons. The first clause is the definitional one.
  g = g.split(/;\s+/)[0].trim();
  g = g.replace(/\s+/g, ' ');
  if (!g) return null;
  return g.charAt(0).toUpperCase() + g.slice(1) + (/[.!?]$/.test(g) ? '' : '.');
}

/** offset -> gloss, per part of speech. */
function readData(pos) {
  const file = path.join(DICT, `data.${pos}`);
  const map = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    // The licence header is indented; real records start at column 0.
    if (!line || line.startsWith(' ')) continue;
    const bar = line.indexOf('|');
    if (bar === -1) continue;
    const offset = line.slice(0, 8);
    const gloss = cleanGloss(line.slice(bar + 1));
    if (gloss) map.set(offset, gloss);
  }
  return map;
}

/**
 * lemma -> first synset offset.
 *
 * The index lists a lemma's senses in frequency order, so the FIRST offset is
 * the sense a person is most likely to mean. Taking it is the whole reason
 * this produces usable clues rather than obscure ones.
 */
function readIndex(pos) {
  const file = path.join(DICT, `index.${pos}`);
  const out = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line || line.startsWith(' ')) continue;
    const parts = line.trim().split(/\s+/);
    const lemma = parts[0];
    if (!lemma || lemma.includes('_')) continue; // multi-word entries
    const synsetCnt = Number(parts[2]);
    const ptrCnt = Number(parts[3]);
    // lemma pos synset_cnt p_cnt [ptrs...] sense_cnt tagsense_cnt offsets...
    const firstOffset = parts[4 + ptrCnt + 2];
    if (!firstOffset || !synsetCnt) continue;
    out.set(lemma, firstOffset);
  }
  return out;
}

const byWord = {};
const stats = {};

/*
 * Part-of-speech priority.
 *
 * A noun gloss is the most concrete thing to clue — you can picture it — and
 * an adverb gloss is the least. Where a word exists as several parts of
 * speech, the most picturable one wins.
 */
for (const pos of POS) {
  const data = readData(pos);
  const index = readIndex(pos);
  let added = 0;
  for (const [lemma, offset] of index) {
    if (byWord[lemma]) continue; // earlier POS already claimed it
    const gloss = data.get(offset);
    if (!gloss) continue;
    byWord[lemma] = gloss;
    added += 1;
  }
  stats[pos] = added;
}

fs.writeFileSync(OUT, JSON.stringify(byWord));
const bytes = fs.statSync(OUT).size;
const lengths = Object.values(byWord).map((g) => g.length);
const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;

process.stdout.write(
  `Wrote ${Object.keys(byWord).length} definitions -> ${OUT}\n` +
    `  ${(bytes / 1024 / 1024).toFixed(1)} MB · avg gloss ${avg.toFixed(0)} chars\n` +
    `  by part of speech: ${POS.map((p) => `${p} ${stats[p]}`).join(' · ')}\n`
);
