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
import { feedback, setMuted } from '@/lib/feedback';
import {
  applyTheme,
  effectiveTheme,
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
  isFullscreen,
  rememberFullscreenExit,
  subscribeFullscreen,
  toggleFullscreen,
} from '@/lib/fullscreen';
import {
  activeLetters,
  RANK_BASIS,
  RANKS,
  clueTarget,
  isReachable,
  dailyIndex,
  dailyCycle,
  progressKey,
  puzzleForPlayer,
  themeGroups,
  offsetForIndex,
  rankFor,
  scoreWord,
  shareText,
  shuffle,
  submit,
  type Puzzle,
  type PuzzleFile,
} from '@/lib/game';
import {
  addWord,
  configureMigration,
  getServerSnapshot,
  getSnapshot,
  last7,
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


export default function Game({ data }: { data: PuzzleFile }) {
  const today = useMemo(() => new Date(), []);
  const todayIndex = dailyIndex(today, data.puzzles.length);

  /*
   * The daily puzzle is the canonical one — it is what the streak and the
   * share card describe. `offset` lets a player keep going past it without
   * waiting for tomorrow; only offset 0 touches the streak.
   */
  const [offset, setOffset] = useState(0);

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
  const { index, warmup } = puzzleForPlayer(
    data,
    progress.warmupsDone,
    today,
    offset,
    clearedSet
  );
  const puzzle: Puzzle = data.puzzles[index];
  /*
   * Found words are keyed by puzzle AND lap. Without the lap, finishing the
   * catalogue once means every future board arrives pre-solved.
   */
  const cycle = dailyCycle(today, data.puzzles.length);
  const puzzleId = progressKey(puzzle.id, cycle);
  const isDaily = offset === 0 && warmup === null;

  const [letters, setLetters] = useState<string[]>(puzzle.letters);
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
  const lastProgress = useRef(0);
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
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getThemeServerSnapshot
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
  const active = activeLetters(puzzle, rowsDone, progress.escalating);
  const clueWord = progress.clueMode
    ? clueTarget(puzzle.grid, rowDone, clueCursor, (w) =>
        isReachable(w, active)
      )
    : null;

  const bonusFound = [...found].filter((w) => !puzzle.grid.includes(w));
  const score = [...found].reduce((s, w) => s + scoreWord(w, data.wheel), 0);
  const rank = rankFor(score, puzzle.maxScore);

  const current = selected.map((i) => letters[i]).join('');
  /*
   * What a screen reader should hear after an action. Derived, so it cannot
   * drift from what is on screen, and deliberately terse — rank, score, and
   * how much is left, which is the information the sighted player gets from
   * the rank strip for free.
   */
  const announcement = toast
    ? `${toast.text}. ${rank.name}, ${score} points${
        rank.next ? `, ${rank.pointsToNext} to ${rank.next}` : ''
      }.`
    : '';
  const days = useMemo(() => last7(progress, today), [progress, today]);

  const themes = useMemo(() => themeGroups(data), [data]);

  const goToPuzzle = useCallback(
    (nextOffset: number) => {
      setOffset(nextOffset);
      setSel([]);
      setJustSolved(new Set());
      setShowComplete(false);
      setLetters(data.puzzles[(todayIndex + nextOffset) % data.puzzles.length].letters);
    },
    [data.puzzles, todayIndex, setSel]
  );

  const say = useCallback((text: string, tone: Toast['tone']) => {
    toastId.current += 1;
    setToast({ text, tone, id: toastId.current });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1400);
    return () => clearTimeout(t);
  }, [toast]);

  const pick = useCallback(
    (i: number) => {
      // Feedback is computed OUTSIDE the updater: a state updater must be
      // pure, and React can legitimately invoke it twice (StrictMode, or
      // concurrent re-entry), which double-fired the haptic and clicked the
      // hidden iOS switch element twice.
      if (!selRef.current.includes(i)) feedback.tap();
      setSel((prev) => (prev.includes(i) ? prev : [...prev, i]));
    },
    [setSel]
  );

  /** Backspace, for the tap path — tapping the last letter takes it back. */
  const undoLetter = useCallback(() => {
    if (selRef.current.length === 0) return;
    feedback.tap();
    setSel((prev) => prev.slice(0, -1));
  }, [setSel]);

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
        lastProgress.current = Date.now();
        setMissState({ id: puzzleId, n: 0 });
        if (flightMs > 0) setTimeout(land, flightMs * 0.62);
        else land();

        if (result.isBase) {
          // The word that uses every letter is the hardest thing in the puzzle
          // and used to get the same treatment as a three-letter bonus.
          feedback.prize();
          celebratePrize(result.word, result.points);
        } else {
          say(`+${result.points}`, 'good');
        }

        // Promotion is the one recurring reward with no moment attached to it.
        const before = rankFor(
          [...banked].reduce((sum, w) => sum + scoreWord(w, data.wheel), 0),
          puzzle.maxScore
        );
        const after = rankFor(
          [...banked, result.word].reduce(
            (sum, w) => sum + scoreWord(w, data.wheel),
            0
          ),
          puzzle.maxScore
        );
        if (after.index > before.index) {
          setTimeout(() => celebrateRank(after.name, after.next), 620);
        }
        break;
      }
      case 'bonus':
        lastProgress.current = Date.now();
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
        say('Too short', 'neutral');
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
  }, [letters, puzzle, data.wheel, puzzleId, say, setSel, finishIfDone]);

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
          return { word, definition: '', source: 'archaic' };
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
      // Start (or restart) the clock here rather than in render.
      if (clockFor.current !== puzzleId || lastProgress.current === 0) {
        clockFor.current = puzzleId;
        lastProgress.current = Date.now();
        return;
      }
      const stalled = isStalled({
        idleMs: Date.now() - lastProgress.current,
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
    lastProgress.current = Date.now();
    setMissState({ id: puzzleId, n: 0 });
    say(
      plan.cost === 0 ? 'Here — on the house' : `Letter revealed · −${plan.cost}`,
      'neutral'
    );
  }, [unsolvedRows, tokens, reveal, puzzleId, say, finishIfDone]);

  // Keep the audio module in step with the stored preference.
  useEffect(() => {
    setMuted(progress.muted);
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
        setLetters((prev) => shuffle(prev));
        setSel([]);
        return;
      }
      if (!/^[a-zA-Z]$/.test(e.key)) return;
      const ch = e.key.toLowerCase();
      setSel((prev) => {
        const i = letters.findIndex(
          (l, idx) => l === ch && !prev.includes(idx) && active.has(l)
        );
        if (i === -1) return prev;
        feedback.tap();
        return [...prev, i];
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commit, letters, setSel, active]);

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

  const shareCard = () =>
    shareText({
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
      })),
      bonusFound: bonusFound.length,
      streak: progress.streak,
      // Configured per deploy; falls back to wherever the game is actually
      // being played rather than a guessed domain.
      url:
        process.env.NEXT_PUBLIC_SHARE_URL ||
        (typeof window !== 'undefined' ? window.location.origin : undefined),
    });

  const share = async () => {
    const text = shareCard();
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* user dismissed the share sheet — nothing to report */
    }
  };

  const rail = (
    <Rail
      gridWords={puzzle.grid}
      base={puzzle.base}
      found={found}
      bonusFound={bonusFound}
      rank={rank}
      score={score}
      maxScore={puzzle.maxScore}
      days={days}
      streak={progress.streak}
      bestStreak={progress.bestStreak}
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
            Wordy
          </h1>
          <button
            type="button"
            onClick={() => setShowPuzzles(true)}
            aria-haspopup="dialog"
            className="whitespace-nowrap text-meta text-text-muted underline decoration-edge/50 underline-offset-2 transition-colors hover:text-text-secondary max-[379px]:text-meta"
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
            ›
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2 max-[379px]:gap-1.5">
        {fullscreenSupported() && (
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
          <ThemeIcon theme={theme} />
        </button>
        <button
          type="button"
          onClick={() => setShowRules(true)}
          aria-haspopup="dialog"
          aria-label="How to play"
          className="liquid-interactive relative grid h-9 w-9 place-items-center rounded-full border-2 border-edge-mid liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] text-body font-semibold text-text-primary transition-colors hover:border-edge hover:text-text-primary touch:h-11 touch:w-11"
        >
          ?
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
        <div className="mx-auto flex w-full min-h-0 max-w-[420px] flex-1 flex-col rounded-3xl border border-edge-hairline px-3 py-2 cramped:px-2 cramped:py-1 liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] md:max-w-[520px] lg:max-w-[600px] xl:max-w-[680px] md:justify-center relative md:border-edge md:px-5 md:py-4">
      {/* On a phone this strip is the ONLY place progress lives, so it is also
          the way into the detail. Inert from tablet up, where the rail shows
          the same ladder permanently. */}
      <button
        type="button"
        onClick={() => setShowWords(true)}
        aria-haspopup="dialog"
        aria-label="Rank and progress details"
        className="block w-full text-left md:pointer-events-none"
      >
        <RankBar rank={rank} score={score} />
      </button>

      {puzzle.theme && (
        <p className="mt-2 text-center text-kicker uppercase tracking-[0.18em] text-text-secondary short:mt-0.5">
          {puzzle.theme.name}
        </p>
      )}

      {/* Target grid */}
      <section aria-label="Words to find" className="mt-3 short:mt-2 roomy:mt-6">
        <WordTray
          grid={puzzle.grid}
          found={found}
          reveal={reveal}
          base={puzzle.base}
          justSolved={justSolved}
          floatFor={floatFor}
          canHint={tokens > 0}
          onRevealLetter={spendLetter}
          onRevealWord={spendWord}
          hasDefinition={hasDefinition}
          onShowDefinition={openDefinition}
          compact={progress.clueMode}
          activeWord={clueWord}
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
      <div className="h-6 shrink-0 short:h-2 md:h-3" />

      {/* Current word — the only place the accent green appears mid-play */}
      <div
        // No longer a live region: it holds the word being typed, and
        // announcing it letter-by-letter is noise. Results go to the status
        // region below, which a toast cannot overwrite.
        className={[
          'mb-3 grid h-10 place-items-center short:mb-1 short:h-8',
          shaking ? 'anim-shake' : '',
        ].join(' ')}
      >
        {toast ? (
          <span
            key={toast.id}
            className={[
              'anim-rise text-body font-semibold',
              toast.tone === 'good'
                ? 'text-success'
                : toast.tone === 'bad'
                  ? 'text-danger'
                  : 'text-text-muted',
            ].join(' ')}
          >
            {toast.text}
          </span>
        ) : current ? (
          <span className="text-hero font-bold tracking-[0.14em] text-text-primary md:text-hero">
            {current.toUpperCase()}
          </span>
        ) : (
          // An empty hero slot read as a hole in the layout, and nothing on
          // screen said how to enter a word. One muted line fixes both.
          <span className="text-meta text-text-muted">
            {/* Rendered per modality in CSS rather than from a measured
                pointer type, so it is correct before hydration. */}
            <span className="mouse:hidden">Drag across the letters</span>
            <span className="hidden mouse:inline">
              Click the letters, or just type
            </span>
          </span>
        )}
      </div>

      {/*
        Screen-reader status. Rank promotion was previously conveyed ONLY by a
        progressbar value change and a visual banner — and a progressbar value
        is not a status message, so no assistive technology ever spoke it. The
        player could climb from Solid to Genius in silence.
      */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
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
          active={active}
        />
      </div>

      {/* Controls */}
      <div className="mt-4 flex items-center justify-center gap-3 short:mt-1">
        <ControlButton
          onClick={() => {
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

      <p className="mt-1.5 hidden text-center text-meta text-text-muted mouse:block">
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
          <>Tap a row for a hint · {tokens} left</>
        ) : (
          <>
            {bonusToNextToken(progress.bonusTotal)} more bonus{' '}
            {bonusToNextToken(progress.bonusTotal) === 1 ? 'word' : 'words'} earns a hint
          </>
        )}
        <span className="md:hidden"> ›</span>
      </button>
        </div>

        {/* Evidence rail — below the board on tablet, beside it on desktop. */}
        {/* self-start keeps the rail at its natural height so the board column
            can stretch and center its own contents. */}
        <aside
          aria-label="Your progress"
          className="hidden md:block md:max-h-full md:self-start md:overflow-y-auto lg:sticky lg:top-6"
        >
          {rail}
        </aside>
      </div>

      {showWords && (
        <Sheet onClose={() => setShowWords(false)} label="Your progress">
          <Rail
            gridWords={puzzle.grid}
            base={puzzle.base}
            found={found}
            bonusFound={bonusFound}
            rank={rank}
            score={score}
            maxScore={puzzle.maxScore}
            days={days}
            streak={progress.streak}
            bestStreak={progress.bestStreak}
            hasDefinition={hasDefinition}
            onShowDefinition={openDefinition}
            howToClassName=""
          />
        </Sheet>
      )}

      {!progress.seenIntro && <Intro onDismiss={() => markIntroSeen()} />}

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

            <p className="mt-3 text-body leading-relaxed text-text-secondary">
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
                {showDef.source === 'modern'
                  ? 'Modern dictionary'
                  : "Webster's Unabridged, 1913"}
                {defUpgrading && showDef.source === 'archaic'
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
                  className="liquid-interactive relative mt-5 h-12 w-full rounded-full border-2 border-edge bg-gradient-to-b from-steel/80 to-steel-dark/80 text-body font-semibold text-text-primary backdrop-blur-[var(--glass-blur)]"
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
        <Sheet onClose={() => setShowPuzzles(false)} label="Puzzles">
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
          {themes.length > 0 && (
            <div className="relative mt-4 rounded-2xl border border-edge liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] p-4">
              <h2 className="mb-3 text-item font-semibold text-text-primary">
                Themes
              </h2>
              <div className="flex flex-col gap-2">
                {themes.map((t) => {
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
            <p className="mb-3 text-meta text-text-muted">
              Both are off by default. Turn one on and the puzzle changes shape.
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

/**
 * First-run explainer.
 *
 * The rank names imply cleverness while the numbers measure how much of the
 * puzzle you found — nothing on screen reconciled that, so a new player met
 * "Novice" with no idea what would move it. Shown once, and the whole overlay
 * is the dismiss target: no button to find, no decision to make.
 */
function Intro({ onDismiss }: { onDismiss: () => void }) {
  const ref = useDialog(onDismiss);
  const mounted = useMounted();
  if (!mounted) return null;
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="How ranks work"
      tabIndex={-1}
      onClick={onDismiss}
      className="fixed inset-0 z-[60] grid cursor-pointer place-items-center px-6 outline-none"
      style={{ background: 'var(--scrim)' }}
    >
      <div className="anim-rise relative w-full max-w-[360px] rounded-3xl border-2 border-edge liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] p-6">
        <p className="text-meta uppercase tracking-[0.16em] text-text-muted">
          How you&apos;re scored
        </p>
        <h2 className="mt-1.5 text-title font-bold leading-tight text-text-primary">
          Find as much of the puzzle as you can
        </h2>
        <p className="mt-2 text-body leading-relaxed text-text-secondary">
          {RANK_BASIS} The six rows are the targets — every extra word still
          counts, and climbs the ladder.
        </p>

        <ol className="mt-4 flex flex-col gap-1.5">
          {RANKS.map((r, i) => (
            <li key={r.name} className="flex items-center gap-3 text-body">
              <span
                aria-hidden
                className={[
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  i === 0 ? 'bg-edge' : 'bg-edge-hairline',
                ].join(' ')}
              />
              <span
                className={
                  i === 0
                    ? 'flex-1 font-semibold text-text-primary'
                    : 'flex-1 text-text-secondary'
                }
              >
                {r.name}
              </span>
              <span className="text-meta tabular-nums text-text-muted">
                {Math.round(r.at * 100)}%
              </span>
            </li>
          ))}
        </ol>

        {/* A real button, not just "tap anywhere". The overlay-as-target is
            fine for a pointer and useless without one: it was a non-focusable
            div, so a keyboard-only player was trapped behind this on first
            launch with nothing to activate. */}
        <button
          type="button"
          onClick={onDismiss}
          className="mt-5 h-11 w-full rounded-full border-2 border-edge liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] text-body font-medium text-text-primary"
        >
          Start playing
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
        <span aria-hidden className="text-body text-text-muted">
          ›
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
          on ? 'border-steel bg-steel-dark/80 backdrop-blur-sm' : `border-edge ${'liquid'}`,
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

function FullscreenIcon({ on }: { on: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {on ? (
        // Arrows pointing in — the way out.
        <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" />
      ) : (
        <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
      )}
    </svg>
  );
}

function ThemeIcon({ theme }: { theme: Theme }) {
  // 'auto' shows what it's currently following, with a dot to say it's tracking
  // the system rather than pinned.
  const showing = effectiveTheme(theme);
  return (
    <span className="relative grid place-items-center">
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {showing === 'light' ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
          </>
        ) : (
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
        )}
      </svg>
      {theme === 'auto' && (
        <span
          aria-hidden
          className="absolute -bottom-1.5 h-1 w-1 rounded-full bg-steel-muted"
        />
      )}
    </span>
  );
}

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      {muted ? (
        <>
          <path d="m17 9 4 6" />
          <path d="m21 9-4 6" />
        </>
      ) : (
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      )}
    </svg>
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
      className="liquid-interactive relative h-11 min-w-[104px] rounded-full border-2 border-edge liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] px-5 text-body font-medium text-text-secondary transition-colors hover:border-text-primary hover:text-text-primary disabled:opacity-35 disabled:hover:border-carbon-border disabled:hover:text-text-secondary"
    >
      {children}
    </button>
  );
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
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center"
      style={{ background: 'var(--scrim)' }}>
      <div className="anim-rise safe-bottom w-full max-w-[420px] relative rounded-t-3xl border-t-2 border-edge liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] px-6 pt-7 sm:rounded-3xl sm:border">
        <p className="text-kicker uppercase tracking-[0.18em] text-text-secondary">
          {warmup !== null
            ? `Warm-up ${warmup} cleared`
            : isDaily
              ? "Today's puzzle cleared"
              : 'Puzzle cleared'}
        </p>
        <h2 className="mt-1 text-hero font-bold text-text-primary">{rank}</h2>

        <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
          <Stat label="Score" value={score} />
          <Stat label="Bonus" value={bonus} />
          <Stat label="Streak" value={streak} />
        </dl>

        {/* Show exactly what gets sent. Nobody shares a card they can't see. */}
        <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words relative rounded-xl border border-edge-mid liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] px-4 py-3 text-center text-meta leading-relaxed text-text-secondary">
          {preview}
        </pre>

        {/* Forward motion is the primary action — sharing is what you do
            once, playing on is what brings you back. */}
        <button
          type="button"
          onClick={onNext}
          className="liquid-interactive relative mt-6 h-12 w-full rounded-full border-2 border-edge bg-gradient-to-b from-steel/80 to-steel-dark/80 text-body font-semibold text-text-primary backdrop-blur-[var(--glass-blur)]"
        >
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
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="relative rounded-xl border border-edge-mid liquid liquid-raised backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] py-3">
      <dd className="text-title font-bold tabular-nums text-text-primary">
        {value}
      </dd>
      <dt className="text-meta text-text-muted">{label}</dt>
    </div>
  );
}
