/**
 * Progress store. v1 has no accounts — progress and streak live in this
 * browser. The shape is versioned so a later Supabase sync has something
 * stable to migrate.
 *
 * This is a `useSyncExternalStore` source rather than component state on
 * purpose: the page is statically prerendered, so localStorage can only be
 * read on the client, and the game needs to read the *current* found-words
 * set synchronously while handling an input event. A store gives both
 * without a load effect or a second mirrored copy to keep in sync.
 */
import { dayKey } from './game';

const KEY = 'ngw-wordy/v1';

export type Progress = {
  /** dayKey -> words found that day */
  days: Record<string, string[]>;
  streak: number;
  bestStreak: number;
  lastPlayed: string | null;
  muted: boolean;
};

/** Stable identity — required as the server snapshot. */
export const EMPTY: Progress = Object.freeze({
  days: {},
  streak: 0,
  bestStreak: 0,
  lastPlayed: null,
  muted: false,
});

let snapshot: Progress = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function read(): Progress {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<Progress>) };
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
 * Client snapshot. Hydrates from localStorage on first call and then returns
 * a cached, referentially stable object until something updates it —
 * useSyncExternalStore loops forever if this returns a new object each call.
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

/** Words banked for a given day. */
export function wordsFor(p: Progress, key: string): string[] {
  return p.days[key] ?? [];
}

/** Bank a word for `key`. No-op if it's already there. */
export function addWord(key: string, word: string): Progress {
  return update((p) => {
    const existing = p.days[key] ?? [];
    if (existing.includes(word)) return p;
    return { ...p, days: { ...p.days, [key]: [...existing, word] } };
  });
}

export function setMutedPref(muted: boolean): Progress {
  return update((p) => (p.muted === muted ? p : { ...p, muted }));
}

/**
 * Advance the streak for `today`. Yesterday -> +1, same day -> unchanged,
 * any longer gap -> reset to 1. Returns a new object; never mutates.
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
  };
}
