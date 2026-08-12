'use client';

import { RANKS, type Rank } from '@/lib/game';

/**
 * Rank, score and the whole ladder in one line.
 *
 * Portrait phone has no room for a stats panel and the rail is off-screen
 * there, so this strip is the only place progress can live. Previously it
 * showed a name, a "N to next" hint and a 1.5px hairline — and never showed the
 * score at all, so on mobile there was no way to track how you were doing.
 *
 * The ladder is drawn as ticks ON the track at each rank's threshold, the way
 * Spelling Bee does it: you can see where you are, what's next, and how far the
 * whole thing goes, without a second surface.
 */
/**
 * The number shown and the number that RANKS must be the same number.
 *
 * This took `score` — every word banked, bonus included — while `rank` was
 * computed from the six grid rows only. So the strip read "17 pts · 9 to
 * Fluent", and banking a bonus word moved the first number while the second
 * sat still. Two denominators wearing one label.
 *
 * gridMaxScore's own doctrine comment calls grading against an unstated
 * denominator "the shape of a manipulative one". It then fixed the
 * denominator and left the numerator wrong; this is that same bug, finished.
 *
 * The fix is not to pick one number but to NAME both, because both are real:
 * rows are what the board asks for and what rank measures, bonus words are
 * what pays for hints. Naming them separately is also the honest answer to
 * "what is this worth" — a player can now see which counter an action feeds.
 */
export default function RankBar({
  rank,
  gridScore,
  gridMax,
  bonusCount,
}: {
  rank: Rank;
  /** Points from the six grid rows. This is what rank is computed from. */
  gridScore: number;
  gridMax: number;
  /** Bonus words banked — the hint currency, deliberately not rank fuel. */
  bonusCount: number;
}) {
  return (
    <div className="w-full">
      <div className="mb-2 flex items-baseline justify-between gap-3 short:mb-1">
        {/* Keyed on the name so React remounts it when the rank changes and
            the animation replays. Promotion is a moment; it shouldn't just
            silently swap text. */}
        <span
          key={rank.name}
          className="anim-rise text-item font-semibold text-text-primary short:text-body"
        >
          {rank.name}
        </span>
        <span className="text-meta tabular-nums text-text-muted">
          {/* "rows" is the label doing the work: it says what this number
              counts, and therefore what moves the rank beside it. */}
          <span className="font-semibold text-text-secondary">
            {gridScore}/{gridMax}
          </span>{' '}
          rows
          {/*
            "0 pts · 2 to Solid" was the first line a new player read, and every
            term in it is internal: Solid is a rank they have not been told
            about, and the distance to it is measured in points they have not
            been told how to earn. Until the first word lands there is nothing
            to track, so the slot says what the board is actually for instead.
          */}
          {gridScore === 0
            ? ' · fill the six rows'
            : rank.next
              ? ` · ${rank.pointsToNext} to ${rank.next}`
              : ' · maxed'}
          {/* Bonus trails, in a quieter weight, because it is a separate
              economy — it buys hints and never moves the rank. Hidden at zero
              rather than shown as "0 bonus", which would read as a failure on
              a board the player has only just opened. */}
          {bonusCount > 0 && (
            <span className="text-text-muted"> · {bonusCount} bonus</span>
          )}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(rank.progress * 100)}
        aria-label={`Rank progress: ${rank.name}, ${gridScore} of ${gridMax} row points${
          bonusCount > 0 ? `, ${bonusCount} bonus words` : ''
        }`}
        className="relative h-2.5 w-full rounded-full border border-edge/60 short:h-2 liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)]"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-steel-muted shadow-[inset_0_1px_0_var(--glass-rim-light-strong)] transition-[width] duration-700 ease-out"
          style={{ width: `${Math.max(2, rank.progress * 100)}%` }}
        />

        {/* One tick per rank, at its actual threshold — the ladder is the
            track, so there's nothing extra to render or scroll to. */}
        {RANKS.map((r, i) => {
          if (i === 0) return null;
          const reached = i <= rank.index;
          return (
            <span
              key={r.name}
              aria-hidden
              title={r.name}
              className={[
                'absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors',
                reached ? 'bg-carbon-body/70' : 'bg-edge',
              ].join(' ')}
              style={{ left: `${r.at * 100}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}
