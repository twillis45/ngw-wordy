/**
 * Progress store. v2 has no accounts — progress and streak live in this
 * browser. The shape is versioned so a later server sync has something stable
 * to migrate.
 *
 * This is a `useSyncExternalStore` source rather than component state on
 * purpose: the page is statically prerendered, so localStorage can only be
 * read on the client, and the game needs to read the *current* found-words set
 * synchronously while handling an input event. A store gives both without a
 * load effect or a second mirrored copy to keep in sync.
 *
 * v1 -> v2: v1 keyed found words by DAY, which was only correct while there
 * was exactly one puzzle per day. Now that you can move through puzzles, words
 * are keyed by PUZZLE and days record only that you played (which is all the
 * streak ever needed).
 */
import { dayKey } from './game';
import { EMPTY_REVEAL, type RevealState } from './hints';

const KEY = 'ngw-wordy/v2';
const LEGACY_KEY = 'ngw-wordy/v1';

export type Progress = {
  /** puzzleId -> words found in that puzzle. */
  words: Record<string, string[]>;
  /** puzzleId -> letters/words revealed by spending hints. */
  reveals: Record<string, RevealState>;
  /** dayKey -> true when the DAILY puzzle was played that day. */
  days: Record<string, true>;
  /** puzzleIds whose grid has been cleared. */
  clearedIds: string[];
  streak: number;
  bestStreak: number;
  lastPlayed: string | null;
  /** Hint ledger counters — the balance is derived, never stored. */
  bonusTotal: number;
  spent: number;
  muted: boolean;
  /** Ways to play, opt-in and remembered. */
  clueMode: boolean;
  escalating: boolean;
  /** First-run explainer has been seen and dismissed. */
  seenIntro: boolean;
  /** How many warm-up puzzles have been cleared. */
  warmupsDone: number;
};

/** Stable identity — required as the server snapshot. */
export const EMPTY: Progress = Object.freeze({
  words: {},
  reveals: {},
  days: {},
  clearedIds: [],
  streak: 0,
  bestStreak: 0,
  lastPlayed: null,
  bonusTotal: 0,
  spent: 0,
  muted: false,
  clueMode: false,
  escalating: false,
  seenIntro: false,
  warmupsDone: 0,
});

let snapshot: Progress = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

type LegacyProgress = {
  days?: Record<string, string[]>;
  streak?: number;
  bestStreak?: number;
  lastPlayed?: string | null;
  muted?: boolean;
};

/**
 * Carry a v1 payload forward. The streak is the part worth preserving; v1's
 * day-keyed word lists can't be attributed to a puzzle without recomputing the
 * index for each date, which needs the puzzle count — so the caller supplies
 * it. A day we can't attribute still counts as played.
 */
export function migrateV1(
  legacy: LegacyProgress,
  indexForDay: (key: string) => string | null
): Progress {
  const words: Record<string, string[]> = {};
  const days: Record<string, true> = {};

  for (const [key, list] of Object.entries(legacy.days ?? {})) {
    days[key] = true;
    const id = indexForDay(key);
    if (id && list?.length) words[id] = [...list];
  }

  return {
    ...EMPTY,
    words,
    days,
    streak: legacy.streak ?? 0,
    bestStreak: legacy.bestStreak ?? 0,
    lastPlayed: legacy.lastPlayed ?? null,
    muted: legacy.muted ?? false,
  };
}

/** Set by the app before first read, so migration can attribute old days. */
let dayToPuzzleId: (key: string) => string | null = () => null;
export function configureMigration(fn: (key: string) => string | null) {
  dayToPuzzleId = fn;
}

function read(): Progress {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as Partial<Progress>) };

    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = migrateV1(
        JSON.parse(legacy) as LegacyProgress,
        dayToPuzzleId
      );
      write(migrated);
      return migrated;
    }
    return EMPTY;
  } catch {
    return EMPTY;
  }
}

function write(p: Progress) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode / quota — progress is best-effort, never blocking */
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Client snapshot. Hydrates on first call then returns a referentially stable
 * object until something updates it — useSyncExternalStore loops forever if
 * this returns a new object each call.
 */
export function getSnapshot(): Progress {
  if (!hydrated && typeof window !== 'undefined') {
    hydrated = true;
    snapshot = read();
  }
  return snapshot;
}

export function getServerSnapshot(): Progress {
  return EMPTY;
}

export function update(fn: (prev: Progress) => Progress): Progress {
  const next = fn(getSnapshot());
  if (next === snapshot) return snapshot;
  snapshot = next;
  if (typeof window !== 'undefined') write(next);
  listeners.forEach((l) => l());
  return next;
}

/* ── Readers ──────────────────────────────────────────────────────────── */

export function wordsFor(p: Progress, puzzleId: string): string[] {
  return p.words[puzzleId] ?? [];
}

export function revealFor(p: Progress, puzzleId: string): RevealState {
  return p.reveals[puzzleId] ?? EMPTY_REVEAL;
}

export function isCleared(p: Progress, puzzleId: string): boolean {
  return p.clearedIds.includes(puzzleId);
}

/* ── Writers ──────────────────────────────────────────────────────────── */

/** Bank a word. `isBonus` feeds the hint ledger. */
export function addWord(
  puzzleId: string,
  word: string,
  isBonus: boolean
): Progress {
  return update((p) => {
    const existing = p.words[puzzleId] ?? [];
    if (existing.includes(word)) return p;
    return {
      ...p,
      words: { ...p.words, [puzzleId]: [...existing, word] },
      bonusTotal: isBonus ? p.bonusTotal + 1 : p.bonusTotal,
    };
  });
}

export function spendHint(
  puzzleId: string,
  reveal: RevealState,
  cost: number
): Progress {
  return update((p) => ({
    ...p,
    reveals: { ...p.reveals, [puzzleId]: reveal },
    spent: p.spent + cost,
  }));
}

/** Record a cleared grid. Idempotent — the token credit must not repeat. */
export function markCleared(puzzleId: string): Progress {
  return update((p) =>
    p.clearedIds.includes(puzzleId)
      ? p
      : { ...p, clearedIds: [...p.clearedIds, puzzleId] }
  );
}

export function setMutedPref(muted: boolean): Progress {
  return update((p) => (p.muted === muted ? p : { ...p, muted }));
}

export function advanceWarmup(): Progress {
  return update((p) => ({ ...p, warmupsDone: p.warmupsDone + 1 }));
}

export function markIntroSeen(): Progress {
  return update((p) => (p.seenIntro ? p : { ...p, seenIntro: true }));
}

export function setMode(
  key: 'clueMode' | 'escalating',
  on: boolean
): Progress {
  return update((p) => (p[key] === on ? p : { ...p, [key]: on }));
}

export type DayCell = { key: string; label: string; played: boolean };

/** The trailing 7 days ending today, oldest first — for the streak strip. */
export function last7(p: Progress, today: Date): DayCell[] {
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const out: DayCell[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    out.push({ key, label: labels[d.getDay()], played: p.days[key] === true });
  }
  return out;
}

/**
 * Advance the streak for `today`. Yesterday -> +1, same day -> unchanged,
 * any longer gap -> reset to 1. Returns a new object; never mutates.
 *
 * Only the DAILY puzzle may call this. Practice puzzles must never move the
 * streak, or the streak stops meaning "showed up today".
 */
export function touchStreak(p: Progress, today: Date): Progress {
  const key = dayKey(today);
  if (p.lastPlayed === key) return p;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const streak = p.lastPlayed === dayKey(yesterday) ? p.streak + 1 : 1;

  return {
    ...p,
    streak,
    bestStreak: Math.max(p.bestStreak, streak),
    lastPlayed: key,
    days: { ...p.days, [key]: true },
  };
}
