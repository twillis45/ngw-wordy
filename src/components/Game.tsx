'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import LetterWheel from './LetterWheel';
import WordTray from './WordTray';
import RankBar from './RankBar';
import Rail from './Rail';
import { boardProgress, playerRecord } from '@/lib/record';
import { withBase } from '@/lib/basePath';
import {
  ChevronIcon,
  FullscreenIcon,
  HelpIcon,
  MoonIcon,
  SoundIcon,
  SunIcon,
} from './Icon';
import { feedback, setHapticsMuted, setMuted } from '@/lib/feedback';
import {
  backupLink,
  beatFromHash,
  chainFromHash,
  chainToHash,
  placeIn,
  codeFromHash,
  puzzleFromHash,
  themeFromHash,
  decodeProgress,
  encodeProgress,
} from '@/lib/backup';
import {
  TEXT_LABEL,
  applyReading,
  applyTextScale,
  getReading,
  getReadingServerSnapshot,
  getTextScale,
  getTextServerSnapshot,
  nextTextScale,
  subscribeA11y,
} from '@/lib/a11y';
import {
  ACCENT_LABELS,
  getAccentSnapshot,
  getAccentServerSnapshot,
  setAccent,
  subscribeAccent,
  type Accent,
} from '@/lib/accent';
import {
  deriveKeys,
  isSyncConfigured,
  passphraseProblem,
  pull as syncPull,
  push as syncPush,
} from '@/lib/sync';
import {
  applyTheme,
  effectiveTheme,
  systemScheme,
  systemSchemeServer,
  subscribeSystemScheme,
  getThemeServerSnapshot,
  getThemeSnapshot,
  nextTheme,
  subscribeTheme,
  type Theme,
} from '@/lib/theme';
import {
  fromBundled,
  loadDefinitions,
  lookup,
  resolveModern,
  type Definitions,
  type Resolved,
} from '@/lib/definitions';
import {
  celebrateBonus,
  celebratePrize,
  celebrateRank,
  flyLetters,
  measureFlight,
} from '@/lib/flight';
import { assistFor, isStalled } from '@/lib/assist';
import { dialogOpen, useDialog, useMounted } from '@/lib/dialog';
import {
  autoFullscreenOnFirstGesture,
  fullscreenSupported,
  subscribeSupport,
  supportedSnapshotServer,
  isFullscreen,
  rememberFullscreenExit,
  subscribeFullscreen,
  toggleFullscreen,
} from '@/lib/fullscreen';
import {
  activeLetters,
  fillClue,
  unlockedIndices,
  MIN_WORD_LENGTH,
  clueTarget,
  completionStats,
  isReachable,
  dailyIndex,
  dailyCycle,
  dailyPoolSize,
  puzzleKeyFor,
  puzzleForPlayer,
  themeShelves,
  type ShelfId,
  offsetForIndex,
  rankFor,
  scoreWord,
  shareParts,
  shareText,
  shuffle,
  submit,
  type Puzzle,
  type PuzzleFile,
  RANK_NAMES,
} from '@/lib/game';
import {
  applyProgress,
  markBackedUp,
  markBackupOffered,
  shouldOfferBackup,
  addWord,
  configureBaseKeyMigration,
  configureMigration,
  getServerSnapshot,
  getSnapshot,
  last7,
  subscribeNever,
  markCleared,
  advanceWarmup,
  markIntroSeen,
  revealFor,
  setMode,
  setMutedPref,
  spendHint,
  subscribe,
  touchStreak,
  update,
  wordsFor,
  startVacation,
  endVacation,
} from '@/lib/storage';
import {
  BONUS_PER_TOKEN,
  bonusToNextToken,
  COST_LETTER,
  COST_WORD,
  revealLetter,
  revealWord,
  tokenBalance,
} from '@/lib/hints';

type Toast = { text: string; tone: 'good' | 'bad' | 'neutral'; id: number };

/** "today" / "3 days ago" — plain, and never a countdown to a warning. */
function sinceBackup(key: string): string {
  const then = Date.parse(key);
  if (Number.isNaN(then)) return 'a while ago';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}


export default function Game({ data }: { data: PuzzleFile }) {
  const today = useMemo(() => new Date(), []);

  /*
   * The daily puzzle is the canonical one — it is what the streak and the
   * share card describe. `offset` lets a player keep going past it without
   * waiting for tomorrow; only offset 0 touches the streak.
   */
  const [offset, setOffset] = useState(0);
  /* A board arrived at from someone else's share card. Cleared the moment the
     player navigates anywhere themselves, so it never becomes sticky. */
  const [landedOn, setLandedOn] = useState<number | null>(null);
  /* A score from a challenge link. Held back until the receiver has submitted
     their own, because two seats quit against a visible target. */
  const [beatTarget, setBeatTarget] = useState<number | null>(null);
  /*
   * Every score already played on this board, oldest first — the ladder.
   *
   * Held rather than shown for the same reason `beatTarget` is: seeing what
   * to beat before you have played is being handed the answer to how hard to
   * try. It is revealed with the placement, after submission.
   */
  const [chain, setChain] = useState<number[] | null>(null);

  /*
   * Lets the id -> base re-key resolve which board a saved number meant.
   * Reads the CURRENT file, which is the honest best available answer: if the
   * words do not fit the board the id now points at, the migration drops the
   * entry rather than keeping a grid the wheel cannot spell.
   */
  configureBaseKeyMigration(
    (id) => {
      const p = data.puzzles.find((x) => String(x.id) === id);
      return p ? { id: p.id, base: p.base, letters: p.letters } : null;
    },
    () => data.puzzles.map((p) => ({ id: p.id, base: p.base, letters: p.letters }))
  );

  // Lets the v1 -> v2 migration re-key old day-based words onto puzzles.
  configureMigration((dk) => {
    const [y, m, d] = dk.split('-').map(Number);
    if (!y || !m || !d) return null;
    const i = dailyIndex(new Date(y, m - 1, d), data.puzzles.length);
    return String(data.puzzles[i]?.id ?? '');
  });

  // Single source of truth for anything that outlives the session.
  const progress = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  /*
   * A new player gets a short warm-up on the kindest puzzles before joining the
   * daily. Measuring the set showed the grid is only 51% common words on
   * average and the day-1 puzzle was 33% — four of six rows obscure. A first
   * game has to be winnable or there is no second one.
   */
  const clearedSet = useMemo(
    () => new Set(progress.clearedIds),
    [progress.clearedIds]
  );
  const chosen = puzzleForPlayer(
    data,
    progress.warmupsDone,
    today,
    offset,
    clearedSet
  );
  /*
   * A `#play=` link outranks the warm-up ladder.
   *
   * `puzzleForPlayer` treats offset 0 as "no opinion" and hands a new player a
   * warm-up — correct for a cold start, wrong for someone who arrived on a
   * link to a specific board. And the daily's own offset IS 0, so a card
   * shared today landed every new reader on the warm-up instead of the board
   * being discussed. Measured: shared Sunday Service, opened Family Reunion.
   *
   * An arrival is a stronger signal than a default, so it is held separately
   * rather than encoded as an offset that cannot say what it means.
   */
  const { index, warmup } =
    landedOn !== null ? { index: landedOn, warmup: null } : chosen;
  const puzzle: Puzzle = data.puzzles[index];
  /*
   * Found words are keyed by puzzle AND lap. Without the lap, finishing the
   * catalogue once means every future board arrives pre-solved.
   */
  /*
   * Laps of the DAILY POOL, not of the whole file. The daily rotates through
   * the authored catalogue; counting laps of all 520 boards would leave a
   * player who cleared the catalogue looking at their own solved boards until
   * the wider counter caught up.
   */
  const cycle = dailyCycle(today, dailyPoolSize(data));
  /*
   * Keyed on the BASE WORD, not puzzle.id — see puzzleKeyFor. The id is an
   * array position, and cutting two packs renumbered every board after them.
   */
  const puzzleId = puzzleKeyFor(puzzle, cycle);
  /*
   * A CHALLENGED board is never the daily, whatever offset it resolves to.
   *
   * `offset === 0` is today's board, and a challenge link to today's board
   * resolves to exactly that — so without this, accepting a challenge would
   * move the streak. The player board made this the one non-negotiable
   * condition on the whole feature, and the only point Grandmother's veto is
   * being held in reserve for: the shared daily IS the ritual, and spending it
   * to serve the two seats who would challenge anybody is not a trade.
   *
   * Challenge boards route through the same path as practice, which is what
   * they asked for in those words.
   */
  const isDaily = offset === 0 && warmup === null && beatTarget === null;

  /*
   * The wheel's letters are DERIVED from the puzzle being rendered, never
   * tracked alongside it.
   *
   * They used to be independent state, seeded once and re-set by hand inside
   * `goToPuzzle` using its own index formula:
   *
   *     data.puzzles[(todayIndex + nextOffset) % data.puzzles.length]
   *
   * The puzzle actually shown comes from `puzzleForPlayer`, which skips
   * cleared boards, can return a warm-up instead, and mods by the daily POOL
   * rather than the whole file. So two copies of the same arithmetic drifted
   * apart and the wheel ended up showing one board's letters next to another
   * board's clues: the theme read "In the Kitchen" while the dial held
   * shovel's letters, and because escalating mode tests unlocked letters
   * against the wheel, only the two that happened to appear in both were
   * live. Two letters, on a game with a three-letter minimum — an unplayable
   * board, reported by the person playing it.
   *
   * Keeping the shuffle in state keyed BY PUZZLE ID, and re-seeding during
   * render when the id changes, makes the desync unrepresentable: there is no
   * longer a second place that decides which letters belong to this board.
   * This is React's documented "adjust state when props change" pattern, not
   * an effect, so it costs no extra render pass.
   */
  const [shuffled, setShuffled] = useState<{ id: number; letters: string[] }>(
    () => ({ id: puzzle.id, letters: puzzle.letters })
  );
  if (shuffled.id !== puzzle.id) {
    setShuffled({ id: puzzle.id, letters: puzzle.letters });
  }
  const letters = shuffled.id === puzzle.id ? shuffled.letters : puzzle.letters;
  const setLetters = useCallback(
    (next: (prev: string[]) => string[]) => {
      setShuffled((prev) => ({ id: prev.id, letters: next(prev.letters) }));
    },
    []
  );
  const [selected, setSelected] = useState<number[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [shaking, setShaking] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showWords, setShowWords] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showPuzzles, setShowPuzzles] = useState(false);
  /**
   * Do It For Me — stall tracking.
   *
   * Misses are keyed to the puzzle they belong to rather than reset by an
   * effect, so switching puzzles clears them by derivation instead of a
   * setState cascade. The clock starts on the first tick of the watcher, not
   * during render — Date.now() in a render body is impure.
   */
  const [missState, setMissState] = useState({ id: '', n: 0 });
  const misses = missState.id === puzzleId ? missState.n : 0;
  const [offeredFor, setOfferedFor] = useState<string | null>(null);
  const [assistOpen, setAssistOpen] = useState(false);
  const lastActivity = useRef(0);
  const clockFor = useRef('');
  const [defs, setDefs] = useState<Definitions | null>(null);
  const [showDef, setShowDef] = useState<Resolved | null>(null);
  const [defUpgrading, setDefUpgrading] = useState(false);
  const [clueCursor, setClueCursor] = useState(0);
  // Fullscreen is browser state that Esc can change behind our back, so it's
  // an external store rather than something we try to remember.
  const fullscreen = useSyncExternalStore(
    subscribeFullscreen,
    isFullscreen,
    () => false
  );
  /*
   * Whether the browser CAN go fullscreen is also a question the server and
   * client answer differently, and it was being asked in the render body. See
   * subscribeSupport: that one line cost every load its prerender.
   */
  const canFullscreen = useSyncExternalStore(
    subscribeSupport,
    fullscreenSupported,
    supportedSnapshotServer
  );
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getThemeServerSnapshot
  );
  /*
   * What the OS is asking for, which only matters under 'auto'. Read through
   * the store because the server has no OS: it answers 'dark', the HTML says
   * moon, and a light-mode visitor who resolved this during render drew a sun
   * over it and lost the prerender. See systemScheme.
   */
  const scheme = useSyncExternalStore(
    subscribeSystemScheme,
    systemScheme,
    systemSchemeServer
  );
  /*
   * Display preferences live outside the progress store for the same reason
   * the theme does: the head script applies them before first paint, and a
   * text size applied late reflows the whole board rather than flashing it.
   */
  /*
   * Accent, read the same way theme and text size are: it lives in
   * localStorage and on <html>, both outside React, and another tab can change
   * it under a running one.
   */
  const accent = useSyncExternalStore(
    subscribeAccent,
    getAccentSnapshot,
    getAccentServerSnapshot
  );

  const textScale = useSyncExternalStore(
    subscribeA11y,
    getTextScale,
    getTextServerSnapshot
  );
  const reading = useSyncExternalStore(
    subscribeA11y,
    getReading,
    getReadingServerSnapshot
  );
  /** Words solved in THIS session — only these animate. */
  const [justSolved, setJustSolved] = useState<Set<string>>(new Set());
  const [floatFor, setFloatFor] = useState<{
    word: string;
    points: number;
  } | null>(null);
  const toastId = useRef(0);

  /**
   * The selection is ref-backed, with state kept only for rendering.
   *
   * React batches updates within a task, so a fast typist (or any input that
   * lands a letter and Enter in the same batch) would otherwise have `commit`
   * read a stale, empty word and drop it silently. The ref is written
   * synchronously, so commit always sees what the player actually entered.
   */
  const selRef = useRef<number[]>([]);

  const setSel = useCallback(
    (updater: number[] | ((prev: number[]) => number[])) => {
      const next =
        typeof updater === 'function' ? updater(selRef.current) : updater;
      selRef.current = next;
      setSelected(next);
    },
    []
  );

  const found = useMemo(
    () => new Set(wordsFor(progress, puzzleId)),
    [progress, puzzleId]
  );
  const reveal = revealFor(progress, puzzleId);
  const tokens = tokenBalance({
    bonusTotal: progress.bonusTotal,
    cleared: progress.clearedIds.length,
    spent: progress.spent,
  });

  /** A row is done when it was solved, or bought outright with a hint. */
  const rowDone = useCallback(
    (w: string) => found.has(w) || reveal.words.includes(w),
    [found, reveal]
  );

  const rowsDone = puzzle.grid.filter(rowDone).length;
  /*
   * The warm-up ladder runs WITHOUT the escalating wheel.
   *
   * Fun is learning, but not two things at once: a brand-new player is still
   * working out that you drag or tap to spell. Locked letters on board one is
   * a second unexplained rule on a screen that already has too many. They meet
   * the mechanic on graduating to the daily, with a line explaining it.
   */
  const escalating = progress.escalating && warmup === null;
  const active = activeLetters(puzzle, rowsDone, escalating);
  const hasLocked = active.length < puzzle.letters.length;
  /*
   * Resolved against `letters` — the SHUFFLED array the wheel renders — not
   * against puzzle.letters. Those are different orders, and these are indices.
   * See unlockedIndices: pointing them at the original order meant every
   * shuffle changed which letters were playable.
   */
  const unlockedIdx = unlockedIndices(letters, active);
  const clueWord = progress.clueMode
    ? clueTarget(puzzle.grid, rowDone, clueCursor, (w) =>
        isReachable(w, active)
      )
    : null;

  const bonusFound = [...found].filter((w) => !puzzle.grid.includes(w));
  const score = [...found].reduce((s, w) => s + scoreWord(w, data.wheel), 0);
  /*
   * Rank measures the SIX ROWS — the thing the game actually asks for.
   * `score` keeps counting everything, so extra words still feel like they
   * count, and they still pay out in hints.
   */
  // Rank counts ROWS FILLED now, not points — see RANK_NAMES.
  const rank = rankFor(rowsDone, puzzle.grid.length);

  const current = selected.map((i) => letters[i]).join('');
  /*
   * What a screen reader should hear after an action. Derived, so it cannot
   * drift from what is on screen, and deliberately terse — rank, score, and
   * how much is left, which is the information the sighted player gets from
   * the rank strip for free.
   */
  const announcement = toast
    ? `${toast.text}. ${rank.name}, ${score} points${
        rank.next ? `, ${rank.rowsToNext} to ${rank.next}` : ''
      }.`
    : '';
  /*
   * The streak strip is the one thing on the board whose CONTENT is the
   * calendar, and a static export is prerendered on the build machine's
   * calendar. Read through the store so the first client render matches the
   * HTML — blank cells — and the real week arrives immediately after. See
   * last7 for what this was doing to the live site.
   */
  const todayKey = useSyncExternalStore(
    subscribeNever,
    () => new Date().toDateString(),
    () => null
  );
  const days = useMemo(
    () => last7(progress, todayKey ? new Date(todayKey) : null),
    [progress, todayKey]
  );

  /*
   * Did today's square fill during THIS session?
   *
   * The streak is the one mechanic here whose whole job is to bring someone
   * back tomorrow, and it was the only thing on the board that never moved:
   * the square went from empty to ticked between renders, silently, with no
   * more ceremony than a checkbox.
   *
   * Session-scoped for the same reason `justSolved` is. A cell that animates
   * because it is FILLED would replay every reload, and motion that describes
   * state rather than change is exactly what this codebase decided against
   * when it refused to replay the landing for restored words. The ref holds
   * what today looked like on arrival, so the animation fires on the
   * transition and never again.
   */
  const todayFilled = days.length > 0 && days[days.length - 1].played;
  /*
   * `useState` with a lazy initialiser, not a ref. A ref would be the obvious
   * shape for "what it was when we arrived" and it is wrong here — reading
   * `.current` during render is what the react-hooks rule flags, and the rule
   * is right: this value is read to decide what to RENDER, which is the one
   * thing a ref is not for. The initialiser runs once, so this holds the
   * arrival value for the life of the mount without ever being written again.
   */
  const [todayOnArrival] = useState(() => todayFilled);
  const streakJustEarned = todayFilled && !todayOnArrival;

  /*
   * Derived, not stored — see lib/record.ts. Memoised on `progress` because it
   * walks every word ever banked, which is cheap now and stays cheap only if
   * it does not run on every render.
   */
  const record = useMemo(
    () => playerRecord(progress, data.wheel, data.puzzles),
    [progress, data.wheel, data.puzzles]
  );

  const shelves = useMemo(() => themeShelves(data), [data]);
  /* Which shelf is open; null is the four-shelf overview. Reset whenever the
     sheet closes, so it never reopens two levels deep. */
  const [openShelf, setOpenShelf] = useState<ShelfId | null>(null);

  const goToPuzzle = useCallback(
    (nextOffset: number) => {
      setOffset(nextOffset);
      // The player is steering now, so the board they arrived on from someone
      // else's link stops overriding. Otherwise Next puzzle would bounce them
      // straight back to it forever.
      setLandedOn(null);
      setSel([]);
      setJustSolved(new Set());
      setShowComplete(false);
      // No letters here. They follow the resolved puzzle by construction now;
      // setting them from a second index calculation is what broke.
    },
    [setSel]
  );

  const say = useCallback((text: string, tone: Toast['tone']) => {
    toastId.current += 1;
    setToast({ text, tone, id: toastId.current });
  }, []);

  /*
   * Restore, and SAY WHAT CAME BACK.
   *
   * The board's bar for 10+ was a restore that "states plainly what came back
   * and what didn't" — a silent partial restore is how a player concludes the
   * feature is broken. So a code made against an older catalogue reports that
   * it kept the streak and dropped the board list, rather than quietly
   * appearing to work.
   */
  const restoreFrom = useCallback(
    (code: string) => {
      const result = decodeProgress(code, data);
      if (!result.ok) {
        say(result.reason, 'bad');
        return false;
      }
      applyProgress(result.progress);
      // Settings rank above the streak for the accessibility seats, so they are
      // applied too — arriving readable is the point of carrying them.
      applyTextScale(result.display.text);
      applyReading(result.display.reading);
      say(
        result.catalogueMatched
          ? `Restored — streak ${result.progress.streak}, ${result.boardsRestored} boards`
          : `Restored your streak and settings. That code is from an older catalogue, so the board list did not come across.`,
        'good'
      );
      return true;
    },
    [data, say]
  );

  /*
   * Sync state lives in the component and NOT in storage: the passphrase is
   * never written anywhere, so closing the tab forgets it. That is the point —
   * a phrase we persisted would be a phrase we could be compelled to hand over.
   */
  const [phrase, setPhrase] = useState('');
  const [syncBusy, setSyncBusy] = useState(false);
  const syncOn = isSyncConfigured();

  const doSync = useCallback(
    async (dir: 'push' | 'pull') => {
      const problem = passphraseProblem(phrase);
      if (problem) {
        say(problem, 'bad');
        return;
      }
      setSyncBusy(true);
      try {
        const keys = await deriveKeys(phrase);
        if (dir === 'push') {
          const res = await syncPush(
            encodeProgress(progress, data, { text: textScale, reading }),
            keys
          );
          if (res.ok) {
            markBackedUp(new Date());
            say('Saved to sync', 'good');
          } else say(res.reason, 'bad');
          return;
        }
        const res = await syncPull(keys);
        if (!res.ok) {
          say(res.reason, 'bad');
          return;
        }
        restoreFrom(res.code);
      } finally {
        setSyncBusy(false);
      }
    },
    [phrase, progress, data, textScale, reading, say, restoreFrom]
  );

  /*
   * A `#restore=` link opened on the new phone. One tap, no typing, no camera —
   * the only transfer the board endorsed without argument.
   *
   * Runs once on mount and clears the hash immediately, so a reload does not
   * re-apply a stale code over progress made since.
   */
  useEffect(() => {
    const code = codeFromHash(window.location.hash);
    if (!code) return;
    history.replaceState(null, '', window.location.pathname + window.location.search);
    restoreFrom(code);
  }, [restoreFrom]);

  /*
   * A `#play=` link from someone else's share card.
   *
   * The number on a card is 1-based over the authored catalogue, which
   * `build-puzzles.mjs` places at the head of the array — so the board is at
   * index n-1, and `offsetForIndex` turns that into the offset the picker
   * speaks. Clamped, because the number came off a link somebody may have
   * retyped, and a bad one should land on today rather than nowhere.
   *
   * The hash is cleared immediately so a reload does not keep dragging the
   * player back to a board they have moved on from.
   *
   * The React Compiler's set-state-in-effect rule is disabled here, on purpose
   * and only here. Its advice — seed the state during initialization instead —
   * cannot apply: this app is a STATIC EXPORT, so `out/index.html` already
   * contains a fully rendered board, and the server that rendered it could not
   * have known the fragment. A `useState` initializer reading
   * `window.location.hash` would render a different board than the HTML being
   * hydrated, which is a hydration mismatch, not an optimization. The URL is an
   * external system and this is the sanctioned way to read one after mount.
   * Scoped to this effect so the rule keeps working everywhere else.
   */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const hash = window.location.hash;
    const n = puzzleFromHash(hash);
    const themeId = themeFromHash(hash);
    const beat = beatFromHash(hash);
    const ladder = chainFromHash(hash);
    if (n === null && themeId === null) return;
    history.replaceState(null, '', window.location.pathname + window.location.search);

    /*
     * A `#theme=` link opens that pack at its first board.
     *
     * The board asked for this instead of a challenge, six seats to two: the
     * person receiving it gets a session rather than a duel, and it spreads the
     * catalogue rather than a score.
     */
    if (themeId !== null) {
      const i = data.puzzles.findIndex((p) => p.theme?.id === themeId);
      if (i >= 0) {
        setLandedOn(i);
        setOffset(offsetForIndex(data, today, i));
        return;
      }
    }
    if (n === null) return;
    const index = Math.min(n - 1, dailyPoolSize(data) - 1);
    setLandedOn(index);
    setOffset(offsetForIndex(data, today, index));
    // Held, not shown. It is revealed only once they have submitted their own.
    if (beat !== null) setBeatTarget(beat);
    if (ladder !== null) setChain(ladder);
  }, [data, today]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /*
   * Announcements with no toast behind them.
   *
   * The two biggest rewards in the game are drawn ONLY into the celebration
   * layer, and that layer is `aria-hidden` — correctly, it is decoration. But
   * `say()` was never called for either, so a screen-reader player got nothing
   * at all for solving the six-letter prize word (the `isBase` branch has no
   * say(), it hands off to celebratePrize) and nothing for a rank promotion.
   * The one player who cannot see the card is the one who was told least.
   *
   * Separate from `toast` because routing these through say() would paint a
   * text toast on top of the celebration card — the visual design already
   * says this, twice would be a regression.
   */
  const [srSay, setSrSay] = useState<{ text: string; id: number } | null>(null);
  const srId = useRef(0);
  const announceOnly = useCallback((text: string) => {
    srId.current += 1;
    setSrSay({ text, id: srId.current });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1400);
    return () => clearTimeout(t);
  }, [toast]);

  /**
   * The player did something. Restarts the IDLE clock only.
   *
   * The clock measured time since the last BANKED WORD, which is a different
   * quantity from idleness and a much easier one to trip. Spelling, undoing,
   * shuffling and submitting all left it running, so forty-five seconds of
   * genuine work on a hard board ended in "Stuck? I'll start the 3-letter
   * one" — offered to somebody in the middle of a word, over a modal that
   * covers the board they were reading. Reported from live play, which is the
   * only way it shows up: every clock in the tests is driven by hand.
   *
   * Deliberately does NOT clear `misses`. A stall has two shapes and this is
   * only the silent one; a run of wrong guesses is still a stall, and that is
   * exactly the case where the player IS touching the board. Resetting both
   * here would make the offer unreachable for the player who most needs it.
   */
  const touchIdle = useCallback(() => {
    lastActivity.current = Date.now();
  }, []);

  const pick = useCallback(
    (i: number) => {
      // Feedback is computed OUTSIDE the updater: a state updater must be
      // pure, and React can legitimately invoke it twice (StrictMode, or
      // concurrent re-entry), which double-fired the haptic and clicked the
      // hidden iOS switch element twice.
      if (!selRef.current.includes(i)) feedback.tap();
      touchIdle();
      setSel((prev) => (prev.includes(i) ? prev : [...prev, i]));
    },
    [setSel, touchIdle]
  );

  /** Backspace, for the tap path — tapping the last letter takes it back. */
  const undoLetter = useCallback(() => {
    if (selRef.current.length === 0) return;
    feedback.tap();
    touchIdle();
    setSel((prev) => prev.slice(0, -1));
  }, [setSel, touchIdle]);

  /**
   * Fires exactly once, from either path that can finish a grid: submitting the
   * last word, or buying the last row with hints. Reads the store rather than
   * render state so it is correct inside the same event.
   */
  const finishIfDone = useCallback(
    (delayMs: number) => {
      const snap = getSnapshot();
      const banked = wordsFor(snap, puzzleId);
      const bought = revealFor(snap, puzzleId).words;
      const done = puzzle.grid.filter(
        (w) => banked.includes(w) || bought.includes(w)
      ).length;
      if (done < puzzle.grid.length) return;

      markCleared(puzzleId);
      /*
       * Practice puzzles must never move the streak, or it stops meaning
       * "showed up today".
       *
       * The warm-up ladder does NOT advance here. Advancing on completion
       * swapped the current puzzle out from under the summary sheet, so it
       * reported the next puzzle's state: "Warm-up 2 cleared" with a score of
       * 0 when you had just finished warm-up 1. The ladder advances when the
       * player leaves the sheet instead.
       */
      if (warmup === null && isDaily) update((p) => touchStreak(p, today));
      setTimeout(() => {
        feedback.complete();
        setShowComplete(true);
      }, delayMs);
    },
    [puzzle.grid, puzzleId, isDaily, warmup, today]
  );

  const commit = useCallback(() => {
    const word = selRef.current.map((i) => letters[i]).join('');
    // Measure the flight BEFORE clearing the selection — once the tiles
    // deselect they shrink, and the launch rects would be wrong.
    const flight = measureFlight(word, letters);
    setSel([]);
    if (!word) return;
    // Submitting is not idling, whatever the verdict turns out to be. A wrong
    // guess still counts against `misses`, which is the other stall shape.
    touchIdle();

    // Read the store directly rather than the render-time snapshot: two
    // submissions inside one React batch must not both bank the same word.
    const banked = new Set(wordsFor(getSnapshot(), puzzleId));
    const result = submit(puzzle, data.wheel, word, banked);

    switch (result.kind) {
      case 'grid': {
        const solvedBefore = puzzle.grid.filter((w) => banked.has(w)).length;
        feedback.correct(solvedBefore);

        /*
         * The reveal, three beats inside ~900ms:
         *   1. letters fly from the wheel to their slots
         *   2. each lands with an overshoot and a light sweep across the row
         *   3. the points float off the row
         */
        const flightMs = flyLetters(flight);
        const land = () => {
          setJustSolved((prev) => new Set(prev).add(result.word));
          addWord(puzzleId, result.word, false);
          setFloatFor({ word: result.word, points: result.points });
          setTimeout(() => setFloatFor(null), 950);
          /*
           * The first-run line retires the moment it has been obeyed.
           *
           * It asks for one thing — spell a word from the wheel — so filling a
           * row is proof it was understood. Dismissing on acknowledgement
           * instead would be the modal again wearing a different shape, and
           * the whole point of the board's ruling was that the teach should
           * end by being acted on rather than by being clicked away.
           */
          markIntroSeen();

          /*
           * Completion is checked HERE, after the word is actually banked.
           *
           * Grid words bank inside this callback, so a check that ran at submit
           * time was counting pre-flight state: submit words faster than the
           * animation — easy when typing — and the last word banked after the
           * check had already decided the puzzle wasn't finished. The grid
           * filled and nothing happened. finishIfDone reads the store and
           * decides for itself, so calling it here is both correct and simpler
           * than the arithmetic it replaces.
           */
          finishIfDone(380);
        };
        lastActivity.current = Date.now();
        setMissState({ id: puzzleId, n: 0 });
        if (flightMs > 0) setTimeout(land, flightMs * 0.62);
        else land();

        if (result.isBase) {
          // The word that uses every letter is the hardest thing in the puzzle
          // and used to get the same treatment as a three-letter bonus.
          feedback.prize();
          celebratePrize(result.word, result.points);
          announceOnly(
            `${result.word.toUpperCase()}, the word that uses every letter. Plus ${result.points} points.`
          );
        } else {
          say(`+${result.points}`, 'good');
        }

        // Promotion is the one recurring reward with no moment attached to it.
        // Same basis as the displayed rank: grid rows only, or the banner
        // would fire on a threshold the rank strip does not agree with.
        /* Promotion is now a ROW count, so the comparison is rows before and
           after this word — and only a grid word can move it. */
        const rowsOf = (extra?: string) =>
          puzzle.grid.filter((w) => banked.has(w) || w === extra).length;
        const before = rankFor(rowsOf(), puzzle.grid.length);
        const after = rankFor(rowsOf(result.word), puzzle.grid.length);
        if (after.index > before.index) {
          setTimeout(() => celebrateRank(after.name, after.next), 620);
          // Delayed to match the banner, so it does not interrupt the '+N'
          // that is still being read. Once, on the transition only.
          setTimeout(
            () =>
              announceOnly(
                after.next
                  ? `Promoted to ${after.name}. ${after.rowsToNext} to ${after.next}.`
                  : `Promoted to ${after.name}.`
              ),
            620
          );
        }
        break;
      }
      case 'bonus':
        lastActivity.current = Date.now();
        setMissState({ id: puzzleId, n: 0 });
        feedback.bonus();
        addWord(puzzleId, result.word, true);
        setJustSolved((prev) => new Set(prev).add(result.word));
        // Every third bonus word buys a hint, so the moment it happens is
        // worth naming inside the celebration rather than leaving the balance
        // to change quietly.
        celebrateBonus({
          word: result.word,
          points: result.points,
          earnedHint:
            bonusToNextToken(getSnapshot().bonusTotal) === BONUS_PER_TOKEN,
          targetSelector: '[data-bonus-target]',
        });
        break;
      case 'duplicate':
        feedback.duplicate();
        say('Already found', 'neutral');
        break;
      case 'too-short':
        feedback.duplicate();
        /*
         * Name the rule, not just the verdict. The wheel prevents this — the
         * submit button is disabled below the minimum and counts up "1/3" —
         * so the only way to reach here is by TYPING, where there is no such
         * signal and "Too short" leaves the player to guess the threshold.
         */
        say(`Too short — ${MIN_WORD_LENGTH} letters minimum`, 'neutral');
        break;
      case 'invalid':
        setMissState((m) =>
          m.id === puzzleId ? { id: puzzleId, n: m.n + 1 } : { id: puzzleId, n: 1 }
        );
        feedback.reject();
        setShaking(true);
        setTimeout(() => setShaking(false), 360);
        say('Not a word', 'bad');
        break;
    }
  }, [
    letters,
    puzzle,
    data.wheel,
    puzzleId,
    say,
    announceOnly,
    setSel,
    finishIfDone,
    touchIdle,
  ]);

  const cycleTheme = useCallback(() => {
    applyTheme(nextTheme(getThemeSnapshot()));
  }, []);

  // Arm the earliest legal fullscreen request; the listener removes itself.
  useEffect(() => autoFullscreenOnFirstGesture(), []);

  /*
   * Stop asking only after a real EXIT.
   *
   * The first version fired on mount — fullscreen is false at load, so it
   * immediately wrote "don't auto-enter" and the feature disabled itself
   * before it ever ran. Only a true -> false transition counts.
   */
  const wasFullscreen = useRef(false);
  useEffect(() => {
    if (wasFullscreen.current && !fullscreen) rememberFullscreenExit();
    wasFullscreen.current = fullscreen;
  }, [fullscreen]);

  useEffect(() => {
    let alive = true;
    void loadDefinitions().then((d) => {
      if (alive) setDefs(d);
    });
    return () => {
      alive = false;
    };
  }, []);

  /**
   * Show the bundled definition immediately, then upgrade in place if a modern
   * one can be fetched. No spinner in front of content the player could already
   * be reading — the only wait is when there is no floor to show.
   */
  /*
   * The clue this board wrote for the word, when there is one. Authored clues
   * only exist on themed boards, so this is null on the free-practice set and
   * the sheet falls back to the dictionary alone.
   */
  /*
   * Filled in, not blanked. This sheet only ever opens on a row that is
   * already done, so the redaction has no work left to do here — it was
   * hiding the answer from the one player who has already found it, and
   * turning a citation back into a riddle at the moment it should read as a
   * fact.
   */
  const themedClue = showDef
    ? (puzzle.clues?.[showDef.word]
        ? fillClue(puzzle.clues[showDef.word], showDef.word)
        : null)
    : null;

  const openDefinition = useCallback(
    (word: string) => {
      const entry = lookup(defs, word);
      setShowDef(entry ? fromBundled(word, entry) : null);
      setDefUpgrading(true);

      void resolveModern(word).then((modern) => {
        setDefUpgrading(false);
        // Only replace if the sheet is still on this word; a fast player can
        // have moved on before the request lands.
        setShowDef((current) => {
          if (modern) return modern;
          if (current) return current;
          // No floor and no upgrade — say so rather than leaving a blank sheet.
          return { word, definition: '', source: 'bundled' };
        });
      });
    },
    [defs]
  );

  /**
   * Every solved word is now tappable: the API covers most of the 20% the
   * bundled source lacks, so gating on the bundle would hide definitions that
   * are in fact available.
   */
  const hasDefinition = useCallback(() => true, []);

  /*
   * Stall watch.
   *
   * Polling rather than a single timer because "stuck" has two shapes — a long
   * silence and a run of wrong guesses — and only one of them fires an event.
   * Cheap at this interval, and it stops entirely once the grid is done.
   */
  const unsolvedRows = puzzle.grid.filter((w) => !rowDone(w));
  useEffect(() => {
    if (unsolvedRows.length === 0) return;
    const id = setInterval(() => {
      /*
       * The stall clock does not run while a dialog is open.
       *
       * It used to run during the first-run explainer, so a new player read
       * the intro for forty-five seconds, dismissed it, and was immediately
       * met with "Stuck? I'll open the 3-letter one" — before they had seen
       * the board, let alone failed at it. From the outside that reads as
       * having to dismiss twice to start playing, which is exactly how it was
       * reported.
       *
       * Resetting the mark rather than merely skipping means time spent in
       * any sheet — the rules, the puzzle picker, a definition — is not
       * counted as being stuck either. Being stuck means staring at the board.
       */
      if (dialogOpen()) {
        lastActivity.current = Date.now();
        return;
      }
      /*
       * A NEW BOARD IS NOT A STALLED BOARD. The clock does not start until the
       * player has touched something.
       *
       * It used to arm itself here, on the first poll after mount, which meant
       * the clock ran against a player who had not yet done anything at all.
       * Measured on a cold first load of the production build, no interaction:
       * "Stuck? I'll open the 3-letter one" appeared after THIRTY-NINE SECONDS,
       * on the warm-up, offering to spend all three of a new player's hints
       * before they had made a single move. A first-timer reading the clue is
       * the single most likely person to meet this, and it tells them the game
       * thinks they are failing at something they have not started.
       *
       * `touchIdle` is now the only thing that starts it, so "idle" means idle
       * SINCE ACTING rather than idle since arriving. Being stuck presupposes
       * having tried. The wrong-guess route is untouched and needs no clock —
       * it counts submissions, which are themselves proof the player began.
       */
      if (clockFor.current !== puzzleId) {
        clockFor.current = puzzleId;
        lastActivity.current = 0;
        return;
      }
      if (lastActivity.current === 0) return;
      const stalled = isStalled({
        idleMs: Date.now() - lastActivity.current,
        missesSinceProgress: misses,
        rowsLeft: unsolvedRows.length,
        tokens,
        alreadyOffered: offeredFor === puzzleId,
      });
      if (stalled) {
        setOfferedFor(puzzleId);
        setAssistOpen(true);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [unsolvedRows.length, misses, tokens, offeredFor, puzzleId]);

  /** Does the thing, rather than telling the player what to do. */
  const acceptAssist = useCallback(() => {
    const plan = assistFor(unsolvedRows, tokens, COST_LETTER, COST_WORD);
    setAssistOpen(false);
    if (!plan) return;

    if (plan.kind === 'open-word') {
      const r = revealWord(reveal, plan.word, { solved: false, balance: tokens });
      if (r.ok) {
        spendHint(puzzleId, r.reveal, r.cost);
        feedback.correct(0);
        say(`${plan.word.toUpperCase()} · opened for you`, 'neutral');
        finishIfDone(360);
      }
      return;
    }

    // Both remaining plans reveal a letter; the free one just doesn't charge.
    const r = revealLetter(reveal, plan.word, { solved: false, balance: 99 });
    if (!r.ok) return;
    spendHint(puzzleId, r.reveal, plan.cost);
    feedback.spend();
    lastActivity.current = Date.now();
    setMissState({ id: puzzleId, n: 0 });
    say(
      plan.cost === 0 ? 'Here — on the house' : `Letter revealed · −${plan.cost}`,
      'neutral'
    );
  }, [unsolvedRows, tokens, reveal, puzzleId, say, finishIfDone]);

  // Keep the audio module in step with the stored preference.
  useEffect(() => {
    setMuted(progress.muted);
    /*
     * Sound and haptics are separate channels. Muting used to kill both, which
     * is backwards: the player who mutes because they are in a meeting is
     * exactly the one who still wants to feel the game.
     */
    setHapticsMuted(false);
  }, [progress.muted]);

  // Desktop players expect to type.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      /*
       * A dialog owns the keyboard while it is open.
       *
       * This listener was unconditional, so with a sheet open Space shuffled
       * the wheel behind it and every letter key selected tiles the player
       * could not see — state changing invisibly under a modal.
       */
      if (dialogOpen()) return;
      /*
       * A focused control owns Enter and Space; this listener does not.
       *
       * Enter and Space are how a button is pressed without a pointer, and
       * this handler was calling preventDefault on both unconditionally — so
       * with focus on Shuffle, on a wheel tile, on a row, on the header icons,
       * pressing either key ran commit()/shuffle() instead of activating the
       * thing that was focused. Measured: every button on the board reported
       * zero clicks after Tab-to-it, Enter, Space. That is a total keyboard
       * operability failure (WCAG 2.1.1) hiding behind a board that LOOKS
       * keyboard-friendly because typing letters works.
       *
       * Letters and Backspace stay global on purpose: typing a word is the
       * desktop input model and must keep working wherever focus happens to
       * be. Only the two activation keys are handed back.
       */
      const el = e.target as HTMLElement | null;
      if (
        (e.key === 'Enter' || e.key === ' ') &&
        el &&
        el !== document.body &&
        el.closest('a[href],button,[role="switch"],[role="menuitem"],input,select,textarea,[tabindex]:not([tabindex="-1"])')
      ) {
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        setSel((prev) => prev.slice(0, -1));
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        touchIdle();
        setLetters((prev) => shuffle(prev));
        setSel([]);
        return;
      }
      if (!/^[a-zA-Z]$/.test(e.key)) return;
      const ch = e.key.toLowerCase();
      setSel((prev) => {
        // Index-based: the first unused tile of this letter that is unlocked.
        const i = letters.findIndex(
          (l, idx) =>
            l === ch && !prev.includes(idx) && unlockedIdx.has(idx)
        );
        if (i === -1) return prev;
        feedback.tap();
        return [...prev, i];
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commit, letters, setSel, unlockedIdx, setLetters, touchIdle]);

  /**
   * Hints are targeted: the player taps the row they're stuck on, because
   * which word is blocking them is information only they have. The old version
   * guessed for them and always picked the first unsolved row.
   */
  const spendLetter = useCallback(
    (word: string) => {
      const r = revealLetter(reveal, word, {
        solved: rowDone(word),
        balance: tokens,
      });
      if (!r.ok) {
        feedback.duplicate();
        say(
          r.reason === 'no-tokens'
            ? 'No hints left'
            : r.reason === 'nothing-left'
              ? 'Only one letter left — solve it'
              : 'Already done',
          'neutral'
        );
        return;
      }
      spendHint(puzzleId, r.reveal, r.cost);
      feedback.spend();
      say(`Letter revealed · −${r.cost}`, 'neutral');
    },
    [reveal, tokens, puzzleId, say, rowDone]
  );

  const spendWord = useCallback(
    (word: string) => {
      const r = revealWord(reveal, word, {
        solved: rowDone(word),
        balance: tokens,
      });
      if (!r.ok) {
        feedback.duplicate();
        say(r.reason === 'no-tokens' ? `Needs ${COST_WORD} hints` : 'Already done', 'neutral');
        return;
      }
      spendHint(puzzleId, r.reveal, r.cost);
      feedback.spend();
      say(`${word.toUpperCase()} · −${r.cost}`, 'neutral');
      finishIfDone(360);
    },
    [reveal, tokens, puzzleId, say, rowDone, finishIfDone]
  );

  const shareArgs = () => ({
      /*
       * The pack's `name`, not `category`.
       *
       * Sending both was tried on 2026-08-21 and reverted the same hour: the
       * data splits a pack into an evocative half ("THE PIT") and a plain one
       * ("Barbecue"), and joining them produced "Six on the Dial — THE PIT ·
       * Barbecue · Complete" — forty-seven characters, three dot separators
       * and a shout. Wordle's entire first line is three words. The heading
       * is the part a reader scanning a feed sees and nothing else, so length
       * costs more here than specificity buys.
       */
      theme: puzzle.theme?.name ?? null,
      /*
       * Quote a clue from a row the player actually SOLVED — never an unsolved
       * one, which would spoil the board for whoever reads the post. Longest
       * solved row first: the longer the word, the more the clue had to work.
       */
      clue:
        puzzle.grid
          .filter((w) => found.has(w))
          .sort((a, b) => b.length - a.length)
          .map((w) => puzzle.clues?.[w])
          .find((c): c is string => Boolean(c)) ?? null,
      rank: rank.name,
      score,
      // Tray order, so the shape a reader sees is the shape the player saw.
      tiles: puzzle.grid.map((w) => ({
        solved: found.has(w),
        isBase: w === puzzle.base,
        length: w.length,
      })),
      bonusFound: bonusFound.length,
      streak: progress.streak,
      /*
       * Only the daily carries a number, because only the daily is the same
       * board for everyone. Warm-up and practice deliberately print none — the
       * last time every board carried one, a warm-up player posted "#1" at a
       * board nobody else could see.
       */
      dayNumber: isDaily ? dailyIndex(today, dailyPoolSize(data)) + 1 : null,
      // Only when it was actually in force — the warm-up ladder runs without it.
      escalating: progress.escalating && warmup === null,
      // Configured per deploy; falls back to wherever the game is actually
      // being played rather than a guessed domain.
      /*
       * The URL points at THIS board, not the front door.
       *
       * A card that links to the homepage is a boast: it says someone did well
       * and gives the reader no way in. `#play=137` makes it an invitation —
       * tap it and you are on the exact board being discussed. That is the
       * mechanism behind a daily people actually talk about, and it costs
       * nine characters.
       *
       * Only for the daily, for the same reason it is the only board with a
       * number: it is the only one that is the same for everybody.
       */
      url: (() => {
        const origin =
          process.env.NEXT_PUBLIC_SHARE_URL ||
          (typeof window !== 'undefined' ? window.location.origin : undefined);
        if (!origin) return undefined;
        const n = isDaily ? dailyIndex(today, dailyPoolSize(data)) + 1 : null;
        return n ? `${origin.replace(/\/$/, '')}/#play=${n}` : origin;
      })(),
  });

  const shareCard = () => shareText(shareArgs());
  const shareCardParts = () => shareParts(shareArgs());

  /** The origin to build links against, configured per deploy. */
  const origin = () =>
    process.env.NEXT_PUBLIC_SHARE_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  /*
   * Challenge someone to THIS board.
   *
   * The board blocked the original sketch and allowed this: the link carries
   * the board and a score, and nothing else. No clue rides along — it is a
   * hint, and a board somebody pre-softened is a tainted result — and the
   * number stays hidden on the far end until they have submitted their own.
   */
  const challenge = async () => {
    const n = isDaily ? dailyIndex(today, dailyPoolSize(data)) + 1 : index + 1;
    /*
     * Pass the LADDER on, not just this score.
     *
     * `beat=` ends a chain: whoever receives it plays one round against one
     * number and the thread stops there. `chain=` carries everyone who has
     * played, so a link going round a group comes back knowing all of it —
     * and the whole ladder lives in the URL those people are already sending
     * each other. No server, no account, no identity.
     *
     * `beat=` is still emitted alongside it so a link built by this version
     * still means something to a client that only understands the old one.
     */
    const ladder = chainToHash(chain ?? [], score);
    const url = `${origin().replace(/\/$/, '')}/#play=${n}&beat=${score}&chain=${ladder}`;
    const played = ladder.split('.').length;
    const text =
      played > 1
        ? `${played} of us have played ${puzzle.theme?.name ?? 'Six on the Dial'}. I got ${score}. Your turn.`
        : `I scored ${score} on ${puzzle.theme?.name ?? 'Six on the Dial'}. Your turn.`;
    try {
      if (navigator.share) return void (await navigator.share({ text, url }));
      await navigator.clipboard.writeText(`${text}\n${url}`);
      say('Challenge copied — send it to them', 'good');
    } catch {
      /* dismissed */
    }
  };

  /*
   * The return trip.
   *
   * There is no server, so a result cannot travel back on its own — and the
   * board called a one-way challenge a broken promise rather than a feature.
   * This pre-fills the reply so it goes back down the same channel the
   * invitation arrived on, which is the only honest round trip available.
   */
  const replyToChallenge = async () => {
    if (beatTarget === null) return;
    const verdict =
      score > beatTarget
        ? `Beat you — ${score} to ${beatTarget}.`
        : score === beatTarget
          ? `Dead tie. ${score} each.`
          : `You win: ${beatTarget} to ${score}.`;
    const text = `${verdict} ${puzzle.theme?.name ?? 'Six on the Dial'}.`;
    try {
      if (navigator.share) return void (await navigator.share({ text }));
      await navigator.clipboard.writeText(text);
      say('Reply copied — send it back', 'good');
    } catch {
      /* dismissed */
    }
  };

  /*
   * Share a whole THEME rather than one board.
   *
   * The board asked for this instead of a challenge, six seats to two: the
   * person opening it gets a session, not a duel, and it spreads the catalogue
   * — which is the asset — rather than a score, which is not.
   */
  const shareTheme = async () => {
    const t = puzzle.theme;
    if (!t) return;
    const count = data.puzzles.filter((p) => p.theme?.id === t.id).length;
    const url = `${origin().replace(/\/$/, '')}/#theme=${t.id}`;
    const text = `${t.name} on Six on the Dial — ${count} boards. ${t.blurb}`;
    try {
      if (navigator.share) return void (await navigator.share({ text, url }));
      await navigator.clipboard.writeText(`${text}\n${url}`);
      say('Link copied — send them the pack', 'good');
    } catch {
      /* dismissed */
    }
  };

  const share = async () => {
    /*
     * The URL goes in its OWN field, not inside the text.
     *
     * iMessage, Slack and WhatsApp unfurl a link passed as `url` and none of
     * them reliably unfurl one found inside a text blob. The card used to end
     * with the link on its last line, which meant every Open Graph tag this
     * app ships — the preview card, the image, the theme name — was being
     * thrown away, and the share arrived as a grey string.
     *
     * The clipboard fallback still gets the link inline, because a clipboard
     * has no fields and a pasted card with no link is a dead end.
     */
    const parts = shareCardParts();
    try {
      if (navigator.share) {
        await navigator.share({ text: parts.text, url: parts.url });
        return;
      }
      await navigator.clipboard.writeText(parts.full);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* user dismissed the share sheet — nothing to report */
    }
  };

  const rail = (
    <Rail
      gridWords={puzzle.grid}
      found={found}
      bonusFound={bonusFound}
      rank={rank}
      score={score}
      rowsFilled={rowsDone}
      totalRows={puzzle.grid.length}
      days={days}
      record={record}
      boardFound={boardProgress(found, puzzle.grid, puzzle.bonus).found}
      boardTotal={boardProgress(found, puzzle.grid, puzzle.bonus).total}
      boardComplete={rowsDone === puzzle.grid.length}
      onChallenge={challenge}
      streakJustEarned={streakJustEarned}
      streak={progress.streak}
      bestStreak={progress.bestStreak}
          freezes={progress.freezes}
          vacationSince={progress.vacationSince}
          onVacation={(on) =>
            update((cur) => (on ? startVacation(cur, new Date()) : endVacation(cur)))
          }
      hasDefinition={hasDefinition}
      onShowDefinition={openDefinition}
    />
  );

  /*
   * Layout by breakpoint. The board NEVER stretches — it stays a bounded
   * column at every width, which is how Syllo and Duolingo handle a
   * single-puzzle game on a wide screen. Extra width goes to the evidence
   * rail or stays deliberately empty; it never inflates the game.
   *
   *   < 768   one column, wheel bottom-anchored in the thumb zone; the
   *             rail is reachable through a sheet
   *   >= 768  two columns already. An iPad in portrait has room for the
   *             board plus a narrow rail, and stacking them left a
   *             half-cut card at the fold, which read as broken
   *   >= 1024 wider rail, board centers vertically in its cell
   *   >= 1536 wider measure again, rail gains the how-to-play card
   */
  return (
    <main className="safe-top safe-bottom mx-auto flex h-svh w-full max-w-[420px] flex-col overflow-hidden px-5 short:px-4 md:max-w-[860px] lg:max-w-[1040px] xl:max-w-[1180px] 2xl:max-w-[1320px]">
      {/* Header — quiet. Day number and streak are evidence, not the hero. */}
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="whitespace-nowrap text-item font-semibold text-text-primary max-[379px]:text-meta">
            Six on the Dial
          </h1>
          <button
            type="button"
            onClick={() => setShowPuzzles(true)}
            aria-haspopup="dialog"
            /* min-h-6 is WCAG 2.5.8's floor, not a style choice: this measured
               20.6px tall at 390px, so the app's only route to the puzzle
               picker and the themes was an undersized target. */
            className="inline-flex min-h-6 items-center whitespace-nowrap text-meta text-text-muted underline decoration-edge/50 underline-offset-2 transition-colors hover:text-text-secondary max-[379px]:text-meta"
          >
            {warmup !== null ? (
              <>Warm-up {warmup} of {data.starters.length}</>
            ) : isDaily ? (
              <>
                Today
                {progress.streak > 0 ? ` · ${progress.streak} day streak` : ''}
              </>
            ) : puzzle.theme ? (
              // "Puzzle +212" is accurate and tells you nothing. On a themed
              // board the theme IS where you are.
              <>{puzzle.theme.name}</>
            ) : (
              <>Puzzle {offset > 0 ? `+${offset}` : offset}</>
            )}{' '}
            <ChevronIcon className="inline-block align-[-0.2em]" />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2 max-[379px]:gap-1.5">
        {canFullscreen && (
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
            aria-pressed={fullscreen}
            className="liquid-interactive relative grid h-9 w-9 place-items-center rounded-full border-2 border-edge-mid liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] text-text-primary transition-colors hover:border-edge hover:text-text-primary touch:h-11 touch:w-11"
          >
            <FullscreenIcon on={fullscreen} />
          </button>
        )}
        <button
          type="button"
          onClick={cycleTheme}
          aria-label={`Theme: ${theme}. Tap to change.`}
          className="liquid-interactive relative grid h-9 w-9 place-items-center rounded-full border-2 border-edge-mid liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] text-text-primary transition-colors hover:border-edge hover:text-text-primary touch:h-11 touch:w-11"
        >
          <ThemeIcon theme={theme} scheme={scheme} />
        </button>
        <button
          type="button"
          onClick={() => setShowRules(true)}
          aria-haspopup="dialog"
          aria-label="How to play"
          className="liquid-interactive relative grid h-9 w-9 place-items-center rounded-full border-2 border-edge-mid liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] text-text-primary transition-colors hover:border-edge hover:text-text-primary touch:h-11 touch:w-11"
        >
          <HelpIcon />
        </button>
        <button
          type="button"
          onClick={() => setMutedPref(!progress.muted)}
          aria-label={progress.muted ? 'Unmute sound' : 'Mute sound'}
          className="liquid-interactive relative grid h-9 w-9 place-items-center rounded-full border-2 border-edge-mid liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] text-text-primary transition-colors hover:border-edge hover:text-text-primary touch:h-11 touch:w-11"
        >
          <SoundIcon muted={progress.muted} />
        </button>
        </div>
      </header>

      {/* grid-rows-[minmax(0,1fr)]: the implicit row is `auto`, so it grows to
          the rail's full content height and the aside's `md:max-h-full` then
          resolves against a row that is already too tall — which is why a
          landscape iPad clipped 46px of the rail off the bottom instead of
          scrolling it. Bounding the row is what makes max-h-full mean
          anything. */}
      <div className="mt-4 flex min-h-0 flex-1 shrink flex-col gap-8 short:mt-2 md:grid md:grid-rows-[minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_280px] md:gap-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 2xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Board column — bounded at every width, centered on desktop. */}
        {/* The glass sheet is no longer md-only. On a phone the play area was
            bare carbon with glass bits floating on it, so the app's main
            surface — the biggest thing on screen — was the one thing that
            wasn't the material. Phone padding is deliberately tighter than the
            tablet's; the wheel gives up the ~16px, which it can afford. */}
        <div className="mx-auto flex w-full min-h-0 max-w-[420px] flex-1 flex-col rounded-3xl border border-edge-hairline px-3 pt-3 pb-1.5 cramped:px-2 cramped:pt-2 cramped:pb-1 liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] md:max-w-[520px] lg:max-w-[600px] xl:max-w-[680px] board-center relative md:border-edge md:px-5 md:py-4">
      {/* On a phone this strip is the ONLY place progress lives, so it is also
          the way into the detail. Inert from tablet up, where the rail shows
          the same ladder permanently. */}
      <button
        type="button"
        onClick={() => setShowWords(true)}
        aria-haspopup="dialog"
        aria-label="Rank and progress details"
        className="block w-full text-left md:pointer-events-none md:mb-2"
      >
        <RankBar
          rank={rank}
          /* ROWS, not score — the strip must show the thing its rank is
             computed from. See RankBar. */
          rowsFilled={rowsDone}
          totalRows={puzzle.grid.length}
          bonusCount={bonusFound.length}
        />
      </button>

      {/* Sits in the flow, above the board, so it pushes nothing over and traps
          nothing. It is the first thing read in DOM order too, which is what a
          screen-reader player needs from a goal statement. */}
      {!progress.seenIntro && (
        <p className="mx-auto mt-2 max-w-[22rem] rounded-full border border-edge-mid px-4 py-1.5 text-center text-meta font-medium text-text-secondary short:mt-0.5">
          Six letters. Six words. All from the wheel.
        </p>
      )}

      {puzzle.theme && (
        <div className="mt-2 text-center short:mt-0.5">
          {/* Category first, then the pack's own name. "Roll Call" is an
              insider's name and tells a newcomer nothing; "GO-GO · ROLL CALL"
              keeps the name and opens the door. Themes whose name already
              states the tradition carry no category and render unchanged. */}
          <p className="text-kicker uppercase tracking-[0.18em] text-text-secondary">
            {puzzle.theme.category && (
              <span className="text-text-muted">{puzzle.theme.category} · </span>
            )}
            {puzzle.theme.name}
          </p>
          {/* The board's own subject. Clue mode reveals one clue at a time, so
              without this the scene a board is built around never assembles —
              a player meets `sole` on a board about writing credits with
              nothing anywhere saying so. */}
          {puzzle.theme.scene && (
            <p className="mt-0.5 text-meta italic leading-snug text-text-muted">
              {puzzle.theme.scene}
            </p>
          )}
        </div>
      )}

      {/* Target grid */}
      {/* 12 here, not 24. The rail next to this keeps a steady 12 between its
          panels and the rest of this column runs on 12, so `roomy:mt-6` was the
          one gap in the board that doubled — on a tall desktop it read as the
          theme label drifting away from the row it labels. */}
      <section aria-label="Words to find" className="mt-3 short:mt-2 roomy:mt-3">
        <WordTray
          grid={puzzle.grid}
          found={found}
          reveal={reveal}
          base={puzzle.base}
          justSolved={justSolved}
          floatFor={floatFor}
          canHint={tokens > 0}
          tokens={tokens}
          onRevealLetter={spendLetter}
          onRevealWord={spendWord}
          hasDefinition={hasDefinition}
          onShowDefinition={openDefinition}
          compact={progress.clueMode}
          activeWord={clueWord}
          /* Press-and-hold peek. Reads the same clue map the clue card does,
             so the two can never disagree about what a row is asking. */
          clueFor={(w) => puzzle.clues?.[w]}
        />
      </section>

      {/* Clue mode: one question at a time. Six clues at once doesn't fit a
          phone and doesn't focus anyone — this is the row you're solving. */}
      {clueWord && (
        <button
          type="button"
          onClick={() => setClueCursor((c) => c + 1)}
          className="liquid-interactive relative mt-3 w-full rounded-xl border border-edge-mid liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] px-3.5 py-2.5 text-left transition-colors hover:border-text-primary"
        >
          <span className="text-meta uppercase tracking-[0.14em] text-text-muted">
            {clueWord.length} letters
            {puzzle.grid.filter((w) => !rowDone(w)).length > 1
              ? ' · tap for the next clue'
              : ''}
          </span>
          <span className="mt-1 line-clamp-3 block text-body leading-snug text-text-secondary roomy:text-body">
            {puzzle.clues[clueWord]}
          </span>
        </button>
      )}


      {/* A plain gap. This used to be greedy, which is exactly how it became a
          101px hole on a tall phone — it won the leftover and then had nothing
          to do with it. The wheel is the greedy box now. */}
      <div className="h-3 shrink-0 short:h-2 md:h-3" />

      {/* Current word — the only place the accent green appears mid-play */}
      <div
        // No longer a live region: it holds the word being typed, and
        // announcing it letter-by-letter is noise. Results go to the status
        // region below, which a toast cannot overwrite.
        className={[
          /*
           * The slot is a FIXED height and the word is the tallest thing that
           * can sit in it, so the two have to be reconciled or the word spills
           * into the dial below — which reads as the board shifting to make
           * room, even though nothing moves.
           *
           * `leading-none` on the word is half the fix: the inherited 1.5
           * line-height gave a 32px word a 48px line box in a 40px slot. It
           * only reproduces where the word renders at 32px — i.e. NOT on a
           * mouse, where it is 26px and fits — so a touchscreen laptop hits it
           * and a desktop with a mouse never does.
           *
           * `shrink-0` is the OTHER half, and without it the fixed height was
           * a fiction. This slot is a flex item in a height-constrained column,
           * so flexbox was free to shrink it past `h-11` to whatever it
           * contained: 18px holding the instruction line, 32px holding a
           * letter. Picking the first letter therefore grew the slot by 14px
           * and pushed the dial — the thing under your thumb — 14px down the
           * screen, mid-gesture. Measured at 320x568: wheel top 342 to 356.
           *
           * The height is now reserved whether or not anything is in it, so
           * the board is still. `short:h-8` is 32px, exactly the word's line
           * box, so the smallest screens give up the least to hold it.
           */
          'mb-1.5 grid h-11 shrink-0 place-items-center short:mb-1 short:h-8',
          shaking ? 'anim-shake' : '',
        ].join(' ')}
      >
        {toast ? (
          <span
            key={toast.id}
            className={[
              'anim-rise text-body font-semibold',
              toast.tone === 'good'
                ? 'text-success-ink'
                : toast.tone === 'bad'
                  ? 'text-danger'
                  : 'text-text-muted',
            ].join(' ')}
          >
            {toast.text}
          </span>
        ) : current ? (
          <span className="text-hero font-bold leading-none tracking-[0.14em] text-text-primary mouse:text-word-desk">
            {current.toUpperCase()}
          </span>
        ) : (
          // An empty hero slot read as a hole in the layout, and nothing on
          // screen said how to enter a word. One muted line fixes both.
          <span className="text-meta text-text-muted">
            {hasLocked ? (
              // Explain the rule at the moment it is visibly in force, rather
              // than in a settings sheet the player has never opened.
              <span>Dim letters unlock as you fill rows</span>
            ) : (
              <>
            {/* Rendered per modality in CSS rather than from a measured
                pointer type, so it is correct before hydration. */}
            {/* Says WHAT to do, not only how. "Drag across the letters" is a
                gesture instruction that assumes the player already knows what
                they are trying to make.

                TAP, not drag. The player board polled the first gesture a new
                player makes and it is unanimous: everyone taps, nobody drags —
                a circle of buttons offers tapping as its only obvious
                affordance. Naming the gesture nobody reaches for first meant
                the one line teaching the game described the wrong action. Drag
                still works and is still first-class; it is simply not what a
                first-timer needs told. */}
            <span className="mouse:hidden">Tap letters to spell a word</span>
            <span className="hidden mouse:inline">
              Click letters to spell a word, or type it
            </span>
              </>
            )}
          </span>
        )}
      </div>

      {/*
        Screen-reader status. Rank promotion was previously conveyed ONLY by a
        progressbar value change and a visual banner — and a progressbar value
        is not a status message, so no assistive technology ever spoke it. The
        player could climb from Solid to Genius in silence.
      */}
      {/*
        The text is keyed by the toast's id so a REPEATED message is still a
        DOM mutation. `announcement` is derived, so rejecting the same word
        twice produced the identical string both times — React wrote nothing,
        the live region never changed, and the second rejection was silent.
        Rejections repeating is the normal case, not an edge one.

        The region element itself stays mounted: replacing the live region
        rather than its contents is the classic way to get nothing announced
        at all, because a region added in the same tick as its text is not
        treated as a change.
      */}
      <p role="status" aria-live="polite" className="sr-only">
        <span key={toast?.id ?? 'idle'}>{announcement}</span>
      </p>
      {/* Second region so a prize or a promotion cannot overwrite the '+N'
          that is mid-announcement in the first one — a polite region that
          changes twice inside a tick reads only the last value. */}
      <p role="status" aria-live="polite" className="sr-only">
        <span key={srSay?.id ?? 'idle'}>{srSay?.text ?? ''}</span>
      </p>

      {/* Wheel — bottom third, thumb zone. This is the greedy box now: it takes
          whatever the tray and controls don't, so the board has no slack left
          to pool anywhere else. */}
      {/* min-h matches the wheel's own clamp floor. Without it flex hands this
          box only the leftover — 100px on a 320x568 phone — while the wheel
          still floors at 150 and bleeds 21px into the hint line above and the
          controls below. The floor has to be reserved by the FLEX box, because
          the wheel's `height: 100%` can't feed back into flex sizing. */}
      <div className="flex min-h-[150px] flex-1 items-center justify-center">
        <LetterWheel
          letters={letters}
          selected={selected}
          onSelect={pick}
          onCommit={commit}
          onClear={() => setSel([])}
          onUndo={undoLetter}
          activeIndices={unlockedIdx}
          /*
           * The dial's detent. Six rows, six tiles, six positions: each solved
           * row advances the wheel a sixth of a turn, so a finished board has
           * turned it exactly once. This is the reveal the game did not have —
           * the letters leaving the wheel for the tray was the only thing that
           * happened, and it happened to the TRAY. Now the object the game is
           * named after answers a solve.
           */
          detents={rowsDone}
        />
      </div>

      {/* Controls.
          The top margin is separation, not spacing. Shuffle and bonus sat close
          enough to the wheel's rim that on a phone they read as part of the
          dial — a thumb travelling back from a tile lands near them, and a pill
          inside the puck's visual envelope invites a mis-tap on the one control
          that throws away an in-progress selection. Pushed clear so the puck
          owns its own space. The panel's floor was cut by more than this costs
          (see .safe-bottom), so the wheel still nets larger. */}
      <div className="mt-4 flex items-center justify-center gap-2 md:mt-5 md:gap-3 short:mt-2">
        <ControlButton
          onClick={() => {
            touchIdle();
            setLetters((prev) => shuffle(prev));
            setSel([]);
          }}
        >
          Shuffle
        </ControlButton>
        <ControlButton onClick={() => setShowWords(true)} data-bonus-target>
          {bonusFound.length} bonus
        </ControlButton>
      </div>

      {/* mb-1 keeps this clear of the board card's bottom border — it is the
          last child inside the card, and at md the card's own py-4 was the only
          thing between the text and the stroke, which read as a collision. */}
      <p className="mt-1.5 mb-1 hidden text-center text-meta text-text-muted mouse:block short:mouse:hidden">
        <kbd className="font-sans text-text-secondary">Enter</kbd> to submit ·{' '}
        <kbd className="font-sans text-text-secondary">Space</kbd> to shuffle ·{' '}
        <kbd className="font-sans text-text-secondary">Backspace</kbd> to undo
      </p>

      {/* On phone the rail has no room, so this line is the way in. From
          tablet up the rail is on screen and the line is just a readout. */}
      <button
        type="button"
        onClick={() => setShowWords(true)}
        aria-haspopup="dialog"
        className="inline-flex min-h-11 flex-wrap items-center justify-center gap-x-1 rounded-full px-3 text-center text-meta text-text-muted transition-colors hover:text-text-secondary md:min-h-0 md:pointer-events-none md:hover:text-text-muted"
      >
        {tokens > 0 ? (
          // Says what the row actually DOES now. Tapping used to reveal a
          // letter outright; it now opens a priced chooser, and leaving the
          // old wording in place meant the app told you to expect a letter and
          // then handed you a menu — which reads as the tap not working.
          <>Tap a row to choose a hint · {tokens} left</>
        ) : (
          <>
            {bonusToNextToken(progress.bonusTotal)} more bonus{' '}
            {bonusToNextToken(progress.bonusTotal) === 1 ? 'word' : 'words'} earns a hint
          </>
        )}
        <ChevronIcon className="ml-1 inline-block align-[-0.2em] md:hidden" />
      </button>
        </div>

        {/* Evidence rail — below the board on tablet, beside it on desktop. */}
        {/*
          STRETCHES to the row, where it used to sit at its natural height.
          `self-start` meant the aside was content-sized, so the rail ended
          107px above the board's bottom edge on a 1440x900 — measured — and
          any h-full inside it resolved against that short box rather than the
          row. `max-h-full` plus the scroll behaviour below still handle the
          opposite case, where the cards are taller than the viewport.
        */}
        <aside
          aria-label="Your progress"
          /*
           * `rail-scroll` fades the bottom edge when there is more below.
           *
           * The rail was silently CLIPPED on the two commonest laptop
           * heights — 133px at 1280x720, 85px at 1366x768 — and the part cut
           * off is the Streak card at the end. It scrolled, but nothing said
           * so: a flat cut at the container edge reads as the end of the
           * content, so a player on a 720p screen simply never learned the
           * streak existed. The short: compaction above recovers most of it;
           * the fade covers whatever is left at any height.
           *
           * The fade is now GATED on there actually being something below,
           * via `data-fade` — see the effect that sets it. It used to be
           * unconditional, on the reasoning that "the bottom 28px is empty
           * space, so there is nothing there to fade". Measured 2026-08-19,
           * that was false at seven of eight windows: the rail does not
           * overflow at any of them, and the Streak card ends FLUSH with the
           * rail's bottom edge, so all 28px of the fade landed on the card.
           * The last thing in the rail was permanently half-erased by a
           * gradient whose whole job was to say "there is more below" on the
           * one layout where there was not.
           */
          className="hidden md:flex md:max-h-full md:flex-col md:self-stretch lg:sticky lg:top-6"
        >
          {rail}
        </aside>
      </div>

      {showWords && (
        <Sheet onClose={() => setShowWords(false)} label="Your progress">
          <Rail
            gridWords={puzzle.grid}
            found={found}
            bonusFound={bonusFound}
            rank={rank}
            score={score}
            rowsFilled={rowsDone}
            totalRows={puzzle.grid.length}
            days={days}
            record={record}
            boardFound={boardProgress(found, puzzle.grid, puzzle.bonus).found}
            boardTotal={boardProgress(found, puzzle.grid, puzzle.bonus).total}
            boardComplete={rowsDone === puzzle.grid.length}
            onChallenge={challenge}
            streakJustEarned={streakJustEarned}
            streak={progress.streak}
            bestStreak={progress.bestStreak}
          freezes={progress.freezes}
          vacationSince={progress.vacationSince}
          onVacation={(on) =>
            update((cur) => (on ? startVacation(cur, new Date()) : endVacation(cur)))
          }
            hasDefinition={hasDefinition}
            onShowDefinition={openDefinition}
            howToClassName=""
          />
        </Sheet>
      )}

      {/*
        The first run used to be a MODAL, and the player board changed it.

        Their reasoning, in the order it convinced: a dismiss-on-tap-anywhere
        dialog in front of a screen-reader player is a focus trap with no
        labelled close — that was the strongest argument on the table, ahead of
        any comparison to Wordle. Then, of its four sentences, exactly ONE was
        load-bearing: the count and where the letters come from, which is the
        only claim the board cannot make on its own. Row chips already carry
        their length, the chips already say "tap for the next clue", and the
        rank chip already says "fill the six rows".

        The hint rule was cut deliberately, not lost: nobody plans around a
        three-word faucet before they have found three words, and a token
        arriving unannounced reads as a gift rather than a rule.

        So it is one line, it does not block, and it dismisses itself by being
        obeyed rather than acknowledged. Grandmother's standing BLOCK on "no
        paid tier before an in-app first-run teach" is satisfied by a
        persistent strip; a cold board with no goal statement would trip it.
      */}


      {(showDef !== null || defUpgrading) && (
        <Sheet
          onClose={() => {
            setShowDef(null);
            setDefUpgrading(false);
          }}
          label={showDef ? `Definition of ${showDef.word}` : 'Definition'}
        >
          <div className="relative rounded-2xl border border-edge-mid liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] p-4">
            <h2 className="text-title font-bold uppercase tracking-[0.06em] text-text-primary">
              {showDef?.word ?? ''}
            </h2>

            {showDef?.partOfSpeech && (
              <p className="mt-1 text-meta italic text-text-muted">
                {showDef.partOfSpeech}
              </p>
            )}
            {showDef?.lemma && (
              <p className="mt-1 text-meta text-text-muted">
                from <span className="text-text-secondary">{showDef.lemma}</span>
              </p>
            )}

            {/*
              On a themed board the AUTHORED line comes first, because that is
              what the word means HERE. A player who taps `cane` on a 90s R&B
              board and gets "a stick that people can lean on to help them walk"
              has been handed a fact about English, not about the thing they
              just solved — and the authored line is the entire reason the
              themed catalogue is worth anything. The dictionary sense stays
              underneath, demoted, for the players who wanted the word itself.
            */}
            {themedClue && (
              <div className="mt-3 rounded-2xl border border-edge-mid liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] p-3.5">
                {puzzle.theme && (
                  <p className="text-kicker uppercase tracking-[0.16em] text-text-muted">
                    In {puzzle.theme.name}
                  </p>
                )}
                <p className="mt-1 text-body leading-relaxed text-text-primary">
                  {themedClue}
                </p>
              </div>
            )}

            <p
              className={[
                'text-body leading-relaxed text-text-secondary',
                themedClue ? 'mt-3 text-meta' : 'mt-3',
              ].join(' ')}
            >
              {showDef?.definition
                ? showDef.definition
                : defUpgrading
                  ? 'Looking it up…'
                  : 'No definition found for this one.'}
            </p>

            {/* Say where it came from. A Victorian reading of a modern word is
                a fact about the source, not a bug to hide. */}
            {showDef?.definition && (
              <p className="mt-3 text-meta text-text-muted">
                {showDef.source === 'modern' ? 'Modern dictionary' : 'WordNet'}
                {defUpgrading && showDef.source === 'bundled'
                  ? ' · checking for a newer one…'
                  : ''}
              </p>
            )}
          </div>
        </Sheet>
      )}

      {assistOpen &&
        (() => {
          const plan = assistFor(unsolvedRows, tokens, COST_LETTER, COST_WORD);
          if (!plan) return null;
          return (
            <Sheet onClose={() => setAssistOpen(false)} label="Need a hand?">
              <div className="relative rounded-2xl border border-edge-mid liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] p-5">
                <p className="text-meta uppercase tracking-[0.16em] text-text-muted">
                  Stuck?
                </p>
                <h2 className="mt-1.5 text-title font-bold leading-tight text-text-primary">
                  {plan.kind === 'open-word'
                    ? `I'll open the ${plan.word.length}-letter one`
                    : `I'll start the ${plan.word.length}-letter one`}
                </h2>
                {/* Say the cost before acting, never after. */}
                <p className="mt-2 text-body leading-relaxed text-text-secondary">
                  {plan.cost === 0
                    ? 'You&rsquo;re out of hints, so this one&rsquo;s free.'
                    : `Costs ${plan.cost} ${plan.cost === 1 ? 'hint' : 'hints'}. You have ${tokens}.`}
                </p>

                <button
                  type="button"
                  onClick={acceptAssist}
                  className="liquid-interactive relative mt-5 h-12 w-full rounded-full border-2 border-edge bg-steel-dark/80 bg-gradient-to-b from-steel/80 to-steel-dark/80 text-body font-semibold text-text-primary backdrop-blur-[var(--glass-blur)]"
                >
                  Do it for me
                </button>
                <button
                  type="button"
                  onClick={() => setAssistOpen(false)}
                  className="mt-2 h-11 w-full rounded-full text-body text-text-muted"
                >
                  I&rsquo;ve got it
                </button>
              </div>
            </Sheet>
          );
        })()}

      {showPuzzles && (
        <Sheet
          onClose={() => {
            setShowPuzzles(false);
            setOpenShelf(null);
          }}
          label="Puzzles"
        >
          <div className="relative rounded-2xl border border-edge-mid liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] p-4">
            <h2 className="mb-1 text-item font-semibold text-text-primary">
              Puzzles
            </h2>
            {/* Nothing is ever lost by leaving: progress is stored per puzzle,
                so anything you walk away from is exactly where you left it. */}
            <p className="mb-3 text-meta leading-snug text-text-muted">
              Leave whenever. Every puzzle keeps its own progress, so you can
              come back to this one exactly where you stopped.
            </p>

            <div className="flex flex-col gap-2">
              <PuzzleAction
                label="Today's puzzle"
                detail={
                  progress.streak > 0
                    ? `${progress.streak} day streak`
                    : 'Counts toward your streak'
                }
                current={isDaily}
                onClick={() => {
                  goToPuzzle(0);
                  setShowPuzzles(false);
                }}
              />
              <PuzzleAction
                label="Next puzzle"
                detail="Practice — doesn't affect the streak"
                onClick={() => {
                  goToPuzzle(offset + 1);
                  setShowPuzzles(false);
                }}
              />
              {offset !== 0 && (
                <PuzzleAction
                  label="Previous puzzle"
                  detail="Back one"
                  onClick={() => {
                    goToPuzzle(offset - 1);
                    setShowPuzzles(false);
                  }}
                />
              )}
            </div>

            <p className="mt-4 text-meta leading-snug text-text-muted">
              {progress.clearedIds.length} cleared ·{' '}
              {Object.keys(progress.words).length} started
            </p>
          </div>

          {/* Themes were unreachable: ten of them existed and the only way to
              land on one was luck. A set you can't navigate to is a set that
              doesn't exist. */}
          {shelves.length > 0 && (
            <div className="relative mt-4 rounded-2xl border border-edge liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] p-4">
              <h2 className="mb-1 text-item font-semibold text-text-primary">
                {openShelf ? shelves.find((s) => s.id === openShelf)?.name : 'Themes'}
              </h2>

              {/*
                Four places, not fifteen tiles.
                The combined board ruled browsable GROUPS over labels on a flat
                list, because a labelled flat list still puts every theme on one
                screen — which is the density complaint itself. Grandmother's
                test was four things she can each picture as a place, and she
                holds a block on a thirteenth theme shipping before this exists.
              */}
              {openShelf === null ? (
                <div className="mt-3 flex flex-col gap-2">
                  {shelves.map((s) => {
                    const boards = s.themes.reduce((n, t) => n + t.indices.length, 0);
                    const done = s.themes.reduce(
                      (n, t) =>
                        n +
                        t.indices.filter((i) =>
                          progress.clearedIds.includes(String(data.puzzles[i].id))
                        ).length,
                      0
                    );
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setOpenShelf(s.id)}
                        className="liquid-interactive relative flex w-full items-center justify-between gap-3 rounded-xl border border-edge-mid liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] px-4 py-3 text-left"
                      >
                        <span>
                          <span className="block text-body font-medium text-text-primary">
                            {s.name}
                          </span>
                          <span className="block text-meta leading-snug text-text-muted">
                            {s.blurb}
                          </span>
                        </span>
                        <span className="shrink-0 text-meta tabular-nums text-text-muted">
                          {done}/{boards}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenShelf(null)}
                    className="self-start text-meta text-text-secondary underline underline-offset-4"
                  >
                    ← All themes
                  </button>
                  {(shelves.find((s) => s.id === openShelf)?.themes ?? []).map((t) => {
                  const done = t.indices.filter((i) =>
                    progress.clearedIds.includes(String(data.puzzles[i].id))
                  ).length;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        // Land on the first one not yet cleared.
                        const next =
                          t.indices.find(
                            (i) =>
                              !progress.clearedIds.includes(
                                String(data.puzzles[i].id)
                              )
                          ) ?? t.indices[0];
                        goToPuzzle(offsetForIndex(data, today, next));
                        setShowPuzzles(false);
                      }}
                      className="liquid-interactive relative flex w-full items-center justify-between gap-3 rounded-xl border border-edge-mid liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] px-4 py-3 text-left"
                    >
                      <span>
                        <span className="block text-body font-medium text-text-primary">
                          {t.name}
                        </span>
                        <span className="block text-meta leading-snug text-text-muted">
                          {t.blurb}
                        </span>
                      </span>
                      <span className="shrink-0 text-meta tabular-nums text-text-muted">
                        {done}/{t.indices.length}
                      </span>
                    </button>
                  );
                })}
                </div>
              )}
            </div>
          )}
        </Sheet>
      )}

      {showRules && (
        <Sheet onClose={() => setShowRules(false)} label="How to play">
          <div className="relative rounded-2xl border border-edge-mid liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] p-4">
            <h2 className="mb-3 text-item font-semibold text-text-primary">
              How to play
            </h2>
            <ul className="flex flex-col gap-2.5 text-body leading-relaxed text-text-secondary">
              <li>Drag across the wheel to spell a word — or just type it.</li>
              <li>Fill every row in the grid to finish the puzzle.</li>
              <li>
                The top row uses all six letters. That one&apos;s the prize.
              </li>
              <li>
                Extra words still score, and every 3 of them earns you a hint.
              </li>
              <li>New letters every day.</li>
            </ul>
          </div>

          <div className="mt-4 rounded-2xl border border-edge liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] p-4">
            <h2 className="mb-1 text-item font-semibold text-text-primary">
              Ways to play
            </h2>
            {/* Both are ON now. The line said "off by default" long after that
                stopped being true, which taught a player the opposite of what
                the screen was doing. */}
            <p className="mb-3 text-meta text-text-muted">
              Both are on. Turn one off and the puzzle changes shape.
            </p>
            <ModeRow
              label="Clue mode"
              detail="Rows come with a definition. Build the word that means this."
              on={progress.clueMode}
              onToggle={(v) => setMode('clueMode', v)}
            />
            <ModeRow
              label="Escalating wheel"
              detail="Start with fewer letters. Each row you clear unlocks another."
              on={progress.escalating}
              onToggle={(v) => setMode('escalating', v)}
            />
          </div>

          {/*
            Reading and text size.

            The accessibility wing found NO text-size, dyslexia-facing or
            colour-vision setting in the preference shape at all, and rated a
            display config ABOVE the streak in what has to survive a device
            change: a board that arrives unreadable on a new phone is not a
            degraded experience, it is an unusable one. Both settings ride in
            the backup code for exactly that reason.
          */}
          <div className="mt-4 rounded-2xl border border-edge-mid liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] p-5">
            <h2 className="text-title font-bold leading-tight text-text-primary">Reading</h2>
            <p className="mt-1.5 mb-3 text-meta leading-relaxed text-text-muted">
              These travel with your backup link, so a new phone arrives set up
              the way you left it.
            </p>

            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-meta font-medium text-text-primary">Text size</p>
                <p className="mt-0.5 text-kicker leading-snug text-text-muted">
                  Scales every label and clue. The dial keeps its own size so it
                  still fits a small phone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => applyTextScale(nextTextScale(textScale))}
                aria-label={`Text size: ${TEXT_LABEL[textScale]}. Tap to change.`}
                className="liquid-interactive h-10 shrink-0 rounded-full border-2 border-edge liquid backdrop-blur-[var(--glass-blur)] px-4 text-meta font-medium text-text-primary"
              >
                {TEXT_LABEL[textScale]}
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 border-t border-edge-mid pt-4">
              <div className="min-w-0">
                <p className="text-meta font-medium text-text-primary">Accent</p>
                {/*
                  Studio SETS the accent, so this control cannot also claim it.
                  It read "Signal green" while the board was painting orange —
                  a control describing a state that is not on screen, which is
                  the one thing a settings row must never do. It says who is in
                  charge instead, and the button stops offering a choice that
                  the theme would immediately overrule.
                */}
                <p className="mt-0.5 text-kicker leading-snug text-text-muted">
                  {theme === 'studio'
                    ? 'Set by the Studio theme. Switch theme to choose your own.'
                    : 'The colour that marks a found row. Both options are matched to the same measured contrast, so this is taste, not legibility.'}
                </p>
              </div>
              <button
                type="button"
                disabled={theme === 'studio'}
                onClick={() =>
                  setAccent(
                    (accent === 'default' ? 'matte' : 'default') as Accent
                  )
                }
                aria-label={
                  theme === 'studio'
                    ? 'Accent: Signal orange, set by the Studio theme.'
                    : `Accent: ${ACCENT_LABELS[accent]}. Tap to change.`
                }
                className="liquid-interactive h-10 shrink-0 rounded-full border-2 border-edge liquid backdrop-blur-[var(--glass-blur)] px-4 text-meta font-medium text-text-primary disabled:opacity-60"
              >
                {theme === 'studio' ? 'Signal orange' : ACCENT_LABELS[accent]}
              </button>
            </div>

            <div className="mt-4 border-t border-edge-mid pt-4">
              <ModeRow
                label="Relaxed spacing"
                detail="Opens up letter, word and line spacing, and stops italics being italic."
                on={reading === 'relaxed'}
                onToggle={(v) => applyReading(v ? 'relaxed' : 'default')}
              />
            </div>
          </div>

          {/*
            Backup lives here because this sheet is the only place a player
            already goes to change how the game works.

            Progress is one localStorage key: streak, history, hint balance,
            every board cleared. A cleared cache or a new phone erases all of
            it silently, and the player board named that its most common
            blocker — the seats most willing to PAY were the ones who refused
            to commit to a streak they could lose without warning. This is not
            an account and does not pretend to be one; it is a code that
            survives the browser.
          */}
          <div className="mt-4 rounded-2xl border border-edge-mid liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] p-5">
            <h2 className="text-title font-bold leading-tight text-text-primary">
              Back up your progress
            </h2>
            <p className="mt-1.5 mb-3 text-meta leading-relaxed text-text-muted">
              There are no accounts. Your streak, your settings and everything
              you have cleared live in this browser. Send yourself the link and
              open it on the other phone — that is the whole transfer.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      backupLink(progress, data, window.location.origin, { text: textScale, reading })
                    );
                    markBackedUp(new Date());
                    say('Link copied — send it to yourself', 'good');
                  } catch {
                    say('Could not copy — check clipboard permission', 'bad');
                  }
                }}
                className="liquid-interactive h-10 rounded-full border-2 border-edge liquid backdrop-blur-[var(--glass-blur)] px-4 text-meta font-medium text-text-primary"
              >
                Copy my link
              </button>
              {/* The one-time-unlock seats want an artifact they hold, not a URL
                  living in a message thread. Same code, different vessel. */}
              <button
                type="button"
                onClick={() => {
                  try {
                    const blob = new Blob([encodeProgress(progress, data, { text: textScale, reading })], {
                      type: 'text/plain',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'wordy-backup.txt';
                    a.click();
                    URL.revokeObjectURL(url);
                    markBackedUp(new Date());
                    say('Backup file saved', 'good');
                  } catch {
                    say('Could not save the file', 'bad');
                  }
                }}
                className="liquid-interactive h-10 rounded-full border-2 border-edge-mid liquid backdrop-blur-[var(--glass-blur)] px-4 text-meta font-medium text-text-secondary"
              >
                Save a file
              </button>
              <button
                type="button"
                onClick={async () => {
                  let code = '';
                  try {
                    code = await navigator.clipboard.readText();
                  } catch {
                    say('Paste blocked — allow clipboard access', 'bad');
                    return;
                  }
                  restoreFrom(code);
                }}
                className="liquid-interactive h-10 rounded-full border-2 border-edge-mid liquid backdrop-blur-[var(--glass-blur)] px-4 text-meta font-medium text-text-secondary"
              >
                Restore from clipboard
              </button>
            </div>
            {/* Said before the button is pressed, not after. Restoring replaces
                what is here; merging two histories has no right answer. */}
            <p className="mt-2.5 text-kicker leading-snug text-text-muted">
              Restoring replaces the progress in this browser.
              {progress.lastBackup ? ` Last backup ${sinceBackup(progress.lastBackup)}.` : ''}
            </p>

            {/*
              Optional sync.

              The board split hard on accounts: every paying seat would take a
              login, and six seats refuse one outright — one because a signup
              screen is a delete, another because a mandatory account is an
              accessibility barrier. They voted for OPTIONAL, NO WALL, and this
              is that: the game is complete without ever opening this.

              It also beats the leader rather than matching it. There is no
              email and no reset, because the passphrase never leaves the device
              — it derives an opaque id, which is all the server learns, and a
              key, which it never sees. The server holds a box it cannot open.
            */}
            {syncOn && (
              <div className="mt-4 border-t border-edge-mid pt-4">
                <h3 className="text-meta font-semibold text-text-primary">
                  Sync across devices — optional
                </h3>
                <p className="mt-1 text-kicker leading-snug text-text-muted">
                  No email, no account. Pick a phrase and your progress is locked
                  with it before it leaves this device — we store a box we cannot
                  open. <strong className="text-text-secondary">Forget the phrase and it is gone for good;
                  there is no reset.</strong>
                </p>
                <input
                  type="password"
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                  placeholder="A phrase of a few words"
                  aria-label="Sync phrase"
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-2.5 h-11 w-full rounded-xl border border-edge-mid bg-transparent px-3 text-meta text-text-primary placeholder:text-text-muted"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={syncBusy}
                    onClick={() => doSync('push')}
                    className="liquid-interactive h-10 flex-1 rounded-full border-2 border-edge liquid backdrop-blur-[var(--glass-blur)] px-4 text-meta font-medium text-text-primary disabled:opacity-50"
                  >
                    {syncBusy ? 'Working…' : 'Save to sync'}
                  </button>
                  <button
                    type="button"
                    disabled={syncBusy}
                    onClick={() => doSync('pull')}
                    className="liquid-interactive h-10 flex-1 rounded-full border-2 border-edge-mid liquid backdrop-blur-[var(--glass-blur)] px-4 text-meta font-medium text-text-secondary disabled:opacity-50"
                  >
                    {syncBusy ? 'Working…' : 'Load from sync'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Sheet>
      )}

      {showComplete && (
        <CompleteSheet
          rank={rank.name}
          score={score}
          bonus={bonusFound.length}
          streak={progress.streak}
          preview={shareCard()}
          copied={copied}
          isDaily={isDaily}
          warmup={warmup}
          warmupTotal={data.starters.length}
          onShare={share}
          // Inside the ladder, staying at offset 0 loads the NEXT warm-up,
          // because warmupsDone has already advanced. Incrementing the offset
          // would jump out of the ladder entirely.
          onNext={() => {
            // Advance the ladder here, once the summary has been seen.
            if (warmup !== null) advanceWarmup();
            goToPuzzle(warmup !== null ? 0 : offset + 1);
          }}
          onClose={() => {
            if (warmup !== null) advanceWarmup();
            setShowComplete(false);
          }}
          offerBackup={shouldOfferBackup(progress, today)}
          onBackup={async () => {
            try {
              await navigator.clipboard.writeText(
                backupLink(progress, data, window.location.origin, { text: textScale, reading })
              );
              markBackedUp(new Date());
              markBackupOffered();
              say('Link copied — send it to yourself', 'good');
            } catch {
              say('Could not copy — check clipboard permission', 'bad');
            }
          }}
          /* "Not now" is final for this streak, or the offer becomes the nag
             four seats rejected. It can only return after 30 days. */
          onDismissBackup={() => markBackupOffered()}
          beatTarget={beatTarget}
          chain={chain}
          onReply={replyToChallenge}
          onChallenge={challenge}
          onShareTheme={shareTheme}
          themeName={puzzle.theme?.name ?? null}
          /*
           * Counted here rather than in `playerRecord`, because that answers
           * "how far through the catalogue am I" and this answers "how far
           * through THIS pack" — a different question that only exists while
           * a specific board is on screen.
           */
          packDone={
            puzzle.theme
              ? data.puzzles.filter(
                  (q) =>
                    q.theme?.id === puzzle.theme?.id &&
                    progress.clearedIds.includes(String(q.id))
                ).length
              : 0
          }
          packTotal={
            puzzle.theme
              ? data.puzzles.filter((q) => q.theme?.id === puzzle.theme?.id).length
              : 0
          }
        />
      )}
    </main>
  );
}

/** Bottom sheet — the phone's way into rail content the rail has no room for. */
function Sheet({
  label,
  children,
  onClose,
}: {
  label: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useDialog(onClose);
  const mounted = useMounted();
  if (!mounted) return null;
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-end justify-center outline-none md:items-center"
      style={{ background: 'var(--scrim)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        // max-w/mx-auto: the sheet had neither, so at 1728px "Today's puzzle"
        // was a 1900px-wide tap target with its chevron marooned ~1600px from
        // its own label. Centred from md up rather than pinned to the bottom
        // of a tall desktop viewport.
        className="anim-rise safe-bottom mx-auto max-h-[82dvh] w-full max-w-[560px] overflow-y-auto relative rounded-t-3xl border-t-2 border-edge liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] px-5 pt-4 md:rounded-3xl md:border-2"
      >
        {/* Grab handle — signals "drag or tap away", costs one element. */}
        <div
          aria-hidden
          className="mx-auto mb-4 h-1 w-10 rounded-full bg-edge/40"
        />
        {children}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 h-11 w-full rounded-full border-2 border-edge-mid text-body text-text-secondary"
        >
          Close
        </button>
      </div>
    </div>,
    document.body
  );
}


/** One route out of the current puzzle. */
function PuzzleAction({
  label,
  detail,
  current,
  onClick,
}: {
  label: string;
  detail: string;
  current?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="liquid-interactive relative flex w-full items-center justify-between gap-3 rounded-xl border border-edge-mid liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] px-4 py-3 text-left"
    >
      <span>
        <span className="block text-body font-medium text-text-primary">
          {label}
        </span>
        <span className="block text-meta leading-snug text-text-muted">
          {detail}
        </span>
      </span>
      {current ? (
        <span className="text-meta font-semibold text-text-primary">here</span>
      ) : (
        <span className="text-text-muted">
          <ChevronIcon />
        </span>
      )}
    </button>
  );
}

function ModeRow({
  label,
  detail,
  on,
  onToggle,
}: {
  label: string;
  detail: string;
  on: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onToggle(!on)}
      className="flex w-full items-start gap-3 rounded-xl px-1 py-2 text-left transition-colors hover:bg-carbon-surface-2/60"
    >
      <span
        aria-hidden
        className={[
          'mt-0.5 grid h-6 w-10 shrink-0 items-center rounded-full border-2 px-0.5 transition-colors',
          // `backdrop-blur-sm` is a fixed 8px and ignored the theme, so the
          // one switch stayed a lens on a matte board. Reads the token now.
          on
            ? 'border-steel bg-steel-dark/80 backdrop-blur-[var(--glass-blur)]'
            : `border-edge ${'liquid'}`,
        ].join(' ')}
      >
        <span
          className={[
            'h-4 w-4 rounded-full bg-text-primary transition-transform',
            on ? 'translate-x-4' : 'translate-x-0',
          ].join(' ')}
        />
      </span>
      <span>
        <span className="block text-body font-medium text-text-primary">
          {label}
        </span>
        <span className="block text-meta leading-snug text-text-muted">
          {detail}
        </span>
      </span>
    </button>
  );
}

/**
 * 'auto' shows what it's currently following, with a dot to say it's tracking
 * the system rather than pinned. The dot is a status marker, not part of the
 * icon, so it lives outside the SVG and never bends the icon convention.
 */
function ThemeIcon({ theme, scheme }: { theme: Theme; scheme: 'light' | 'dark' }) {
  /*
   * `scheme` is passed in rather than read here, because under 'auto' the
   * answer is the visitor's OS and the server has no OS. Reading it during
   * render drew a sun over a prerendered moon on every light-mode machine and
   * cost the page its whole tree. See systemScheme.
   */
  const showing = theme === 'auto' ? scheme : effectiveTheme(theme);
  return (
    <span className="relative grid place-items-center">
      {showing === 'light' ? <SunIcon /> : <MoonIcon />}
      {/*
        Studio and dark are both dark, so both draw the moon — and without a
        mark the control cannot say which of the two is on. The dot is the
        ACCENT COLOUR because the accent is the entire difference between them:
        the swatch answers the question rather than encoding it.

        The auto dot stays steel and means something else (following the OS),
        which is why these are different colours and not one shared dot.
      */}
      {(theme === 'auto' || theme === 'studio') && (
        <span
          aria-hidden
          className={[
            'absolute -bottom-1.5 h-1 w-1 rounded-full',
            theme === 'studio' ? 'bg-success' : 'bg-steel-muted',
          ].join(' ')}
        />
      )}
    </span>
  );
}

function ControlButton({
  children,
  onClick,
  disabled,
  ...rest
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
} & React.ComponentPropsWithoutRef<'button'>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...rest}
      /*
       * Deliberately small on a phone so the DIAL can be bigger.
       *
       * The dial is height-constrained on mobile — it takes whatever the column
       * leaves over — so every pixel these give up goes straight to the thing
       * you actually play with. 24px IS the floor — WCAG 2.5.8 requires a
       * 24x24 target and this is exactly that, so there is no room left
       * underneath and the next person to shave a pixel here breaks a
       * conformance criterion rather than a preference.
       *
       * It gives up the 44px platform guidance deliberately: these are
       * secondary controls a player touches a handful of times per board
       * against hundreds of touches on the dial, and Shuffle in particular is
       * what you reach for when stuck, not something you aim at under time
       * pressure. Width stays generous (58px) so the TARGET is comfortable
       * even though the height is minimal.
       */
      className="liquid-interactive relative h-6 min-w-[58px] rounded-full border-2 border-edge liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] px-2.5 text-kicker font-medium text-text-secondary md:h-8 md:min-w-[80px] md:px-3 md:text-meta transition-colors hover:border-text-primary hover:text-text-primary disabled:opacity-35 disabled:hover:border-carbon-border disabled:hover:text-text-secondary"
    >
      {children}
    </button>
  );
}

/**
 * Where a rank's mark lives.
 *
 * Lower-cased name, matched to the file the generator writes. Falls back to
 * Novice rather than rendering a broken image if a rank name ever changes
 * without the marks being rebuilt — a missing mark should look like the
 * bottom of the ladder, not like a fault.
 */
function rankMarkSrc(rank: string): string {
  const i = RANK_NAMES.indexOf(rank as (typeof RANK_NAMES)[number]);
  const at = i >= 0 ? i : 0;
  return withBase(`/brand/ranks/rank-${at}-${RANK_NAMES[at].toLowerCase()}.svg`);
}

function CompleteSheet({
  rank,
  score,
  bonus,
  streak,
  preview,
  copied,
  isDaily,
  warmup,
  warmupTotal,
  onShare,
  onNext,
  onClose,
  offerBackup,
  onBackup,
  onDismissBackup,
  beatTarget,
  chain,
  onReply,
  onChallenge,
  onShareTheme,
  themeName,
  packDone,
  packTotal,
}: {
  rank: string;
  score: number;
  bonus: number;
  streak: number;
  preview: string;
  copied: boolean;
  isDaily: boolean;
  warmup: number | null;
  warmupTotal: number;
  onShare: () => void;
  onNext: () => void;
  onClose: () => void;
  offerBackup: boolean;
  onBackup: () => void;
  onDismissBackup: () => void;
  beatTarget: number | null;
  /** Every score played on this board before yours — the ladder. */
  chain: number[] | null;
  onReply: () => void;
  onChallenge: () => void;
  onShareTheme: () => void;
  themeName: string | null;
  /** Boards cleared in this board's pack, and how many it has. */
  packDone: number;
  packTotal: number;
}) {
  /*
   * This is the only sheet in the app that was not a dialog.
   *
   * Every other one runs through `useDialog`, which gives it Escape, a focus
   * trap and `inert` on the rest of the page. This one was a bare div, so
   * Escape did nothing and the scrim was not clickable — and because the
   * warm-up counter only advances when the sheet is DISMISSED, a player who
   * reached for either of those was left on "Warm-up 1 of 4" forever with no
   * idea why. That is what "the puzzle counter is not working" turned out to
   * be: the counter was fine, the way out of the sheet was not.
   */
  const ref = useDialog(onClose);
  const stats = completionStats({ score, bonus, streak, warmup, warmupTotal });
  /*
   * Portalled, for the same reason every other sheet is.
   *
   * Rendered inline it was a DESCENDANT of <main>, and `useDialog` skips any
   * element that contains the dialog — an element cannot make its own ancestor
   * inert. So the whole board behind the summary stayed in the screen-reader's
   * reading order and in the Tab order: the trap kept Tab inside, but a
   * virtual cursor walked straight through six solved rows and a wheel that no
   * longer did anything. Only the last sheet in the game had this.
   */
  const mounted = useMounted();
  if (!mounted) return null;
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Puzzle cleared"
      tabIndex={-1}
      onClick={(e) => {
        // Scrim only — a click inside the card must not dismiss it.
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 grid place-items-end outline-none sm:place-items-center"
      style={{ background: 'var(--scrim)' }}
    >
      <div className="anim-rise safe-bottom w-full max-w-[420px] relative rounded-t-3xl border-t-2 border-edge liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] px-6 pt-7 sm:rounded-3xl sm:border">
        <p className="text-kicker uppercase tracking-[0.18em] text-text-secondary">
          {warmup !== null
            ? `Warm-up ${warmup} cleared`
            : isDaily
              ? "Today's puzzle cleared"
              : 'Puzzle cleared'}
        </p>
        {/*
          The rank you EARNED, drawn, beside its name.

          Apple News gives a solved puzzle a ribbon and a full screen; ours
          closed over the board with a number. The mark is not decoration
          here — it is the dial with as many positions lit as rows you filled,
          so it states the result in the game's own terms and a player can see
          at a glance how much of the wheel they spent. Served from
          public/brand/ranks, written by the same generator as the kit's copy,
          so the mark you earn and the mark in the brand kit cannot drift.

          `aria-hidden` because the name beside it already says it, and a
          screen reader hearing "rank 5 of 6" and then "Wordsmith" is hearing
          the same fact twice.
        */}
        <div className="mt-1 flex items-center gap-3">
          <img
            aria-hidden
            src={rankMarkSrc(rank)}
            alt=""
            width={56}
            height={56}
            className="shrink-0"
          />
          <h2 className="text-hero font-bold text-text-primary">{rank}</h2>
        </div>

        {/*
          Where this board sits in its pack.

          The sheet said what you scored and how many warm-ups were left, and
          nothing about the thing a player is actually working through. 118
          themed packs are the half of this product with pricing power, and
          finishing a board inside one is the moment that fact is most worth
          stating — "4 of 6 in The Pit" is a reason to open the next one, where
          a bare score is not.

          Only when the pack has more than one board, because "1 of 1" is not
          progress, it is a sentence about nothing.
        */}
        {themeName && packTotal > 1 && (
          <p className="mt-2 text-meta text-text-secondary">
            {packDone} of {packTotal} in {themeName}
            {packDone === packTotal ? ' — pack complete' : ''}
          </p>
        )}

        {/*
          Only the stats that can mean something yet — see `completionStats`.
          The column count is spelled out rather than interpolated because
          Tailwind reads these class names statically; `grid-cols-${n}` would
          compile to nothing and collapse the tiles into one column.
        */}
        <dl
          className={[
            'mt-5 grid gap-3 text-center',
            stats.length === 1
              ? 'grid-cols-1'
              : stats.length === 2
                ? 'grid-cols-2'
                : 'grid-cols-3',
          ].join(' ')}
        >
          {stats.map((s) => (
            <Stat key={s.label} label={s.label} value={s.value} />
          ))}
        </dl>

        {/*
          The LADDER, revealed at the same moment and above the duel.

          Withheld until now for the same reason the beat target is: seeing
          what four other people scored before you play is being told how hard
          to try. It sits above the head-to-head because a placement is the
          more interesting fact once more than two people have played — "third
          of five" says something "you beat Sam" does not.

          Honour system, and it says so. The numbers travelled in a URL that
          anybody in the thread could have edited, and no client-side scheme
          can fix that — signing needs a secret and there is no server to hold
          one, which is the same constraint that makes the ladder possible at
          all. So it is never called a ranking, and the wording stays casual:
          this is for people who know each other.
        */}
        {chain !== null && chain.length > 0 && (
          <div className="mt-4 rounded-xl border border-edge-mid px-4 py-3 text-center">
            {(() => {
              const { place, of } = placeIn(chain, score);
              const best = Math.max(...chain, score);
              return (
                <>
                  <p className="text-body font-semibold text-text-primary">
                    {place === 1
                      ? `Top of ${of}`
                      : `${place}${place === 2 ? 'nd' : place === 3 ? 'rd' : 'th'} of ${of}`}
                  </p>
                  <p className="mt-0.5 text-meta text-text-muted">
                    {place === 1
                      ? 'Nobody in this thread has beaten it yet.'
                      : `Best so far is ${best}. Send it on and see who else can.`}
                  </p>
                </>
              );
            })()}
          </div>
        )}

        {/*
          The challenge result, revealed only NOW.
          The score travelled in the link and was deliberately withheld until
          this moment: two seats quit against a visible target, so the number
          is a result rather than a hurdle. The reply is pre-filled because
          there is no server to carry a result back — the return trip has to
          go by the same channel the invitation came down.
        */}
        {beatTarget !== null && (
          <div
            className={[
              'mt-4 relative rounded-xl border px-4 py-3 text-center',
              score > beatTarget ? 'border-success' : 'border-edge-mid',
            ].join(' ')}
          >
            <p className="text-body font-semibold text-text-primary">
              {score > beatTarget
                ? `You beat them — ${score} to ${beatTarget}`
                : score === beatTarget
                  ? `Dead tie — ${score} each`
                  : `They got ${beatTarget}. You got ${score}.`}
            </p>
            <button
              type="button"
              onClick={onReply}
              className="liquid-interactive mt-2.5 h-10 w-full rounded-full border-2 border-edge liquid backdrop-blur-[var(--glass-blur)] px-4 text-meta font-medium text-text-primary"
            >
              Send them the result
            </button>
          </div>
        )}

        {/*
          Show exactly what gets sent — and LEFT-ALIGNED, because that is what
          "exactly" means for a block of plain text.

          This was centred, and centring is not a neutral choice for this
          payload. The shape is six rows of different lengths, longest first;
          left-aligned it reads as a staircase, which is the board's own shape
          and the whole reason the card is recognisable. Centred, the same six
          rows read as an arrow or a diamond — a shape the game does not have.
          So the preview was showing a card nobody would ever receive, and the
          comment above it claimed otherwise.
        */}
        <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words relative rounded-xl border border-edge-mid liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] px-4 py-3 text-left text-meta leading-relaxed text-text-secondary">
          {preview}
        </pre>

        {/*
         * The backup offer, at the ONE moment the board named: the end of the
         * session that first reaches a seven-day streak — "the first time the
         * player has something to lose." Never on day one, because two seats
         * delete on early friction, and never mid-board. It appears here, once,
         * attached to the number it is protecting.
         */}
        {offerBackup && (
          <div className="mt-4 relative rounded-xl border border-edge-mid liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] px-4 py-3.5">
            <p className="text-meta font-semibold leading-snug text-text-primary">
              {streak} days. This lives only on this phone.
            </p>
            <p className="mt-1 text-kicker leading-snug text-text-muted">
              Send yourself a link and it survives a new phone or a cleared browser.
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={onBackup}
                className="liquid-interactive h-10 flex-1 rounded-full border-2 border-edge liquid backdrop-blur-[var(--glass-blur)] px-4 text-meta font-medium text-text-primary"
              >
                Copy my link
              </button>
              <button
                type="button"
                onClick={onDismissBackup}
                className="liquid-interactive h-10 rounded-full border-2 border-edge-mid liquid backdrop-blur-[var(--glass-blur)] px-4 text-meta font-medium text-text-secondary"
              >
                Not now
              </button>
            </div>
          </div>
        )}

        {/* Forward motion is the primary action — sharing is what you do
            once, playing on is what brings you back. */}
        <button
          type="button"
          onClick={onNext}
          className="liquid-interactive relative mt-6 h-12 w-full rounded-full border-2 border-edge bg-steel-dark/80 bg-gradient-to-b from-steel/80 to-steel-dark/80 text-body font-semibold text-text-primary backdrop-blur-[var(--glass-blur)]"
        >
          {/* The arrow here is typography inside a phrase, not an icon in a
              slot — it moves with the words and would break the line's rhythm
              as a fixed 18px SVG. Icon-slot marks all go through ./Icon. */}
          {warmup !== null && warmup < warmupTotal
            ? `Warm-up ${warmup + 1} →`
            : warmup !== null
              ? "Play today's puzzle →"
              : 'Next puzzle →'}
        </button>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onShare}
            className="liquid-interactive relative h-11 flex-1 rounded-full border-2 border-edge liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] text-body text-text-secondary"
          >
            {copied ? 'Copied' : 'Share'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-full text-body text-text-muted"
          >
            Keep looking
          </button>
        </div>

        {/*
          Two ways to pass it on, and the pack link is deliberately the wider
          one. Six seats said they want to play a THEME through; two would
          challenge anybody. So the pack is offered to everyone and the
          challenge sits beside it rather than in front of it.

          Neither appears on a warm-up: sending someone a tutorial board is not
          a thing anybody wants to do.
        */}
        {warmup === null && (
          <div className="mt-2 flex gap-2">
            {themeName && (
              <button
                type="button"
                onClick={onShareTheme}
                className="liquid-interactive h-10 flex-1 rounded-full border-2 border-edge-mid liquid backdrop-blur-[var(--glass-blur)] px-3 text-meta font-medium text-text-secondary"
              >
                Send the pack
              </button>
            )}
            <button
              type="button"
              onClick={onChallenge}
              className="liquid-interactive h-10 flex-1 rounded-full border-2 border-edge-mid liquid backdrop-blur-[var(--glass-blur)] px-3 text-meta font-medium text-text-secondary"
            >
              Challenge
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="relative rounded-xl border border-edge-mid liquid liquid-raised backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] py-3">
      <dd className="text-title font-bold tabular-nums text-text-primary">
        {value}
      </dd>
      <dt className="text-meta text-text-muted">{label}</dt>
    </div>
  );
}
