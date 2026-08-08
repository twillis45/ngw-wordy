#!/usr/bin/env node
/**
 * Definition extractor — offline, build time.
 *
 * Reads the bulk dictionary in data/webster.json and emits
 * public/data/definitions.json containing ONLY the words the puzzle set can
 * actually produce. That turns a 22MB source into a small asset, and keeps the
 * game working with no network: looking up a definition must not be the one
 * thing that needs a server.
 *
 * Source: Webster's Unabridged (public domain), via
 * github.com/matthewreagan/WebstersEnglishDictionary
 *
 * Usage: node scripts/build-definitions.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const SOURCE = path.join(ROOT, 'data', 'webster.json');
const PUZZLES = path.join(ROOT, 'public', 'data', 'puzzles.json');
const OUT = path.join(ROOT, 'public', 'data', 'definitions.json');

const MAX_LEN = 165;

/**
 * Webster entries are long, multi-sense, and full of editorial apparatus.
 * Keep the first sense, trimmed to something readable on a phone.
 */
function condense(raw) {
  let text = String(raw)
    .replace(/\s+/g, ' ')
    // Sense numbers and the source's own "Defn:" markers.
    .replace(/\bDefn:\s*/gi, '')
    .replace(/^\s*\d+\.\s*/, '')
    // Etymology and cross-reference blocks add length, never clarity here.
    .replace(/\bEtym:\s*\[[^\]]*\]\s*/gi, '')
    .replace(/\[[^\]]*\]/g, '')
    .trim();

  // Prefer a clean sentence boundary over a hard character cut.
  const stop = text.search(/\.\s+[A-Z(]/);
  if (stop > 40 && stop < MAX_LEN) text = text.slice(0, stop + 1);

  if (text.length > MAX_LEN) {
    const cut = text.lastIndexOf(' ', MAX_LEN);
    text = `${text.slice(0, cut > 60 ? cut : MAX_LEN).trim()}…`;
  }

  // Sentence-case the first letter without touching the rest (which may hold
  // proper nouns or abbreviations like "Zool.").
  text = text.charAt(0).toUpperCase() + text.slice(1);
  if (!/[.…]$/.test(text)) text += '.';
  return text;
}

/**
 * Candidate base forms for an inflected word, best guess first.
 *
 * Webster lists lemmas, not inflections — it has "acorn" but not "acorns",
 * "ace" but not "aced"/"acing". Without this, coverage sat at 59% and nearly
 * every miss was a plural or participle, which would have taught players to
 * stop tapping.
 */
function lemmaCandidates(w) {
  const out = [];
  const add = (x) => {
    if (x && x.length >= 2 && x !== w && !out.includes(x)) out.push(x);
  };

  if (w.endsWith('ies')) add(`${w.slice(0, -3)}y`);
  if (w.endsWith('es')) {
    add(w.slice(0, -2));
    add(w.slice(0, -1));
  }
  if (w.endsWith('s') && !w.endsWith('ss')) add(w.slice(0, -1));

  if (w.endsWith('ied')) add(`${w.slice(0, -3)}y`);
  if (w.endsWith('ed')) {
    add(w.slice(0, -2));
    add(w.slice(0, -1));
  }
  if (w.endsWith('ing')) {
    add(w.slice(0, -3));
    add(`${w.slice(0, -3)}e`);
  }
  if (w.endsWith('er') || w.endsWith('est')) {
    add(w.slice(0, w.endsWith('er') ? -2 : -3));
    add(w.slice(0, w.endsWith('er') ? -1 : -2));
  }
  if (w.endsWith('ily')) add(`${w.slice(0, -3)}y`);
  if (w.endsWith('ly')) add(w.slice(0, -2));

  // Doubled final consonant: running -> run, batted -> bat.
  const doubled = /(.*?)([bdfglmnprt])\2(ed|ing|er|est|y)$/.exec(w);
  if (doubled) add(doubled[1] + doubled[2]);

  return out;
}

const source = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
// The source is keyed with mixed case; index by lowercase for lookup.
const byWord = new Map();
for (const [key, value] of Object.entries(source)) {
  const w = key.toLowerCase();
  if (!byWord.has(w) && value) byWord.set(w, value);
}

const { puzzles } = JSON.parse(fs.readFileSync(PUZZLES, 'utf8'));

const needed = new Set();
for (const p of puzzles) {
  for (const w of p.grid) needed.add(w);
  for (const w of p.bonus) needed.add(w);
}

/**
 * Entries are [definition] for a direct hit, or [definition, lemma] when the
 * definition came from a base form — so the UI can say where it came from
 * rather than silently defining a different word.
 */
const out = {};
const missing = [];
let viaLemma = 0;

for (const word of [...needed].sort()) {
  const direct = byWord.get(word);
  if (direct) {
    out[word] = [condense(direct)];
    continue;
  }

  let found = false;
  for (const lemma of lemmaCandidates(word)) {
    const raw = byWord.get(lemma);
    if (!raw) continue;
    out[word] = [condense(raw), lemma];
    viaLemma += 1;
    found = true;
    break;
  }
  if (!found) missing.push(word);
}

fs.writeFileSync(OUT, JSON.stringify(out));

const bytes = fs.statSync(OUT).size;
const coverage = ((Object.keys(out).length / needed.size) * 100).toFixed(1);

console.log(
  `Wrote ${Object.keys(out).length} definitions -> ${OUT}\n` +
    `  ${(bytes / 1024).toFixed(0)} KB · ${coverage}% of ${needed.size} puzzle words` +
    ` (${viaLemma} via a base form)\n` +
    `  ${missing.length} missing (first 15): ${missing.slice(0, 15).join(', ')}`
);

/*
 * Coverage will never be 100%: the source is Webster's Unabridged, which
 * predates plenty of Scrabble-legal modern words (achy, ads, actin).
 *
 * That is fine, because the UI gates the affordance on presence — a word with
 * no entry simply isn't tappable, so the player never taps and gets nothing.
 * The number to watch is therefore a floor for usefulness, not correctness.
 */
if (Number(coverage) < 75) {
  console.warn(
    `\n  WARNING: coverage is ${coverage}%, below the 75% floor — definitions` +
      ` would feel absent rather than occasional. Consider a fuller source.`
  );
}
