'use client';

import { RANKS, type Rank } from '@/lib/game';
import type { DayCell } from '@/lib/storage';

/**
 * The evidence rail.
 *
 * Everything here already existed in the engine but was invisible or reduced
 * to a bare count — you could see *that* you found 3 bonus words, never
 * *which*. On a wide screen the honest thing to put beside the board is the
 * player's own record, not a stretched board.
 *
 * It renders below the board on tablet and beside it on desktop; the grid
 * parent decides which, so there is one copy of this markup.
 */
type Props = {
  gridWords: string[];
  base: string;
  found: ReadonlySet<string>;
  bonusFound: string[];
  rank: Rank;
  score: number;
  days: DayCell[];
  streak: number;
  bestStreak: number;
  /**
   * Visibility of the how-to card is a CSS concern, not a JS one — driving it
   * off a measured breakpoint would mean a hydration-unsafe guess about the
   * viewport. Default shows it only on widescreen, where there's room to spare;
   * the mobile sheet passes '' to always show it.
   */
  howToClassName?: string;
};

export default function Rail({
  gridWords,
  base,
  found,
  bonusFound,
  rank,
  score,
  days,
  streak,
  bestStreak,
  howToClassName = 'hidden 2xl:block',
}: Props) {
  const solvedTargets = gridWords.filter((w) => found.has(w));

  return (
    <div className="flex flex-col gap-4">
      <Card title="Your words" meta={`${score} pts`}>
        <Group
          label={`Targets · ${solvedTargets.length}/${gridWords.length}`}
          empty="None yet"
        >
          {solvedTargets.map((w) => (
            <Chip key={w} word={w} tone={w === base ? 'base' : 'target'} />
          ))}
        </Group>

        <Group
          label={`Bonus · ${bonusFound.length}`}
          empty="Extra words you find show up here"
        >
          {[...bonusFound]
            .sort((a, b) => b.length - a.length || a.localeCompare(b))
            .map((w) => (
              <Chip key={w} word={w} tone="bonus" />
            ))}
        </Group>
      </Card>

      <Card title="Rank" meta={rank.next ? `${rank.pointsToNext} to go` : 'Maxed'}>
        <ol className="flex flex-col gap-1">
          {RANKS.map((r, i) => {
            const reached = i <= rank.index;
            const current = i === rank.index;
            return (
              <li
                key={r.name}
                aria-current={current ? 'step' : undefined}
                className={[
                  'flex items-center gap-2.5 rounded-lg px-2 py-1 text-[14px]',
                  current ? 'bg-carbon-surface-2 font-semibold' : '',
                  // Reached vs not is carried by the dot and the weight — not
                  // by dropping the label to an unreadable contrast.
                  reached ? 'text-text-primary' : 'text-text-muted',
                ].join(' ')}
              >
                <span
                  aria-hidden
                  className={[
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    current
                      ? 'bg-success'
                      : reached
                        ? 'bg-steel-muted'
                        : 'bg-carbon-strong',
                  ].join(' ')}
                />
                {r.name}
              </li>
            );
          })}
        </ol>
      </Card>

      <Card
        title="Streak"
        meta={bestStreak > 1 ? `best ${bestStreak}` : undefined}
      >
        <div className="flex items-end justify-between gap-1.5">
          {days.map((d, i) => (
            <div key={d.key} className="flex flex-col items-center gap-1.5">
              <span
                aria-hidden
                className={[
                  'grid h-7 w-7 place-items-center rounded-md border text-[11px]',
                  d.played
                    ? 'border-success/40 bg-success/15 text-success'
                    // Unplayed cells hold no glyph, so no text color here —
                    // carbon-strong is a border token and must never set text.
                    : 'border-carbon-border bg-carbon-body',
                  // Today reads as today whether or not it's been played.
                  i === days.length - 1 ? 'ring-1 ring-steel-muted/40' : '',
                ].join(' ')}
              >
                {d.played ? '✓' : ''}
              </span>
              <span className="text-[11px] text-text-muted">{d.label}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-text-muted">
          {streak > 1
            ? `${streak} days in a row.`
            : 'Play tomorrow to start a streak.'}
        </p>
      </Card>

      <div className={howToClassName}>
        <Card title="How to play">
          <ul className="flex flex-col gap-2 text-[14px] leading-relaxed text-text-secondary">
            <li>Drag across the wheel, or just type.</li>
            <li>Fill every row to clear the grid.</li>
            <li>
              Extra words still score — every 3 of them earns a hint.
            </li>
            <li>New letters daily.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Card({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-carbon-border bg-carbon-panel p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          {title}
        </h2>
        {meta && (
          <span className="text-[13px] tabular-nums text-text-muted">
            {meta}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function Group({
  label,
  empty,
  children,
}: {
  label: string;
  empty: string;
  children: React.ReactNode[];
}) {
  const has = children.length > 0;
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-1.5 text-[12px] text-text-muted">{label}</p>
      {has ? (
        <div className="flex flex-wrap gap-1.5">{children}</div>
      ) : (
        <p className="text-[13px] text-text-muted">{empty}</p>
      )}
    </div>
  );
}

function Chip({
  word,
  tone,
}: {
  word: string;
  tone: 'base' | 'target' | 'bonus';
}) {
  return (
    <span
      className={[
        'rounded-md px-2 py-1 text-[13px] font-medium uppercase tracking-[0.06em]',
        tone === 'base'
          ? 'bg-success/15 text-success'
          : tone === 'target'
            ? 'bg-carbon-surface-2 text-text-primary'
            : 'bg-carbon-surface-2 text-text-secondary',
      ].join(' ')}
    >
      {word}
    </span>
  );
}
