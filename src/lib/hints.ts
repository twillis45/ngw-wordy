/**
 * The hint economy. Pure functions — no storage, no React.
 *
 * Hints are earned, never sold. Three sources so the balance actually moves:
 * a starting grant, bonus words, and clearing a puzzle. Two spends at
 * different prices, so a hint is a real decision rather than a single button.
 */

export const STARTING_TOKENS = 3;
export const BONUS_PER_TOKEN = 3;

export const COST_LETTER = 1;
export const COST_WORD = 3;

export type TokenLedger = {
  /** Every bonus word ever found, across all puzzles. */
  bonusTotal: number;
  /** Puzzles whose grid has been cleared. */
  cleared: number;
  /** Tokens spent. */
  spent: number;
};

/**
 * Balance is DERIVED from counters rather than stored as a number that gets
 * incremented. A stored balance can be double-credited by a reload or a
 * replayed event; a derivation cannot.
 */
export function tokenBalance(l: TokenLedger): number {
  const earned =
    STARTING_TOKENS + Math.floor(l.bonusTotal / BONUS_PER_TOKEN) + l.cleared;
  return Math.max(0, earned - l.spent);
}

/** Bonus words still needed for the next token. */
export function bonusToNextToken(bonusTotal: number): number {
  return BONUS_PER_TOKEN - (bonusTotal % BONUS_PER_TOKEN);
}

export type RevealState = {
  /** word -> how many leading letters are revealed. */
  letters: Record<string, number>;
  /** Words fully revealed by spending. They count as solved but score 0. */
  words: string[];
};

export const EMPTY_REVEAL: RevealState = { letters: {}, words: [] };

/** How many leading letters of `word` are currently shown. */
export function revealedCount(r: RevealState, word: string): number {
  if (r.words.includes(word)) return word.length;
  return r.letters[word] ?? 0;
}

/**
 * What a compact clue-mode row chip shows: revealed letters, then a dot for
 * each letter still hidden. `null` when nothing has been revealed, which is the
 * caller's cue to show the word's length instead.
 *
 * This lives here, as a pure function, because the bug it fixes was invisible
 * to every test in the suite. The clue-mode chip rendered `word.length` and
 * nothing else, so buying a letter — the cheaper of the two spends, in the
 * DEFAULT mode — took a token and changed nothing on screen. The full grid
 * rendered the reveal correctly, so the engine was never at fault and no
 * engine test could have caught it. There is no DOM test stack here, so the
 * derivation is pulled out of the component to somewhere it can be asserted.
 */
export function revealedChip(
  word: string,
  reveal: RevealState
): string | null {
  const shown = revealedCount(reveal, word);
  if (shown <= 0) return null;
  return `${word.slice(0, shown).toUpperCase()}${'·'.repeat(Math.max(0, word.length - shown))}`;
}

export type HintOutcome =
  | { ok: true; reveal: RevealState; cost: number }
  | { ok: false; reason: 'no-tokens' | 'already-solved' | 'nothing-left' };

/**
 * Reveal one more leading letter of a specific word.
 *
 * Targeted rather than automatic: the player picks the row, because which word
 * they're stuck on is information only they have.
 */
export function revealLetter(
  reveal: RevealState,
  word: string,
  opts: { solved: boolean; balance: number }
): HintOutcome {
  if (opts.solved) return { ok: false, reason: 'already-solved' };
  if (opts.balance < COST_LETTER) return { ok: false, reason: 'no-tokens' };

  const shown = revealedCount(reveal, word);
  // Revealing the final letter would hand over the word for a letter's price.
  if (shown >= word.length - 1) return { ok: false, reason: 'nothing-left' };

  return {
    ok: true,
    cost: COST_LETTER,
    reveal: { ...reveal, letters: { ...reveal.letters, [word]: shown + 1 } },
  };
}

/** Give up on a word: fills the row, counts toward the grid, scores nothing. */
export function revealWord(
  reveal: RevealState,
  word: string,
  opts: { solved: boolean; balance: number }
): HintOutcome {
  if (opts.solved) return { ok: false, reason: 'already-solved' };
  if (opts.balance < COST_WORD) return { ok: false, reason: 'no-tokens' };
  if (reveal.words.includes(word)) return { ok: false, reason: 'already-solved' };

  return {
    ok: true,
    cost: COST_WORD,
    reveal: { ...reveal, words: [...reveal.words, word] },
  };
}
