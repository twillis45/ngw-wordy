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
  /**
   * Day the player last took a backup, or null if never.
   *
   * Deliberately NOT carried inside a backup code: it describes this device's
   * relationship to its backup, not the progress itself. Restoring onto a new
   * phone leaves it null, which is correct — that phone has never been backed
   * up, and the nudge should eventually say so.
   */
  lastBackup: string | null;
  /**
   * The backup card has been offered once, at the 7-day streak.
   *
   * The board set this moment precisely: not day one, because two seats delete
   * on early friction, but "the first time the player has something to lose."
   * Once, on a completion screen, never mid-board.
   */
  offeredBackup: boolean;
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
  /*
   * Sound OFF, haptics ON.
   *
   * The player board blocked sound-on-by-default outright, and the reason is
   * where this game gets opened: a commute, a waiting room, a bed with someone
   * asleep next to it. A puzzle that announces itself the first time you touch
   * a letter gets closed, and the player never learns there was a toggle in the
   * header.
   *
   * Haptics stay on because they are silent, they carry the same information,
   * and they are the channel that still works with the phone face-down in a
   * pocket. The two are separate settings for exactly this reason.
   */
  muted: true,
  /*
   * ON by default, for exactly the same reason `escalating` is.
   *
   * The catalogue is 371 themed boards carrying 2,224 hand-written clues, and
   * it is the only part of this product with pricing power. With clue mode off,
   * a player sees none of it: the board renders as rows of blank tiles, the
   * theme contributes a name and nothing else, and every authored line — the
   * price she set in 2019, the nine trustees, the census that lists a number
   * and an age and no name — sits behind a toggle in a settings sheet.
   *
   * A first-time player was therefore shown the game's weakest version by
   * default: six letters, twenty-seven blanks, and no statement of what the
   * blanks are. That is the "goal comprehension" failure the onboarding wing
   * scored a 2 for, and it is the same mistake `escalating` had — the
   * interesting version should be the one you turn OFF.
   */
  clueMode: true,
  /*
   * ON by default.
   *
   * This is the one structurally novel thing in the game — the search space
   * GROWS as you clear rows, so row six is a different problem from row one —
   * and it shipped switched off, buried in a sheet under the how-to, labelled
   * "Both are off by default." The default game was therefore one repeated
   * action with no decision in it beyond "shuffle or don't".
   *
   * Players should have to turn the interesting version OFF, not find it.
   */
  escalating: true,
  seenIntro: false,
  warmupsDone: 0,
  lastBackup: null,
  offeredBackup: false,
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

/*
 * Backing progress up, without a server.
 *
 * This is a static export with no accounts, so everything a player has —
 * streak, history, hint balance, every board they have cleared — lives in one
 * localStorage key that a cleared cache or a new phone erases silently. The
 * player board named this its single most common blocker: the three seats most
 * willing to pay all refused to commit to a streak they could lose without
 * warning, and none of them would trust a purchase to it either.
 *
 * A code is the smallest honest fix. It needs no backend, survives the
 * browser, and can be pasted into a notes app or another device. It is not an
 * account and does not pretend to be one.
 */
const BACKUP_PREFIX = 'wordy1:';

/**
 * Replace everything with a restored snapshot.
 *
 * Deliberately REPLACES rather than merges. Merging two histories raises
 * questions with no right answer — whose streak wins, do cleared boards union —
 * and a player restoring onto a fresh device expects to see what they had, not
 * a blend. The caller warns first.
 *
 * `lastBackup` is reset: this device has never been backed up, whatever the
 * device the code came from had done.
 */
export function applyProgress(restored: Progress): Progress {
  const next: Progress = { ...EMPTY, ...restored, lastBackup: null };
  // Go through the same path an update does — set the snapshot, persist, and
  // notify — so every useSyncExternalStore subscriber re-renders on the
  // restored data instead of the board it was showing a moment ago.
  snapshot = next;
  hydrated = true;
  if (typeof window !== 'undefined') write(next);
  listeners.forEach((l) => l());
  return next;
}

/** Record that the player has taken a backup today. */
export function markBackedUp(today: Date): Progress {
  const p = (n: number) => String(n).padStart(2, '0');
  const key = `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`;
  return update((prev) => ({ ...prev, lastBackup: key }));
}

/** The backup card has been shown; never offer it unprompted again. */
export function markBackupOffered(): Progress {
  return update((prev) => (prev.offeredBackup ? prev : { ...prev, offeredBackup: true }));
}

/**
 * Should the game offer a backup right now?
 *
 * Two moments, both named by the board, and nothing in between:
 *   - the session that first reaches a 7-day streak — "the first time the
 *     player has something to lose"
 *   - a backup older than 30 days while the streak has kept growing, which is
 *     how the stats seat survives a phone upgrade she did not plan
 *
 * There is deliberately NO standing "not backed up" badge. Four seats rejected
 * one outright — a permanent warning chip is exactly the anxiety the bedtime
 * and switch-off-my-brain seats came here to avoid — and Grandmother's veto
 * was withheld on condition it never ships.
 */
export function shouldOfferBackup(p: Progress, today: Date): boolean {
  if (p.streak < 7) return false;
  if (!p.lastBackup) return !p.offeredBackup;
  const last = Date.parse(p.lastBackup);
  if (Number.isNaN(last)) return false;
  return today.getTime() - last > 30 * 86_400_000;
}

/** Everything worth carrying to another device, as a pasteable code. */
export function exportProgress(): string {
  const snap = read();
  const json = JSON.stringify(snap);
  // base64 of UTF-8, so a clue or theme name with an apostrophe survives.
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return BACKUP_PREFIX + btoa(binary);
}

export type ImportResult =
  | { ok: true; progress: Progress }
  | { ok: false; reason: string };

/**
 * Restore from a code.
 *
 * Deliberately REPLACES rather than merges. Merging two histories raises
 * questions with no right answer — whose streak wins, do cleared boards union
 * — and a player restoring onto a fresh device expects to see what they had,
 * not a blend. The caller is responsible for warning first.
 */
export function importProgress(code: string): ImportResult {
  const trimmed = code.trim();
  if (!trimmed.startsWith(BACKUP_PREFIX)) {
    return { ok: false, reason: 'That does not look like a Wordy backup code.' };
  }
  try {
    const binary = atob(trimmed.slice(BACKUP_PREFIX.length));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<Progress>;
    if (typeof parsed !== 'object' || parsed === null || !('words' in parsed)) {
      return { ok: false, reason: 'That code is not a valid backup.' };
    }
    // Spread over EMPTY so a code from an older build gains new fields with
    // their defaults rather than leaving them undefined.
    const restored: Progress = { ...EMPTY, ...parsed };
    // Go through the same path an update does — set the snapshot, persist, and
    // notify — so every useSyncExternalStore subscriber re-renders on the
    // restored data instead of the board it was showing a moment ago.
    snapshot = restored;
    hydrated = true;
    if (typeof window !== 'undefined') write(restored);
    listeners.forEach((l) => l());
    return { ok: true, progress: restored };
  } catch {
    return { ok: false, reason: 'That code could not be read — check it copied in full.' };
  }
}
