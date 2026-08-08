'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
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
import { flyLetters, measureFlight } from '@/lib/flight';
import {
  activeLetters,
  clueTarget,
  isReachable,
  dailyIndex,
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
  bonusToNextToken,
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
  const index = (todayIndex + offset) % data.puzzles.length;
  const puzzle: Puzzle = data.puzzles[index];
  const puzzleId = String(puzzle.id);
  const isDaily = offset === 0;

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

  const [letters, setLetters] = useState<string[]>(puzzle.letters);
  const [selected, setSelected] = useState<number[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [shaking, setShaking] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showWords, setShowWords] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [defs, setDefs] = useState<Definitions | null>(null);
  const [showDef, setShowDef] = useState<Resolved | null>(null);
  const [defUpgrading, setDefUpgrading] = useState(false);
  const [clueCursor, setClueCursor] = useState(0);
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
  const days = useMemo(() => last7(progress, today), [progress, today]);

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
      setSel((prev) => {
        if (prev.includes(i)) return prev;
        feedback.tap();
        return [...prev, i];
      });
    },
    [setSel]
  );

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
      // Practice puzzles must never move the streak, or it stops meaning
      // "showed up today".
      if (isDaily) update((p) => touchStreak(p, today));
      setTimeout(() => {
        feedback.complete();
        setShowComplete(true);
      }, delayMs);
    },
    [puzzle.grid, puzzleId, isDaily, today]
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
        /*
         * Count rows that are DONE, not just solved. A row bought with hints
         * fills the grid too, so counting only solved words meant a puzzle
         * finished with any bought row could never register as complete.
         */
        const boughtRows = revealFor(getSnapshot(), puzzleId).words;
        const doneBefore = puzzle.grid.filter(
          (w) => banked.has(w) || boughtRows.includes(w)
        ).length;
        const solvedBefore = puzzle.grid.filter((w) => banked.has(w)).length;
        feedback.correct(solvedBefore);

        /*
         * The reveal, three beats inside ~900ms:
         *   1. letters fly from the wheel to their slots
         *   2. each lands with an overshoot and a light sweep across the row
         *   3. the points float off the row
         *
         * Beat 1 runs first and the tray fills when it lands, so the letters
         * appear to carry themselves into place rather than teleporting.
         */
        const flightMs = flyLetters(flight);
        const land = () => {
          setJustSolved((prev) => new Set(prev).add(result.word));
          addWord(puzzleId, result.word, false);
          setFloatFor({ word: result.word, points: result.points });
          setTimeout(() => setFloatFor(null), 950);
        };
        if (flightMs > 0) setTimeout(land, flightMs * 0.62);
        else land();

        say(
          result.isBase
            ? `${result.word.toUpperCase()} · the long one!`
            : `+${result.points}`,
          'good'
        );
        // Completion is an event, not a derived effect: it fires on the word
        // that finishes the grid, exactly once, and banks the streak with it.
        if (doneBefore + 1 === puzzle.grid.length) {
          // Let the last word actually land before the sheet covers it.
          finishIfDone(Math.max(420, flightMs * 0.62 + 380));
        }
        break;
      }
      case 'bonus':
        feedback.bonus();
        addWord(puzzleId, result.word, true);
        setJustSolved((prev) => new Set(prev).add(result.word));
        say(`Bonus +${result.points}`, 'good');
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

  // Keep the audio module in step with the stored preference.
  useEffect(() => {
    setMuted(progress.muted);
  }, [progress.muted]);

  // Desktop players expect to type.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
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
      feedback.bonus();
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
      feedback.correct(0);
      say(`${word.toUpperCase()} · −${r.cost}`, 'neutral');
      finishIfDone(360);
    },
    [reveal, tokens, puzzleId, say, rowDone, finishIfDone]
  );

  const shareCard = () =>
    shareText({
      dayNumber: index + 1,
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
    <main className="safe-top safe-bottom mx-auto flex min-h-dvh w-full max-w-[420px] flex-col px-5 md:max-w-[740px] lg:max-w-[780px] 2xl:max-w-[820px]">
      {/* Header — quiet. Day number and streak are evidence, not the hero. */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            Wordy
          </h1>
          <p className="text-[13px] text-text-muted">
            {isDaily ? (
              <>
                Today
                {progress.streak > 0 ? ` · ${progress.streak} day streak` : ''}
              </>
            ) : (
              <button
                type="button"
                onClick={() => goToPuzzle(0)}
                className="text-text-secondary underline decoration-carbon-strong underline-offset-2"
              >
                Puzzle +{offset} · back to today
              </button>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={cycleTheme}
          aria-label={`Theme: ${theme}. Tap to change.`}
          className="grid h-9 w-9 place-items-center rounded-full border border-carbon-border text-text-muted transition-colors hover:border-carbon-strong hover:text-text-secondary touch:h-11 touch:w-11"
        >
          <ThemeIcon theme={theme} />
        </button>
        <button
          type="button"
          onClick={() => setShowRules(true)}
          aria-haspopup="dialog"
          aria-label="How to play"
          className="grid h-9 w-9 place-items-center rounded-full border border-carbon-border text-[15px] font-semibold text-text-muted transition-colors hover:border-carbon-strong hover:text-text-secondary touch:h-11 touch:w-11"
        >
          ?
        </button>
        <button
          type="button"
          onClick={() => setMutedPref(!progress.muted)}
          aria-label={progress.muted ? 'Unmute sound' : 'Mute sound'}
          className="grid h-9 w-9 place-items-center rounded-full border border-carbon-border text-text-muted transition-colors hover:border-carbon-strong hover:text-text-secondary touch:h-11 touch:w-11"
        >
          <SoundIcon muted={progress.muted} />
        </button>
        </div>
      </header>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-8 md:grid md:grid-cols-[minmax(0,1fr)_260px] md:gap-7 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10 2xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Board column — bounded at every width, centered on desktop. */}
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col md:max-w-[440px] md:justify-center md:rounded-3xl md:border md:border-carbon-border/70 md:px-5 md:py-4">
      <RankBar rank={rank} score={score} />

      {/* Target grid */}
      <section aria-label="Words to find" className="mt-2 roomy:mt-5">
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
          className="mt-3 w-full rounded-xl border border-carbon-border bg-carbon-panel px-3.5 py-2.5 text-left transition-colors hover:border-carbon-strong"
        >
          <span className="text-[12px] uppercase tracking-[0.14em] text-text-muted">
            {clueWord.length} letters
            {puzzle.grid.filter((w) => !rowDone(w)).length > 1
              ? ' · tap for the next clue'
              : ''}
          </span>
          <span className="mt-1 line-clamp-3 block text-[14px] leading-snug text-text-secondary roomy:text-[15px]">
            {puzzle.clues[clueWord]}
          </span>
        </button>
      )}


      {/* Greedy only on phone, where it bottom-anchors the wheel in the thumb
          zone. From tablet up the rail sits below the board so the page
          scrolls anyway — anchoring there just opened a void. */}
      <div className="min-h-6 flex-1 md:h-3 md:flex-none" />

      {/* Current word — the only place the accent green appears mid-play */}
      <div
        aria-live="polite"
        className={[
          'mb-2 grid h-10 place-items-center',
          shaking ? 'anim-shake' : '',
        ].join(' ')}
      >
        {toast ? (
          <span
            key={toast.id}
            className={[
              'anim-rise text-[15px] font-semibold',
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
          <span className="text-[28px] font-bold tracking-[0.14em] text-text-primary md:text-[32px]">
            {current.toUpperCase()}
          </span>
        ) : (
          // An empty hero slot read as a hole in the layout, and nothing on
          // screen said how to enter a word. One muted line fixes both.
          <span className="text-[13px] text-text-muted">
            {/* Rendered per modality in CSS rather than from a measured
                pointer type, so it is correct before hydration. */}
            <span className="mouse:hidden">Drag across the letters</span>
            <span className="hidden mouse:inline">
              Click the letters, or just type
            </span>
          </span>
        )}
      </div>

      {/* Wheel — bottom third, thumb zone */}
      <div className="flex justify-center">
        <LetterWheel
          letters={letters}
          selected={selected}
          onSelect={pick}
          onCommit={commit}
          onClear={() => setSel([])}
          active={active}
        />
      </div>

      {/* Controls */}
      <div className="mt-4 flex items-center justify-center gap-3">
        <ControlButton
          onClick={() => {
            setLetters((prev) => shuffle(prev));
            setSel([]);
          }}
        >
          Shuffle
        </ControlButton>
        <ControlButton onClick={() => setShowWords(true)}>
          {bonusFound.length} bonus
        </ControlButton>
      </div>

      <p className="mt-1.5 hidden text-center text-[12px] text-text-muted mouse:block">
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
        className="inline-flex min-h-11 flex-wrap items-center justify-center gap-x-1 rounded-full px-3 text-center text-[13px] text-text-muted transition-colors hover:text-text-secondary md:min-h-0 md:pointer-events-none md:hover:text-text-muted"
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
          className="hidden md:block md:self-start lg:sticky lg:top-6"
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
            days={days}
            streak={progress.streak}
            bestStreak={progress.bestStreak}
            hasDefinition={hasDefinition}
            onShowDefinition={openDefinition}
            howToClassName=""
          />
        </Sheet>
      )}

      {(showDef !== null || defUpgrading) && (
        <Sheet
          onClose={() => {
            setShowDef(null);
            setDefUpgrading(false);
          }}
          label={showDef ? `Definition of ${showDef.word}` : 'Definition'}
        >
          <div className="rounded-2xl border border-carbon-border bg-carbon-panel p-4">
            <h2 className="text-[22px] font-bold uppercase tracking-[0.06em] text-text-primary">
              {showDef?.word ?? ''}
            </h2>

            {showDef?.partOfSpeech && (
              <p className="mt-1 text-[13px] italic text-text-muted">
                {showDef.partOfSpeech}
              </p>
            )}
            {showDef?.lemma && (
              <p className="mt-1 text-[13px] text-text-muted">
                from <span className="text-text-secondary">{showDef.lemma}</span>
              </p>
            )}

            <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
              {showDef?.definition
                ? showDef.definition
                : defUpgrading
                  ? 'Looking it up…'
                  : 'No definition found for this one.'}
            </p>

            {/* Say where it came from. A Victorian reading of a modern word is
                a fact about the source, not a bug to hide. */}
            {showDef?.definition && (
              <p className="mt-3 text-[12px] text-text-muted">
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

      {showRules && (
        <Sheet onClose={() => setShowRules(false)} label="How to play">
          <div className="rounded-2xl border border-carbon-border bg-carbon-panel p-4">
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              How to play
            </h2>
            <ul className="flex flex-col gap-2.5 text-[15px] leading-relaxed text-text-secondary">
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

          <div className="mt-4 rounded-2xl border border-carbon-border bg-carbon-panel p-4">
            <h2 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              Ways to play
            </h2>
            <p className="mb-3 text-[13px] text-text-muted">
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
          onShare={share}
          onNext={() => goToPuzzle(offset + 1)}
          onClose={() => setShowComplete(false)}
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
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: 'var(--scrim)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="anim-rise safe-bottom max-h-[82dvh] w-full overflow-y-auto rounded-t-3xl border-t border-carbon-border bg-carbon-body px-5 pt-4"
      >
        {/* Grab handle — signals "drag or tap away", costs one element. */}
        <div
          aria-hidden
          className="mx-auto mb-4 h-1 w-10 rounded-full bg-carbon-strong"
        />
        {children}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 h-11 w-full rounded-full border border-carbon-border text-[14px] text-text-secondary"
        >
          Close
        </button>
      </div>
    </div>
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
          'mt-0.5 grid h-6 w-10 shrink-0 items-center rounded-full border px-0.5 transition-colors',
          on ? 'border-steel bg-steel-dark' : 'border-carbon-strong bg-carbon-body',
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
        <span className="block text-[15px] font-medium text-text-primary">
          {label}
        </span>
        <span className="block text-[13px] leading-snug text-text-muted">
          {detail}
        </span>
      </span>
    </button>
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
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-11 min-w-[104px] rounded-full border border-carbon-border bg-carbon-panel px-5 text-[14px] font-medium text-text-secondary transition-colors hover:border-carbon-strong hover:text-text-primary disabled:opacity-35 disabled:hover:border-carbon-border disabled:hover:text-text-secondary"
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
  onShare: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center"
      style={{ background: 'var(--scrim)' }}>
      <div className="anim-rise safe-bottom w-full max-w-[420px] rounded-t-3xl border-t border-carbon-border bg-carbon-panel px-6 pt-7 sm:rounded-3xl sm:border">
        <p className="text-[13px] uppercase tracking-[0.14em] text-text-muted">
          {isDaily ? "Today's puzzle cleared" : 'Puzzle cleared'}
        </p>
        <h2 className="mt-1 text-[28px] font-bold text-text-primary">{rank}</h2>

        <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
          <Stat label="Score" value={score} />
          <Stat label="Bonus" value={bonus} />
          <Stat label="Streak" value={streak} />
        </dl>

        {/* Show exactly what gets sent. Nobody shares a card they can't see. */}
        <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-carbon-border bg-carbon-body px-4 py-3 text-center text-[13px] leading-relaxed text-text-secondary">
          {preview}
        </pre>

        {/* Forward motion is the primary action — sharing is what you do
            once, playing on is what brings you back. */}
        <button
          type="button"
          onClick={onNext}
          className="mt-6 h-12 w-full rounded-full bg-gradient-to-b from-steel to-steel-dark text-[15px] font-semibold text-text-primary"
        >
          Next puzzle →
        </button>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onShare}
            className="h-11 flex-1 rounded-full border border-carbon-border text-[14px] text-text-secondary"
          >
            {copied ? 'Copied' : 'Share'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-full text-[14px] text-text-muted"
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
    <div className="rounded-xl border border-carbon-border bg-carbon-surface-2 py-3">
      <dd className="text-[22px] font-bold tabular-nums text-text-primary">
        {value}
      </dd>
      <dt className="text-[12px] text-text-muted">{label}</dt>
    </div>
  );
}
