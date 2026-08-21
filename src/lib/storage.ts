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

/*
 * The `ngw-wordy` prefix is FROZEN and must not be renamed.
 *
 * The app became Six on the Dial (PR #20) and the repo became `sixonthedial`
 * (2026-08-19); every user-visible trace of the old name is gone, and these
 * are the deliberate exception. A localStorage key is a storage address, not
 * a label: renaming one does not migrate the data behind it, it orphans it.
 * Changing this line would silently reset every existing player's found
 * words, streak and rank, and the failure would be invisible in review — the
 * new key reads empty, which looks exactly like a new player.
 *
 * The same holds for the sibling keys (theme, accent, text, reading,
 * fullscreen, definitions cache) and, most sharply, for the PBKDF2 salt in
 * sync.ts: that one is an input to the derived account id, so renaming it
 * would point existing users at a different sync record entirely.
 *
 * If these ever do move, it takes a migration that reads the old key and
 * writes the new one, exactly as `LEGACY_KEY` does for the v1 -> v2 change
 * above — not a find-and-replace.
 */
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
  /**
   * Freezes held. One is spent automatically to cover a single missed day.
   *
   * Earned by playing, never bought — see `FREEZE_EVERY`. A freeze that can
   * be purchased turns a missed day into a sales opportunity, which is the
   * shape of mechanic the restraint seat on the 2026-08-21 board exists to
   * object to. This one only ever REDUCES pressure: it is the difference
   * between "you lost 40 days" and "that's covered", and it costs the player
   * nothing at the moment they need it.
   */
  freezes: number;
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
  freezes: 0,
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
    freezes: 0,
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

export type BoardRef = { id: string | number; base: string; letters: string[] };

/**
 * Re-key id-keyed progress onto base words. NOTHING IS EVER DELETED.
 *
 * Old keys are `<id>#<cycle>` where id is an array POSITION, so any change to
 * the catalogue slides saved progress onto whatever board inherited the
 * number. Two passes, both of which have to be confident before they move
 * anything:
 *
 *   1. The board that id points at now — accepted only if it can spell every
 *      word stored under the key.
 *   2. Failing that, the board the words THEMSELVES name: a saved list nearly
 *      always contains the base it was played on, so the content identifies
 *      the board even when the number no longer does. This is what recovers a
 *      save from before a catalogue edit.
 *
 * If neither is confident the key is left exactly as it is. An orphaned
 * `<id>#<cycle>` key is inert — nothing reads it, because live keys are base
 * words now — so the cost of keeping it is a few bytes, and the cost of the
 * alternative is somebody's game.
 *
 * That balance is not theoretical. An earlier draft deleted whatever it could
 * not resolve, and because the resolver is configured during render while
 * read() can run before it, one load resolved every id to null and emptied a
 * real save — every word, every reveal, every cleared board. Unknown is not
 * permission to delete.
 *
 * Entries already keyed by base pass through untouched, so this is idempotent
 * and safe to run on every read.
 */
export function migrateToBaseKeys(
  p: Progress,
  boardsFor: (id: string) => BoardRef | null,
  allBoards: () => BoardRef[] = () => []
): { next: Progress; moved: number; recovered: number } {
  const canSpell = (word: string, letters: string[]) => {
    const pool = [...letters];
    for (const ch of word) {
      const i = pool.indexOf(ch);
      if (i === -1) return false;
      pool.splice(i, 1);
    }
    return true;
  };

  const fits = (words: string[], b: BoardRef) =>
    words.every((w) => canSpell(w, b.letters));

  const remap = new Map<string, string>();
  let recovered = 0;

  for (const key of Object.keys(p.words)) {
    const [head, cycle] = key.split('#');
    // Already a base word: nothing numeric to slide.
    if (!/^\d+$/.test(head)) continue;
    const words = p.words[key] ?? [];
    const rename = (b: BoardRef) =>
      remap.set(key, cycle ? `${b.base}#${cycle}` : b.base);

    // 1. The board this number points at now, if it can spell the save.
    const byId = boardsFor(head);
    if (byId && fits(words, byId)) {
      rename(byId);
      continue;
    }

    /*
     * 2. Ask the WORDS which board they came from.
     *
     * A saved list nearly always contains the base it was played on, so the
     * content identifies the board even after the numbering moved under it.
     * Requiring the named base AND full spellability makes a false match
     * essentially impossible — the suite already asserts no two boards share
     * a letter-set.
     */
    const match = allBoards().find((b) => words.includes(b.base) && fits(words, b));
    if (match) {
      rename(match);
      recovered += 1;
      continue;
    }

    // 3. Not confident. Leave the key exactly as it is — it is inert, and
    //    guessing here is how progress gets destroyed.
  }

  if (remap.size === 0) return { next: p, moved: 0, recovered };

  const move = <T,>(src: Record<string, T>): Record<string, T> => {
    const out: Record<string, T> = {};
    for (const [k, v] of Object.entries(src)) out[remap.get(k) ?? k] = v;
    return out;
  };

  return {
    moved: remap.size,
    recovered,
    next: {
      ...p,
      words: move(p.words),
      reveals: move(p.reveals),
      clearedIds: p.clearedIds.map((k) => remap.get(k) ?? k),
    },
  };
}

/** Set by the app before first read, so ids can be resolved to boards. */
let idToBoard: (id: string) => BoardRef | null = () => null;
let everyBoard: () => BoardRef[] = () => [];
export function configureBaseKeyMigration(
  fn: (id: string) => BoardRef | null,
  all: () => BoardRef[]
) {
  idToBoard = fn;
  everyBoard = all;
}

function read(): Progress {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const stored = { ...EMPTY, ...(JSON.parse(raw) as Partial<Progress>) };
      /*
       * Runs on every read and is a no-op once converted — the check is
       * "does this key start with digits", and a base word never does. It has
       * to be here rather than behind a version bump because the damage is
       * silent: an id-keyed save looks perfectly valid, it is just pointing
       * at the wrong board.
       */
      const { next, moved } = migrateToBaseKeys(stored, idToBoard, everyBoard);
      if (moved) write(next);
      return next;
    }

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

/**
 * A subscribe function for `useSyncExternalStore` when the answer cannot
 * change after load — a browser capability, or the calendar day as far as one
 * page view is concerned. The hook still does the useful half: hydrate against
 * the server snapshot, then re-render with the client's answer.
 */
export function subscribeNever(): () => void {
  return () => {};
}

export type DayCell = {
  key: string;
  label: string;
  played: boolean;
  /**
   * The full date, written out — "Friday, August 15".
   *
   * Carried because the visible label CANNOT carry it. Seven cells at 24px
   * have room for one letter, and one letter is ambiguous by construction:
   * a week contains two days beginning S and two beginning T, so a row
   * reading `S S M T W T F` names four of its seven cells twice. Sighted
   * players resolve that from position and the ring on today; a screen
   * reader has neither.
   *
   * US format per house style, and no year — the row is a seven-day window,
   * so a year is noise in the one place there is no room for any.
   */
  date: string;
};

/**
 * The trailing 7 days ending today, oldest first — for the streak strip.
 *
 * `today` may be null, and that is the SERVER's answer. A static export is
 * prerendered on the build machine, so a `new Date()` in the component body
 * bakes the build's calendar day into the HTML — and any player whose local
 * date is a different day renders different weekday letters than the file they
 * are hydrating. That is a real mismatch, it fired on the live site, and React
 * responded by throwing away the whole prerendered tree. Measured: a build made
 * on a Friday in EDT hydrates cleanly in New York and Midway, and fails in UTC,
 * Tokyo and Kiritimati, where it is already Saturday.
 *
 * With null the strip renders seven blank, unplayed cells — which is exactly
 * what the server can honestly say, since progress is client-only too. The
 * letters arrive on the first client render. Nothing else on the board depends
 * on this, so the daily puzzle still prerenders as before.
 */
export function last7(p: Progress, today: Date | null): DayCell[] {
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const names = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const out: DayCell[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    if (!today) {
      out.push({ key: `pending-${i}`, label: '', played: false, date: '' });
      continue;
    }
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    out.push({
      key,
      label: labels[d.getDay()],
      played: p.days[key] === true,
      /*
       * Spelled out rather than formatted with `toLocaleDateString`, which
       * would follow the DEVICE locale and put a British reader's date in a
       * different order from the rest of the copy. House style is US format
       * everywhere, including the strings only a screen reader ever hears.
       */
      date: `${names[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`,
    });
  }
  return out;
}

/**
 * How often a freeze is earned, and how many can be held at once. */
export const FREEZE_EVERY = 7;
export const FREEZE_MAX = 3;

/*
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

  /*
   * A single missed day is COVERED by a freeze, if one is held.
   *
   * Two days missed is not, and deliberately: a freeze is a near-miss made
   * survivable, not an absence made irrelevant. Past one day the streak has
   * genuinely stopped meaning "showed up", which is the only thing it is for.
   *
   * Spent automatically, with no prompt. Asking would turn the one moment the
   * player already feels bad about into a decision they can get wrong, and it
   * is not a decision — nobody holding a freeze wants to lose the streak
   * instead. The card reports what happened after the fact.
   */
  const twoBack = new Date(today);
  twoBack.setDate(twoBack.getDate() - 2);

  const continued = p.lastPlayed === dayKey(yesterday);
  const missedOne = p.lastPlayed === dayKey(twoBack);
  const covered = !continued && missedOne && p.freezes > 0 && p.streak > 0;

  const streak = continued || covered ? p.streak + 1 : 1;
  const freezes = covered ? p.freezes - 1 : p.freezes;

  /*
   * Earned on the way up, so a long streak carries its own insurance. Capped,
   * because beyond a few a freeze stops covering a slip and starts covering
   * not playing.
   */
  const earned =
    streak > 0 && streak % FREEZE_EVERY === 0 && freezes < FREEZE_MAX
      ? freezes + 1
      : freezes;

  return {
    ...p,
    streak,
    bestStreak: Math.max(p.bestStreak, streak),
    freezes: earned,
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
    return { ok: false, reason: 'That does not look like a Six on the Dial backup code.' };
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
