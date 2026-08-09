'use client';

import { useRef } from 'react';
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

const HOLD_MS = 450;

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
  // A hold fires the expensive spend; the trailing tap must then be suppressed
  // so one gesture never buys twice.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didHold = useRef(false);

  const startHold = (word: string) => {
    didHold.current = false;
    holdTimer.current = setTimeout(() => {
      didHold.current = true;
      onRevealWord(word);
    }, HOLD_MS);
  };

  const endHold = (word: string) => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    if (didHold.current) return;
    onRevealLetter(word);
  };

  const cancelHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    didHold.current = true; // suppress the trailing tap
  };

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
                'relative rounded-md border-2 px-2 py-1 text-[13px] font-semibold tabular-nums transition-colors',
                // Same achievement ladder as the full grid — see below.
                solved
                  ? 'border-success liquid liquid-raised backdrop-blur-md backdrop-saturate-150 text-text-primary'
                  : bought
                    ? 'border-edge/70 liquid liquid-raised backdrop-blur-md backdrop-saturate-150 italic text-text-muted'
                    : 'border-edge/70 liquid backdrop-blur-md backdrop-saturate-150 text-text-muted',
                solved && word === base ? 'ring-1 ring-success/50' : '',
                // Mark the row the clue is currently asking about.
                !done && word === activeWord
                  ? 'border-steel-muted text-text-secondary'
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
              onClick={() => definable && onShowDefinition(word)}
              onPointerDown={() => actionable && startHold(word)}
              onPointerUp={() => actionable && endHold(word)}
              onPointerLeave={cancelHold}
              onPointerCancel={cancelHold}
              // touch-none: a hold would otherwise raise the selection menu.
              className={[
                'flex touch-none gap-1 rounded-lg p-1 cramped:gap-0.5 cramped:p-0.5 roomy:gap-1.5',
                actionable || definable
                  ? 'cursor-pointer transition-transform active:scale-[0.98]'
                  : 'cursor-default',
              ].join(' ')}
              aria-label={
                definable
                  ? `${word}. Tap for the definition.`
                  : done
                    ? `${word.length}-letter word, done`
                    : `${word.length}-letter word. Tap to reveal a letter, hold to reveal the whole word.`
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
                        ? 'border-success liquid liquid-raised backdrop-blur-md backdrop-saturate-150 text-text-primary'
                        : bought
                          // Filled, but not earned — structure without accent.
                          ? 'border-edge/70 liquid liquid-raised backdrop-blur-md backdrop-saturate-150 italic text-text-muted'
                          : 'border-edge/70 liquid backdrop-blur-md backdrop-saturate-150 text-text-muted',
                      solved && isBase ? 'ring-1 ring-success/50' : '',
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

            {floatFor?.word === word && (
              <span
                aria-hidden
                className="anim-float pointer-events-none absolute -top-1 left-1/2 text-[15px] font-bold text-success"
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
