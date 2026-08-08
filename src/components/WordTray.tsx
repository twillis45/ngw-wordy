'use client';

/**
 * The target grid — Word Cookies "tray" model: one row per target word,
 * blanks that fill in as they're solved. Grouped by length descending so
 * the longest word reads as the prize.
 *
 * Unsolved letters are rendered as empty slots, not as hidden text, so a
 * DOM inspector can't spoil the puzzle.
 */
type Props = {
  grid: string[];
  found: ReadonlySet<string>;
  revealed: ReadonlySet<string>;
  base: string;
  /**
   * Words solved during THIS session. Only these animate — replaying the
   * landing for words restored from storage would make motion describe state
   * rather than change, and every reload would look like a fresh solve.
   */
  justSolved: ReadonlySet<string>;
  /** Points to float off the row that was just completed. */
  floatFor?: { word: string; points: number } | null;
};

export default function WordTray({
  grid,
  found,
  revealed,
  base,
  justSolved,
  floatFor,
}: Props) {
  return (
    <div className="flex flex-col items-center gap-1.5 roomy:gap-2">
      {grid.map((word) => {
        const solved = found.has(word);
        const hinted = revealed.has(word);
        const isBase = word === base;
        const fresh = solved && justSolved.has(word);
        return (
          <div key={word} className="relative flex gap-1 roomy:gap-1.5" role="group">
            {word.split('').map((ch, i) => {
              const show = solved || (hinted && i === 0);
              return (
                <span
                  key={i}
                  // Flight target. The reveal measures this rect to know where
                  // the letter should land.
                  data-slot={`${word}-${i}`}
                  aria-hidden={!show}
                  className={[
                    'grid place-items-center rounded-md border font-semibold tabular-nums',
                    // The full-wheel word is the prize, so it gets real size
                    // over the others rather than only a ring.
                    // The size-up is gated on height as well as width:
                    // a landscape tablet is wide but short, and bumping
                    // there cost the controls their room.
                    isBase
                      ? 'h-[34px] w-[30px] text-[17px] roomy:h-[40px] roomy:w-[35px] roomy:text-[20px]'
                      : 'h-[30px] w-[26px] text-[15px] roomy:h-[35px] roomy:w-[31px] roomy:text-[17px]',
                    solved
                      ? 'border-transparent bg-carbon-surface-2 text-text-primary'
                      : 'border-carbon-border bg-carbon-panel text-text-muted',
                    solved && isBase ? 'ring-1 ring-success/50' : '',
                    fresh ? 'anim-land anim-sweep' : '',
                  ].join(' ')}
                  style={{
                    // Stagger so the row fills left to right, in step with
                    // the letters arriving from the wheel.
                    animationDelay: fresh ? `${i * 45}ms` : undefined,
                  }}
                >
                  {show ? ch.toUpperCase() : ''}
                </span>
              );
            })}

            {floatFor?.word === word && (
              <span
                aria-hidden
                className="anim-float pointer-events-none absolute -top-1 left-1/2 text-[15px] font-bold text-success"
              >
                +{floatFor.points}
              </span>
            )}

            <span className="sr-only">
              {solved ? `Found: ${word}` : `${word.length}-letter word, not found`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
