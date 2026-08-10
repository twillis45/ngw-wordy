'use client';

import { useState } from 'react';
import { revealedCount, type RevealState } from '@/lib/hints';

/**
 * The target grid — Word Cookies "tray" model: one row per target word,
 * blanks that fill in as they're solved. Grouped by length descending so
 * the longest word reads as the prize.
 *
 * Unsolved letters are rendered as empty slots, not as hidden text, so a
 * DOM inspector can't spoil the puzzle.
 *
 * Rows are also the hint control: tap for a letter, hold for the whole word.
 * Targeting the hint at a row beats guessing for the player — which word is
 * blocking them is information only they have.
 */
type Props = {
  grid: string[];
  found: ReadonlySet<string>;
  reveal: RevealState;
  base: string;
  /**
   * Words solved during THIS session. Only these animate — replaying the
   * landing for words restored from storage would make motion describe state
   * rather than change, and every reload would look like a fresh solve.
   */
  justSolved: ReadonlySet<string>;
  /** Points to float off the row that was just completed. */
  floatFor?: { word: string; points: number } | null;
  canHint: boolean;
  onRevealLetter: (word: string) => void;
  onRevealWord: (word: string) => void;
  /** Gated on presence — a word with no entry must not look tappable. */
  hasDefinition: (word: string) => boolean;
  onShowDefinition: (word: string) => void;
  /**
   * Clue mode: the clue is the question, so the tray stops being the primary
   * display and becomes a progress row. Also buys back the ~180px the clue
   * card costs, which is what let clue mode fit a phone at all.
   */
  compact?: boolean;
  /** The row the visible clue points at, so it can be marked. */
  activeWord?: string | null;
};

/**
 * Hint costs, mirrored from lib/hints so the price can be SHOWN before it is
 * charged. The old flow spent a token on pointer-up and announced the cost
 * afterwards — money gone, then the receipt.
 */
const LETTER_COST = 1;
const WORD_COST = 3;

export default function WordTray({
  grid,
  found,
  reveal,
  base,
  justSolved,
  floatFor,
  canHint,
  onRevealLetter,
  onRevealWord,
  hasDefinition,
  onShowDefinition,
  compact,
  activeWord,
}: Props) {
  /*
   * Which row is showing its hint menu.
   *
   * Replaces a 450ms press-and-hold that had no non-pointer equivalent at all
   * and was documented only in an aria-label — so a sighted touch player could
   * spend their entire 3-token opening balance by resting a thumb while
   * thinking, and a keyboard or screen-reader player could not spend anything,
   * because both reveals fired from pointer events that Enter never produces.
   */
  const [menuFor, setMenuFor] = useState<string | null>(null);

  if (compact) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {grid.map((word) => {
          const bought = reveal.words.includes(word);
          const solved = found.has(word);
          const done = solved || bought;
          const definable = done && hasDefinition(word);
          return (
            <button
              key={word}
              type="button"
              disabled={!definable}
              onClick={() => definable && onShowDefinition(word)}
              aria-label={
                done ? `${word}, done` : `${word.length}-letter word, not found`
              }
              className={[
                'relative rounded-md border-2 px-2 py-1 text-meta font-semibold tabular-nums transition-colors',
                // Same achievement ladder as the full grid — see below.
                solved
                  ? 'border-success liquid liquid-raised backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] text-text-primary'
                  : bought
                    ? 'border-edge-mid liquid liquid-raised backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] italic text-text-muted'
                    : 'border-edge-mid liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] text-text-muted',
                /*
                 * The prize word, marked by SIZE and WEIGHT, not colour.
                 *
                 * In the full grid the base row already wins on --slot-h-base,
                 * so removing its green ring cost nothing. Here it had no size
                 * advantage and the ring was its only marker — which was also
                 * colour-only, and success/edge measure 1.00:1 apart under
                 * protanopia. This says "prize" to everyone.
                 */
                word === base ? 'text-body font-bold px-3' : '',

                // Mark the row the clue is currently asking about.
                // Was text-secondary vs text-muted — 1.01:1 apart, i.e. no
                // marker at all. Now carries weight and a ring, not just hue.
                !done && word === activeWord
                  ? 'border-edge ring-2 ring-steel-muted font-bold text-text-primary'
                  : '',
                solved && justSolved.has(word) ? 'anim-land' : '',
              ].join(' ')}
            >
              {done ? word.toUpperCase() : word.length}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1 cramped:gap-0.5 roomy:gap-2">
      {grid.map((word) => {
        const bought = reveal.words.includes(word);
        const solved = found.has(word);
        const done = solved || bought;
        const shown = revealedCount(reveal, word);
        const isBase = word === base;
        const fresh = solved && justSolved.has(word);
        // Before it's done the row buys hints; after, it explains the word.
        const actionable = canHint && !done;
        const definable = done && hasDefinition(word);

        return (
          <div key={word} className="relative flex items-center">
            <button
              type="button"
              disabled={!actionable && !definable}
              // One handler, on CLICK — which keyboard Enter/Space and every
              // assistive technology produce, and pointer events do not.
              onClick={() =>
                definable
                  ? onShowDefinition(word)
                  : actionable
                    ? setMenuFor((cur) => (cur === word ? null : word))
                    : undefined
              }
              aria-expanded={actionable ? menuFor === word : undefined}
              aria-haspopup={actionable ? 'menu' : undefined}
              className={[
                'flex gap-1 rounded-lg p-1 cramped:gap-0.5 cramped:p-0.5 roomy:gap-1.5',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-steel-muted',
                actionable || definable
                  ? 'cursor-pointer transition-transform active:scale-[0.98]'
                  : 'cursor-default',
              ].join(' ')}
              aria-label={
                definable
                  ? `${word}. Open the definition.`
                  : done
                    ? `${word.length}-letter word, done`
                    : `${word.length}-letter word, not found. Open hint options.`
              }
            >
              {word.split('').map((ch, i) => {
                const visible = done || i < shown;
                return (
                  <span
                    key={i}
                    // Flight target. The reveal measures this rect to know
                    // where the letter should land.
                    data-slot={`${word}-${i}`}
                    aria-hidden={!visible}
                    className={[
                      'relative grid place-items-center rounded-md border-2 font-semibold tabular-nums',
                      // Illumination follows achievement. This was inverted:
                      // a solved tile went `border-transparent` while an empty
                      // slot kept the full-brightness edge, so the placeholders
                      // were the loudest thing in the grid and solving a word
                      // made it quieter. Green on the solved tile is also the
                      // one accent moment Studio Matte allows, which the grid
                      // had stopped spending anywhere.
                      solved
                        ? 'border-success liquid liquid-raised backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] text-text-primary'
                        : bought
                          // Filled, but not earned — structure without accent.
                          ? 'border-edge-mid liquid liquid-raised backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] italic text-text-muted'
                          : 'border-edge-mid liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] text-text-muted',
                      
                      fresh ? 'anim-land anim-sweep' : '',
                    ].join(' ')}
                    style={{
                      // The full-wheel word is the prize, so it gets real size
                      // over the others rather than only a ring. Both scale
                      // fluidly with the viewport — see --slot-h in globals.
                      height: isBase ? 'var(--slot-h-base)' : 'var(--slot-h)',
                      width: 'auto',
                      aspectRatio: '7 / 8',
                      fontSize: isBase
                        ? 'var(--slot-text-base)'
                        : 'var(--slot-text)',
                      // Stagger so the row fills left to right, in step with
                      // the letters arriving from the wheel.
                      animationDelay: fresh ? `${i * 45}ms` : undefined,
                    }}
                  >
                    {visible ? ch.toUpperCase() : ''}
                  </span>
                );
              })}
            </button>

            {/*
              Hint menu — real buttons, with the PRICE on the label. Both
              actions were previously pointer-only and silent about cost.
            */}
            {actionable && menuFor === word && (
              <div
                role="menu"
                aria-label={`Hints for the ${word.length}-letter word`}
                className="absolute left-1/2 top-full z-20 mt-1 flex -translate-x-1/2 gap-1 rounded-xl border-2 border-edge-mid liquid liquid-raised backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] p-1"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuFor(null);
                    onRevealLetter(word);
                  }}
                  className="whitespace-nowrap rounded-lg px-2.5 py-1.5 touch:min-h-11 text-meta text-text-primary hover:bg-steel-dark/40 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-steel-muted"
                >
                  A letter · {LETTER_COST}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuFor(null);
                    onRevealWord(word);
                  }}
                  className="whitespace-nowrap rounded-lg px-2.5 py-1.5 touch:min-h-11 text-meta text-text-secondary hover:bg-steel-dark/40 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-steel-muted"
                >
                  Whole word · {WORD_COST}
                </button>
              </div>
            )}

            {floatFor?.word === word && (
              <span
                aria-hidden
                className="anim-float pointer-events-none absolute -top-1 left-1/2 text-body font-bold text-success"
              >
                +{floatFor.points}
              </span>
            )}

            <span className="sr-only">
              {solved
                ? `Found: ${word}`
                : bought
                  ? `Revealed: ${word}`
                  : `${word.length}-letter word, not found`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
