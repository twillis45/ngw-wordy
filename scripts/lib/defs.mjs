/**
 * Shared definition machinery.
 *
 * Extracted because the pipeline is now two-pass: puzzle generation needs to
 * know which words are definable (so clue mode can promise a clue for every
 * row), and the shipped definition file is a filtered subset of the same map.
 * One implementation, used by both.
 */

const MAX_LEN = 165;

/**
 * Webster entries are long, multi-sense, and full of editorial apparatus.
 * Keep the first sense, trimmed to something readable on a phone.
 */
export function condense(raw) {
  let text = String(raw)
    .replace(/\s+/g, ' ')
    .replace(/\bDefn:\s*/gi, '')
    .replace(/^\s*\d+\.\s*/, '')
    .replace(/\bEtym:\s*\[[^\]]*\]\s*/gi, '')
    .replace(/\[[^\]]*\]/g, '')
    .trim();

  const stop = text.search(/\.\s+[A-Z(]/);
  if (stop > 40 && stop < MAX_LEN) text = text.slice(0, stop + 1);

  if (text.length > MAX_LEN) {
    const cut = text.lastIndexOf(' ', MAX_LEN);
    text = `${text.slice(0, cut > 60 ? cut : MAX_LEN).trim()}…`;
  }

  text = text.charAt(0).toUpperCase() + text.slice(1);
  if (!/[.…]$/.test(text)) text += '.';
  return text;
}

/**
 * Candidate base forms for an inflected word, best guess first.
 *
 * Webster lists lemmas, not inflections — it has "acorn" but not "acorns",
 * "ace" but not "aced"/"acing". Without this, coverage sat at 59% and nearly
 * every miss was a plural or participle.
 */
export function lemmaCandidates(w) {
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

  const doubled = /(.*?)([bdfglmnprt])\2(ed|ing|er|est|y)$/.exec(w);
  if (doubled) add(doubled[1] + doubled[2]);

  return out;
}

/** Lowercase index of the bulk source. */
export function indexSource(source) {
  const byWord = new Map();
  for (const [key, value] of Object.entries(source)) {
    const w = key.toLowerCase();
    if (!byWord.has(w) && value) byWord.set(w, value);
  }
  return byWord;
}

/**
 * Resolve one word to [definition, lemma?] or null.
 * `lemma` is present only when a base form supplied the definition.
 */
export function defineWord(byWord, word) {
  const direct = byWord.get(word);
  if (direct) return [condense(direct)];

  for (const lemma of lemmaCandidates(word)) {
    const raw = byWord.get(lemma);
    if (raw) return [condense(raw), lemma];
  }
  return null;
}

/**
 * A clue is not a definition.
 *
 * A definition can afford to be thorough; a clue has to fit on a phone above
 * the wheel and be graspable in one read. Take the first sense only, drop
 * Webster's source attributions and quoted examples, and cap it short.
 */
export function clueText(definition) {
  let t = definition;

  // Quoted illustrative examples: "To set upon the vague villains." Hayward.
  t = t.replace(/"[^"]*"/g, ' ');
  // Sense numbering that survives once the first sentence is cut.
  t = t.replace(/\b\d+\.\s*/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();

  // First sentence only.
  const end = t.search(/\.(\s|$)/);
  if (end > 14) t = t.slice(0, end + 1);

  /*
   * Trailing source attributions — "Carew.", "C. Kingsley.", "Chaucer." —
   * are citations, not meaning, and they read as part of the clue.
   */
  t = t.replace(/(\s+(?:[A-Z][a-z]{2,}|[A-Z]\.)\s*){1,3}\.?\s*$/, '');

  t = t.replace(/\s+([;,.])/g, '$1').replace(/\s+/g, ' ').trim();
  if (t.length > 120) {
    const cut = t.lastIndexOf(' ', 120);
    t = `${t.slice(0, cut > 60 ? cut : 120).trim()}…`;
  }
  if (!/[.…?]$/.test(t)) t += '.';
  return t;
}

/**
 * A clue must not contain its own answer.
 *
 * Webster definitions routinely restate the headword ("Linker: one who
 * links..."), and the lemma is often a visible prefix of the answer. Redact
 * both, plus any word sharing a 4+ character stem with the answer, or clue
 * mode gives the puzzle away.
 */
export function redactAnswer(text, answer, lemma) {
  const stems = new Set([answer]);
  if (lemma) stems.add(lemma);
  // A shared prefix catches link/links/linked/linking from "linker".
  const stem = answer.slice(0, Math.max(4, answer.length - 2));
  if (stem.length >= 4) stems.add(stem);

  let out = text;
  for (const s of stems) {
    if (s.length < 3) continue;
    /*
     * No \b on the left: the giveaway is usually the answer buried INSIDE a
     * longer word — "unwieldy" for wieldy, "abide" for bide, "atheism" for
     * theism, "methinks" for thinks. A word-boundary match walked straight
     * past all of those. Redact the whole containing word.
     */
    out = out.replace(new RegExp(`\\w*${s}\\w*`, 'gi'), '———');
  }
  return out.replace(/(———[\s,;.]*){2,}/g, '——— ').trim();
}

/**
 * Is this definition usable as a clue?
 *
 * Rejects clues that are mostly redaction or too short to mean anything —
 * a clue that says "——— of ———" is worse than no clue mode at all.
 */
export function isUsableClue(clue) {
  /*
   * 24, not 30. The old floor was calibrated against Webster's 1913, whose
   * definitions ramble — anything short there was a stub. WordNet glosses are
   * deliberately terse (median 45 chars, a quarter of them under 30), so a 30
   * floor throws away good short clues like "Money in the form of bills or
   * coins." The stub filters below are what actually catch stubs.
   */
  if (!clue || clue.length < 24) return false;

  /*
   * A gloss that was cut off mid-sentence is not a clue, it is a sentence that
   * stops. `condense` truncates long entries with an ellipsis, which was fine
   * when the alternative was a paragraph of Webster; with WordNet the gloss is
   * short by design, so anything still hitting the cap is genuinely too long
   * and should be dropped rather than amputated.
   */
  if (/…/.test(clue)) return false;

  /*
   * WordNet marks usage examples with a backtick-quote pair. Those survive
   * redaction as stray punctuation and read as a typo.
   */
  if (/[`]/.test(clue)) return false;

  /*
   * ONE redaction, not two. A clue with the answer blanked twice is either
   * circular ("A ——— that measures a ——— interval") or a grammar note dressed
   * as a definition — in both cases unanswerable.
   */
  const redactions = (clue.match(/———/g) ?? []).length;
  if (redactions > 1) return false;

  /*
   * Cross-reference stubs are not definitions. Webster is full of entries like
   * "Imp. of Speak.", "The yaws. See Yaws." and "pl. of Foot" — technically a
   * dictionary entry, useless as a clue, and they'd make the mode feel broken.
   */
  const stub =
    /^\s*(imp\.|p\.\s*p\.|pl\.|sing\.|obs\.|see\b|same as\b|a form of\b|variant of\b|of\s+———)/i;
  if (stub.test(clue)) return false;

  /*
   * Grammatical apparatus anywhere in the clue, not just at the start:
   * "The 3d pers. sing. pres. of Do." is a conjugation note, not a meaning,
   * and it slipped past a start-anchored check.
   */
  if (/\b(pers\.|sing\.|plur\.|pres\.|imp\.|p\.\s*p\.|3d|2d)\s/i.test(clue)) {
    return false;
  }
  /*
   * Cross-references, at ANY length. The 60-char guard let long entries
   * through, so `longe` shipped as "A thrust. See Lunge. Smollett. ...Same as
   * 4th." — technically a definition, useless as a clue, and it tells the
   * player to go and look somewhere that doesn't exist in this game.
   */
  if (/\bsee\s+[A-Z]/.test(clue)) return false;
  if (/\bsee\b/i.test(clue) && clue.length < 60) return false;

  /*
   * Register filter. Webster's 1913 is full of taxonomy, anatomy and
   * pathology, and those clues are unanswerable rather than hard: `ureas`,
   * `uveas`, `varus` and `druse` all shipped as scoring rows. A puzzle clue
   * has to be something a person could plausibly arrive at.
   */
  /*
   * Written for Webster, retuned for WordNet.
   *
   * The old list matched Webster's field abbreviations — `bot.`, `min.`,
   * `her.`, `mus.` — which WordNet never uses, and which are catastrophic
   * against ordinary prose: `her.` rejected the authored clue "...before she
   * will let you hug her." Only the spelled-out taxonomic and clinical
   * vocabulary is kept, because that is what actually makes a gloss
   * unanswerable in a word game.
   */
  if (
    /\b(genus|subgenus|phylum|taxonomic|zoology|botany|anatomy|pathology|mineralogy|crystalline aggregate)\b/i.test(
      clue
    )
  ) {
    return false;
  }

  const words = clue.replace(/———/g, '').split(/\s+/).filter((w) => w.length > 2);
  return words.length >= 5;
}

/**
 * A clue that duplicates another clue in the same puzzle is worse than no
 * clue: two rows asking the identical question can't both be answered from it.
 * Happens constantly because inflected pairs share a lemma — vague/vaguer,
 * poke/pokes, spoke/spoked.
 */
export function clueKey(clue) {
  return clue.replace(/———/g, '').replace(/\W+/g, ' ').trim().slice(0, 60).toLowerCase();
}
