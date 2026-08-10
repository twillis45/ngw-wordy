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
export default function RankBar({ rank, score }: { rank: Rank; score: number }) {
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
          <span className="font-semibold text-text-secondary">{score}</span> pts
          {rank.next ? ` · ${rank.pointsToNext} to ${rank.next}` : ' · maxed'}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(rank.progress * 100)}
        aria-label={`Rank progress: ${rank.name}, ${score} points`}
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
