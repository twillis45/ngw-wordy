'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  /** Current balance, so a price the player cannot pay is not offered. */
  tokens: number;
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
  /**
   * Clue text per row, for the press-and-hold peek. Optional: a board with no
   * clues simply has no peek, rather than a control that opens an empty card.
   */
  clueFor?: (word: string) => string | undefined;
};

/**
 * Press-and-hold to peek at a row's clue.
 *
 * This is an ACCELERATOR, never the only route. Long-press is invisible to
 * keyboard and unreliable under a screen reader — VoiceOver's own gestures own
 * the hold — so the clue stays reachable the way it already was, by cycling
 * the clue card. Anything that made the hold the sole path would be a WCAG
 * 2.5.1 failure dressed up as a shortcut.
 *
 * 420ms: comfortably past iOS's ~350ms threshold for its own text-selection
 * hold, so the two do not race on a row the player is merely tapping.
 */
const PEEK_MS = 420;
/**
 * Movement that cancels the hold. A thumb resting on glass jitters a few
 * pixels; a scroll does not, and the grid sits inside a scrollable board.
 * Cancelling on real movement is what stops a peek from firing mid-scroll.
 */
const PEEK_SLOP = 10;

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
  tokens,
  onRevealLetter,
  onRevealWord,
  hasDefinition,
  onShowDefinition,
  compact,
  activeWord,
  clueFor,
}: Props) {
  /*
   * The row whose clue is being peeked at. Held in state rather than shown by
   * CSS so that dismissing it is a real event — a peek that lingered after the
   * finger lifted read as the app having navigated somewhere.
   */
  const [peek, setPeek] = useState<string | null>(null);
  const holdRef = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null);
  /*
   * Survives pointerup, which holdRef deliberately does not.
   *
   * The suppression guard originally read holdRef at click time and never
   * fired, because pointerup nulls holdRef and the click arrives after it —
   * so a hold showed the peek AND opened the priced hint menu behind it.
   * Caught by driving a real hold in the browser, not by reading the code:
   * the logic looks right until you notice the event order.
   */
  const swallowClickRef = useRef(false);

  const cancelHold = useCallback(() => {
    if (holdRef.current) window.clearTimeout(holdRef.current.timer);
    holdRef.current = null;
  }, []);

  useEffect(() => cancelHold, [cancelHold]);

  /*
   * Release dismisses the peek, listened for on the WINDOW rather than on the
   * row.
   *
   * Per-element onPointerUp did not dismiss it — measured in the browser, the
   * card stayed up after release. Rather than chase the event ordering, this
   * is the more correct design regardless: a finger held on a small chip
   * routinely drifts off it before lifting, and a row-scoped listener simply
   * never hears that pointerup. The window always does, so the peek cannot get
   * stuck on screen with nothing touching it.
   */
  useEffect(() => {
    if (!peek) return;
    const drop = () => {
      setPeek(null);
      /*
       * Clear the suppression flag here, not only in onClickCapture.
       *
       * A hold sets it so the release click cannot also open the priced hint
       * menu. But if the finger drifts off the row and lifts elsewhere, that
       * click never arrives — the flag stayed set and swallowed the player's
       * NEXT tap on any row. Measured: hold row 2, release off-target, then
       * tap row 3, and the hint menu did not open. Release always happens, so
       * release is where this belongs.
       *
       * DEFERRED, because pointerup fires BEFORE click. Clearing it inline
       * would unswallow the very click this exists to swallow, restoring the
       * peek-plus-hint-menu bug. The delay only has to outlast the browser's
       * own pointerup->click gap; onClickCapture still clears it immediately
       * in the common case, so this is purely the drifted-finger backstop.
       */
      window.setTimeout(() => {
        swallowClickRef.current = false;
      }, 300);
    };
    window.addEventListener('pointerup', drop);
    window.addEventListener('pointercancel', drop);
    return () => {
      window.removeEventListener('pointerup', drop);
      window.removeEventListener('pointercancel', drop);
    };
  }, [peek]);

  /*
   * Handlers for one row. Returns {} when there is no clue to show, so a board
   * without clues attaches no listeners at all rather than arming a timer that
   * can only ever resolve to nothing.
   */
  /*
   * The peek card. Rendered once at the tray root rather than per row, because
   * six absolutely-positioned cards inside a grid that already scrolls is six
   * chances to clip one at the container edge.
   *
   * aria-live rather than a dialog: nothing here takes focus, there is nothing
   * to dismiss with Escape, and the finger lifting is the dismissal. Announcing
   * it politely means a screen-reader user who does reach it by some route
   * hears the clue instead of nothing.
   */
  const peekCard =
    peek && clueFor?.(peek) ? (
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none absolute inset-x-0 top-0 z-20 mx-auto max-w-[22rem] rounded-xl border border-edge px-3 py-2 text-center text-meta leading-snug text-text-primary liquid liquid-raised backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)]"
      >
        <span className="block text-kicker font-semibold uppercase tracking-wide text-text-muted">
          {peek.length} letters
        </span>
        {clueFor(peek)}
      </div>
    ) : null;

  const holdProps = useCallback(
    (word: string) => {
      if (!clueFor?.(word)) return {};
      return {
        onPointerDown: (e: React.PointerEvent) => {
          // Mouse users have hover and a click; the hold is for touch and pen.
          if (e.pointerType === 'mouse') return;
          cancelHold();
          holdRef.current = {
            x: e.clientX,
            y: e.clientY,
            fired: false,
            timer: window.setTimeout(() => {
              if (holdRef.current) holdRef.current.fired = true;
              swallowClickRef.current = true;
              setPeek(word);
            }, PEEK_MS),
          };
        },
        onPointerMove: (e: React.PointerEvent) => {
          const h = holdRef.current;
          if (!h || h.fired) return;
          if (Math.hypot(e.clientX - h.x, e.clientY - h.y) > PEEK_SLOP) cancelHold();
        },
        // Dismissal is handled by a WINDOW listener, not here — see below.
        onPointerUp: cancelHold,
        onPointerCancel: cancelHold,
        onPointerLeave: cancelHold,
        /*
         * A hold that fired must not ALSO open the hint menu on release.
         * Without this the peek and the priced hint chooser both appear, and
         * the player is looking at a menu they did not ask for over a clue
         * they did.
         */
        onClickCapture: (e: React.MouseEvent) => {
          if (swallowClickRef.current) {
            swallowClickRef.current = false;
            e.preventDefault();
            e.stopPropagation();
          }
        },
        // Stops iOS raising its own selection/callout bubble over the peek.
        onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
      };
    },
    [clueFor, cancelHold]
  );
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

  /*
   * The row that opened the menu, so closing can put focus back on it.
   *
   * Choosing a hint unmounts the menu item that was focused, and focus then
   * falls to `document.body` — measured. From there Tab restarts at the top of
   * the document, so a keyboard player who bought a letter was thrown back to
   * the page header and had to walk the whole board again to buy a second one.
   */
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const closeMenu = useCallback(() => {
    setMenuFor(null);
    openerRef.current?.focus();
  }, []);

  /*
   * Escape closes the menu, and a press anywhere else dismisses it.
   *
   * `role="menu"` sets an expectation the markup was not meeting: there was no
   * Escape and no outside dismissal at all, so once open the only ways out
   * were to buy something or to press the row again — and Escape, the key
   * every keyboard and screen-reader user reaches for first, did nothing.
   * Capture phase so the game's window-level key handler cannot see it.
   */
  useEffect(() => {
    if (menuFor === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
    };
    const onPointer = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest('[data-hint-menu],[data-hint-opener]')) return;
      setMenuFor(null);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer, true);
    };
  }, [menuFor, closeMenu]);

  if (compact) {
    return (
      /*
       * Clue mode is the default now, so THIS row — not the full grid — is what
       * a player sees above the wheel on every board. It was sized when it was
       * a secondary view: px-2 py-1 at meta size came out around 26px a chip,
       * and six of them plus the clue card were taking the top third of a phone
       * before the dial got any say. Tightened to the WCAG 2.5.8 floor of 24px,
       * with the width kept generous so the target stays comfortable.
       *
       * Note these are NOT sized by --slot-h. That token drives the full grid
       * only, which is why shrinking it did nothing visible here.
       */
      <div className="relative flex flex-wrap items-center justify-center gap-1">
        {peekCard}
        {grid.map((word, rowIndex) => {
          const bought = reveal.words.includes(word);
          const solved = found.has(word);
          const done = solved || bought;
          const definable = done && hasDefinition(word);
          const actionable = canHint && !done;
          return (
            <div key={word} className="relative flex items-center">
            <button
              type="button"
              data-hint-opener
              {...holdProps(word)}
              ref={(el) => {
                if (menuFor === word) openerRef.current = el;
              }}
              disabled={!definable && !actionable}
              onClick={() =>
                definable
                  ? onShowDefinition(word)
                  : actionable
                    ? setMenuFor((cur) => (cur === word ? null : word))
                    : undefined
              }
              aria-expanded={actionable ? menuFor === word : undefined}
              aria-haspopup={actionable ? 'menu' : undefined}
              /*
               * Clue mode is the DEFAULT, so this chip — not the full grid —
               * is the row control on almost every board. It was
               * `disabled={!definable}`, i.e. inert until solved, which meant
               * the whole hint economy was unreachable in the default mode by
               * every input including a pointer, while the line under the
               * wheel still read "Tap a row to choose a hint · 3 left". The
               * chip now opens the same priced menu the full grid does.
               */
              /*
               * The row's POSITION leads, because without it these labels are
               * not unique. Measured in the CDP accessibility tree — the same
               * tree VoiceOver reads — three separate chips announced as
               * "3-letter word, not found. Open hint options." A player working
               * by voice heard the identical sentence three times and had no
               * way to tell which row they were on, or which one they had just
               * bought a hint for. Length alone stops distinguishing the moment
               * a board has two rows the same size, which most boards do.
               */
              aria-label={
                done
                  ? `Row ${rowIndex + 1} of ${grid.length}, ${word}, done`
                  : actionable
                    ? `Row ${rowIndex + 1} of ${grid.length}, ${word.length}-letter word, not found. Open hint options.`
                    : `Row ${rowIndex + 1} of ${grid.length}, ${word.length}-letter word, not found`
              }
              className={[
                // min-h/min-w hold the WCAG 2.5.8 floor. Measured 23.3x23.1 at
                // 390px — the padding alone had never actually reached 24, so
                // the comment below described an intent, not the rendered box.
                'relative grid min-h-6 min-w-6 place-items-center rounded-md border-2 px-1.5 py-0.5 text-kicker font-semibold tabular-nums leading-snug transition-colors',
                // Same achievement ladder as the full grid — see below.
                solved
                  ? 'border-success bg-success/20 liquid liquid-raised backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] text-text-primary'
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
                word === base ? 'text-meta font-bold px-2' : '',

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
            {actionable && menuFor === word && (
              <HintMenu
                word={word}
                tokens={tokens}
                onLetter={() => {
                  closeMenu();
                  onRevealLetter(word);
                }}
                onWord={() => {
                  closeMenu();
                  onRevealWord(word);
                }}
              />
            )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center gap-1 cramped:gap-0.5 roomy:gap-2">
      {peekCard}
      {grid.map((word, rowIndex) => {
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
              data-hint-opener
              {...holdProps(word)}
              ref={(el) => {
                if (menuFor === word) openerRef.current = el;
              }}
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
              // Don't promise options that cannot be opened: with no hints
              // left the row is disabled, and saying "open hint options"
              // is the control lying about what it does.
              aria-label={
                definable
                  ? `Row ${rowIndex + 1} of ${grid.length}, ${word}. Open the definition.`
                  : done
                    ? `Row ${rowIndex + 1} of ${grid.length}, ${word.length}-letter word, done`
                    : actionable
                      ? `Row ${rowIndex + 1} of ${grid.length}, ${word.length}-letter word, not found. Open hint options.`
                      : `Row ${rowIndex + 1} of ${grid.length}, ${word.length}-letter word, not found. No hints left.`
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
                        ? 'border-success bg-success/20 liquid liquid-raised backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] text-text-primary'
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

            {actionable && menuFor === word && (
              <HintMenu
                word={word}
                tokens={tokens}
                onLetter={() => {
                  closeMenu();
                  onRevealLetter(word);
                }}
                onWord={() => {
                  closeMenu();
                  onRevealWord(word);
                }}
              />
            )}

            {floatFor?.word === word && (
              <span
                aria-hidden
                className="anim-float pointer-events-none absolute -top-1 left-1/2 text-body font-bold text-success-ink"
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

/**
 * Hint menu — real buttons, with the PRICE on the label. Both actions were
 * previously pointer-only and silent about cost.
 *
 * Shared by the full grid and the compact clue-mode chips, because they had
 * drifted: only the grid had it, and the grid is the mode nobody is in by
 * default.
 */
function HintMenu({
  word,
  tokens,
  onLetter,
  onWord,
}: {
  word: string;
  tokens: number;
  onLetter: () => void;
  onWord: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  /*
   * Move focus into the menu when it opens.
   *
   * `aria-haspopup="menu"` promises a menu opens; leaving focus on the row
   * meant a screen-reader user was told a menu appeared and then given no way
   * to reach it except a Tab into unannounced space. Focusing the first item
   * is the documented behaviour for a menu button, unlike a dialog.
   */
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
  }, []);

  return (
    <div
      ref={ref}
      role="menu"
      data-hint-menu
      aria-label={`Hints for the ${word.length}-letter word`}
      /*
       * Reads as a chooser, not a decoration. It replaced a tap that used to
       * reveal a letter outright, so if it is easy to miss the player
       * concludes the tap did nothing — which is exactly what was reported.
       * Full-strength edge and a contact shadow so it separates from the grid
       * behind it.
       */
      className="absolute left-1/2 top-full z-20 mt-1.5 flex -translate-x-1/2 gap-1 rounded-xl border-2 border-edge liquid liquid-raised shadow-[0_8px_20px_-8px_rgba(0,0,0,0.75)] backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] p-1"
    >
      {/*
        Affordability is checked HERE, not just in the engine. spendWord
        already refuses when the balance is short — but the menu was offering
        "Whole word · 3" to a player holding 2, and clicking it did nothing at
        all. A control that is offered, costs nothing to press, and silently
        declines is worse than one that is plainly out of reach.
      */}
      <HintOption
        label="A letter"
        cost={LETTER_COST}
        balance={tokens}
        onChoose={onLetter}
      />
      <HintOption
        label="Whole word"
        cost={WORD_COST}
        balance={tokens}
        muted
        onChoose={onWord}
      />
    </div>
  );
}

/**
 * One priced option in the hint menu.
 *
 * Disabled rather than hidden when unaffordable: the price is information the
 * player needs in order to understand the economy, and hiding it just makes
 * the menu change shape for reasons they cannot see.
 */
function HintOption({
  label,
  cost,
  balance,
  muted,
  onChoose,
}: {
  label: string;
  cost: number;
  balance: number;
  muted?: boolean;
  onChoose: () => void;
}) {
  const affordable = balance >= cost;
  return (
    <button
      type="button"
      role="menuitem"
      disabled={!affordable}
      onClick={onChoose}
      aria-label={
        affordable
          ? `${label}, costs ${cost} hint${cost === 1 ? '' : 's'}`
          : `${label} needs ${cost} hints, you have ${balance}`
      }
      className={[
        'whitespace-nowrap rounded-lg px-2.5 py-1.5 touch:min-h-11 text-meta',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-steel-muted',
        affordable
          ? `${muted ? 'text-text-secondary' : 'text-text-primary'} hover:bg-steel-dark/40`
          : 'cursor-not-allowed text-text-muted opacity-50',
      ].join(' ')}
    >
      {label} · {cost}
    </button>
  );
}
