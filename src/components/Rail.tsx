'use client';

import { RANK_BASIS, rankLadder, type Rank } from '@/lib/game';
import type { DayCell } from '@/lib/storage';
import { CheckIcon } from './Icon';

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
  /** Every word banked, bonus included. What "Your words" is worth. */
  score: number;
  /**
   * The six rows only — the basis `rank` and RANK_BASIS both use.
   *
   * The ladder took `score`/`puzzle.maxScore` while the rank beside it was
   * computed from the grid, so this one card gave two answers to one question:
   * the header read "2 to go" and the row under it read "+10". It also
   * disagreed with the RankBar at the top of the board, which had already been
   * migrated to the grid basis. RANK_BASIS is printed directly above this list
   * and says ranks track the six rows; now the numbers do too.
   */
  gridScore: number;
  gridMax: number;
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
  gridScore,
  gridMax,
  days,
  streak,
  bestStreak,
  /*
   * Width was never the whole question. This card is the LAST thing in the
   * rail, so on a wide-but-short window — 1900x980 is an ordinary maximised
   * Chrome on a laptop — adding it was what pushed the Streak off the bottom,
   * while a narrower 1440x900 fitted fine. It needs room in both directions.
   */
  howToClassName = 'hidden 2xl:[@media(min-height:1000px)]:block',
  hasDefinition,
  onShowDefinition,
}: Props) {
  const solvedTargets = gridWords.filter((w) => found.has(w));

  return (
    <div className="flex flex-col gap-3 short:gap-2.5">
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

      {/*
        The header carries WHERE YOU ARE, then how far the next rung is.

        "2 to Clever" on its own does not survive being checked against the
        ladder under it: the rows read Sharp 5, Clever 8, so the arithmetic on
        screen says three. Both numbers were right — the distance is measured
        from the score, which was 6, and the score was the one quantity the card
        never showed. Naming it closes the sum in the reader's favour: 5 is
        behind you, 8 is the next rung, you are at 6, so it is 2.
      */}
      <Card
        title="Rank"
        meta={
          rank.next
            ? `${gridScore} pts · ${rank.pointsToNext} to ${rank.next}`
            : `${gridScore} pts · maxed`
        }
      >
        {/* Without this the names imply cleverness while the numbers measure
            exhaustiveness, and nothing on screen reconciles them. */}
        {/* Dropped on a short viewport. This same sentence is now the last line
            of the first-run explainer, so on a screen with no room to spare it
            is the one thing here a player has already been told — unlike the
            ladder and the streak, which exist nowhere else on desktop. */}
        <p className="mb-2.5 hidden text-meta leading-snug text-text-muted short:hidden [@media(min-height:801px)]:block">
          {RANK_BASIS}
        </p>
        <ol className="flex flex-col gap-0.5 short:gap-0">
          {rankLadder(gridScore, gridMax).map((step) => (
            <li
              key={step.name}
              aria-current={step.current ? 'step' : undefined}
              className={[
                'flex items-center gap-2.5 rounded-lg px-2 py-1 text-body short:py-0.5 short:text-meta',
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
              {/*
                ONE quantity down the column: what each rank costs.

                This alternated between `${step.at} pts` for reached ranks and
                `+${step.toGo}` for the rest — a threshold and a distance, in
                one column, distinguished only by a plus sign. Reading down it
                meant switching units halfway, and the reached half collided
                with the score shown two cards up ("Sharp 15 pts" beside "Your
                words 15 pts" are not the same fifteen).

                A ladder of costs also holds still while you play; only the
                highlight moves. How far the next rung is has its own place --
                the card header, and the bar at the top of the board.
              */}
              <span className="text-meta tabular-nums text-text-muted">
                {step.at} pts
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
            <div key={d.key} className="flex flex-col items-center gap-1.5 short:gap-1">
              <span
                aria-hidden
                className={[
                  'grid h-6 w-6 place-items-center rounded-md border-2 lg:h-7 lg:w-7',
                  d.played
                    ? 'border-steel bg-steel-dark/40 text-text-primary'
                    // Unplayed cells hold no glyph, so no text color here —
                    // carbon-strong is a border token and must never set text.
                    : 'border-edge/60 liquid relative',
                  // Today reads as today whether or not it's been played.
                  i === days.length - 1 ? 'ring-1 ring-steel-muted/40' : '',
                ].join(' ')}
              >
                {d.played ? <CheckIcon /> : null}
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
  /*
   * Panel radius, not card radius. These three sit directly on the page beside
   * the board panel, which makes them its peers — they measured 16px against
   * its 24px, which read as drift rather than hierarchy.
   */
  return (
    <section className="relative rounded-3xl border border-edge liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] p-4 lg:p-3.5 short:p-3">
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
      ? 'liquid-raised bg-success/15 text-success-ink'
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
