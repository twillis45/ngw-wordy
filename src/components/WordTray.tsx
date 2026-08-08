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
};

export default function WordTray({ grid, found, revealed, base }: Props) {
  return (
    <div className="flex flex-col items-center gap-1.5 md:gap-2">
      {grid.map((word) => {
        const solved = found.has(word);
        const hinted = revealed.has(word);
        const isBase = word === base;
        return (
          <div key={word} className="flex gap-1 md:gap-1.5" role="group">
            {word.split('').map((ch, i) => {
              const show = solved || (hinted && i === 0);
              return (
                <span
                  key={i}
                  aria-hidden={!show}
                  className={[
                    'grid place-items-center rounded-md border font-semibold tabular-nums',
                    // The full-wheel word is the prize, so it gets real size
                    // over the others rather than only a ring.
                    isBase
                      ? 'h-[34px] w-[30px] text-[17px] md:h-[40px] md:w-[35px] md:text-[20px]'
                      : 'h-[30px] w-[26px] text-[15px] md:h-[35px] md:w-[31px] md:text-[17px]',
                    solved
                      ? 'border-transparent bg-carbon-surface-2 text-text-primary'
                      : 'border-carbon-border bg-carbon-panel text-text-muted',
                    solved && isBase ? 'ring-1 ring-success/50' : '',
                    solved ? 'anim-pop' : '',
                  ].join(' ')}
                  style={{
                    animationDelay: solved ? `${i * 32}ms` : undefined,
                  }}
                >
                  {show ? ch.toUpperCase() : ''}
                </span>
              );
            })}
            <span className="sr-only">
              {solved ? `Found: ${word}` : `${word.length}-letter word, not found`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
