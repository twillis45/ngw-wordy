'use client';

import { RANK_BASIS, rankLadder, type Rank } from '@/lib/game';
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
  maxScore: number;
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
  hasDefinition: (word: string) => boolean;
  onShowDefinition: (word: string) => void;
};

export default function Rail({
  gridWords,
  base,
  found,
  bonusFound,
  rank,
  score,
  maxScore,
  days,
  streak,
  bestStreak,
  howToClassName = 'hidden 2xl:block',
  hasDefinition,
  onShowDefinition,
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
            <Chip
              key={w}
              word={w}
              tone={w === base ? 'base' : 'target'}
              definable={hasDefinition(w)}
              onOpen={onShowDefinition}
            />
          ))}
        </Group>

        <Group
          label={`Bonus · ${bonusFound.length}`}
          empty="Extra words you find show up here"
        >
          {[...bonusFound]
            .sort((a, b) => b.length - a.length || a.localeCompare(b))
            .map((w) => (
              <Chip
                key={w}
                word={w}
                tone="bonus"
                definable={hasDefinition(w)}
                onOpen={onShowDefinition}
              />
            ))}
        </Group>
      </Card>

      <Card title="Rank" meta={rank.next ? `${rank.pointsToNext} to go` : 'Maxed'}>
        {/* Without this the names imply cleverness while the numbers measure
            exhaustiveness, and nothing on screen reconciles them. */}
        <p className="mb-2.5 text-meta leading-snug text-text-muted">
          {RANK_BASIS}
        </p>
        <ol className="flex flex-col gap-0.5">
          {rankLadder(score, maxScore).map((step) => (
            <li
              key={step.name}
              aria-current={step.current ? 'step' : undefined}
              className={[
                'flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-body',
                step.current ? 'liquid liquid-raised relative font-semibold' : '',
                step.reached ? 'text-text-primary' : 'text-text-muted',
              ].join(' ')}
            >
              <span
                aria-hidden
                className={[
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  step.current
                    ? 'bg-edge'
                    : step.reached
                      ? 'bg-steel-muted'
                      : 'bg-edge',
                ].join(' ')}
              />
              <span className="flex-1">{step.name}</span>
              {/* What it cost, or what it still costs — a percentage is
                  unusable mid-game, a point count is something to aim at. */}
              <span className="text-meta tabular-nums text-text-muted">
                {step.reached ? `${step.at} pts` : `+${step.toGo}`}
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <Card
        title="Streak"
        meta={bestStreak > 1 ? `best ${bestStreak}` : undefined}
      >
        <div className="flex items-end justify-between gap-1">
          {days.map((d, i) => (
            <div key={d.key} className="flex flex-col items-center gap-1.5">
              <span
                aria-hidden
                className={[
                  'grid h-6 w-6 place-items-center rounded-md border-2 text-kicker lg:h-7 lg:w-7',
                  d.played
                    ? 'border-steel bg-steel-dark/40 text-text-primary'
                    // Unplayed cells hold no glyph, so no text color here —
                    // carbon-strong is a border token and must never set text.
                    : 'border-edge/60 liquid relative',
                  // Today reads as today whether or not it's been played.
                  i === days.length - 1 ? 'ring-1 ring-steel-muted/40' : '',
                ].join(' ')}
              >
                {d.played ? '✓' : ''}
              </span>
              <span className="text-kicker text-text-muted">{d.label}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-meta text-text-muted">
          {streak > 1
            ? `${streak} days in a row.`
            : 'Play tomorrow to start a streak.'}
        </p>
      </Card>

      <div className={howToClassName}>
        <Card title="How to play">
          <ul className="flex flex-col gap-2 text-body leading-relaxed text-text-secondary">
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
    <section className="relative rounded-2xl border border-edge liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-item font-semibold text-text-primary">
          {title}
        </h2>
        {meta && (
          <span className="text-meta tabular-nums text-text-muted">
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
      <p className="mb-1.5 text-meta text-text-muted">{label}</p>
      {has ? (
        <div className="flex flex-wrap gap-1.5">{children}</div>
      ) : (
        <p className="text-meta text-text-muted">{empty}</p>
      )}
    </div>
  );
}

function Chip({
  word,
  tone,
  definable,
  onOpen,
}: {
  word: string;
  tone: 'base' | 'target' | 'bonus';
  definable: boolean;
  onOpen: (word: string) => void;
}) {
  const cls = [
    'relative rounded-md px-2 py-1 text-meta font-medium uppercase tracking-[0.06em] liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)]',
    tone === 'base'
      ? 'liquid-raised bg-success/15 text-success'
      : tone === 'target'
        ? 'liquid-raised text-text-primary'
        : 'text-text-secondary',
  ].join(' ');

  // A word with no entry stays a plain span, so nothing invites a dead tap.
  if (!definable) return <span className={cls}>{word}</span>;

  return (
    <button
      type="button"
      onClick={() => onOpen(word)}
      aria-label={`${word}. Show definition.`}
      className={`${cls} underline decoration-steel-muted decoration-dotted underline-offset-2 transition-colors hover:decoration-steel-muted`}
    >
      {word}
    </button>
  );
}
