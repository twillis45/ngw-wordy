'use client';

import type { Rank } from '@/lib/game';

/**
 * Rank ladder over raw score — "Clever, 12 to Fluent" tells you where you
 * are; "47 points" doesn't. The bar is steel, never an accent color; green
 * is reserved for the moment a word lands.
 */
export default function RankBar({ rank, score }: { rank: Rank; score: number }) {
  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[17px] font-semibold text-text-primary">
          {rank.name}
        </span>
        <span className="text-[13px] tabular-nums text-text-muted">
          {rank.next ? `${rank.pointsToNext} to ${rank.next}` : `${score} pts`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(rank.progress * 100)}
        aria-label={`Rank progress: ${rank.name}`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-carbon-surface-2"
      >
        <div
          className="h-full rounded-full bg-steel-muted transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(2, rank.progress * 100)}%` }}
        />
      </div>
    </div>
  );
}
