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
    <div className="flex flex-col items-center gap-1.5">
      {grid.map((word) => {
        const solved = found.has(word);
        const hinted = revealed.has(word);
        return (
          <div key={word} className="flex gap-1" role="group">
            {word.split('').map((ch, i) => {
              const show = solved || (hinted && i === 0);
              return (
                <span
                  key={i}
                  aria-hidden={!show}
                  className={[
                    'grid place-items-center rounded-md border text-[15px] font-semibold tabular-nums',
                    solved
                      ? 'border-transparent bg-carbon-surface-2 text-text-primary'
                      : 'border-carbon-border bg-carbon-panel text-text-muted',
                    solved && word === base ? 'ring-1 ring-success/50' : '',
                    solved ? 'anim-pop' : '',
                  ].join(' ')}
                  style={{
                    width: 26,
                    height: 30,
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
