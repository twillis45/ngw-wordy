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
import { feedback, setMuted } from '@/lib/feedback';
import {
  dailyIndex,
  dayKey,
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
  getServerSnapshot,
  getSnapshot,
  setMutedPref,
  subscribe,
  touchStreak,
  update,
  wordsFor,
} from '@/lib/storage';

type Toast = { text: string; tone: 'good' | 'bad' | 'neutral'; id: number };

/** Bonus words buy hints — the economy is earned, never sold. */
const HINT_COST = 3;

export default function Game({ data }: { data: PuzzleFile }) {
  const today = useMemo(() => new Date(), []);
  const index = dailyIndex(today, data.puzzles.length);
  const puzzle: Puzzle = data.puzzles[index];
  const key = dayKey(today);

  // Single source of truth for anything that outlives the session.
  const progress = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const [letters, setLetters] = useState<string[]>(puzzle.letters);
  const [selected, setSelected] = useState<number[]>([]);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [spentHints, setSpentHints] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const [shaking, setShaking] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [copied, setCopied] = useState(false);
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
    () => new Set(wordsFor(progress, key)),
    [progress, key]
  );

  const gridFound = puzzle.grid.filter((w) => found.has(w));
  const bonusFound = [...found].filter((w) => !puzzle.grid.includes(w));
  const score = [...found].reduce((s, w) => s + scoreWord(w, data.wheel), 0);
  const rank = rankFor(score, puzzle.maxScore);
  const hintsAvailable = Math.floor(bonusFound.length / HINT_COST) - spentHints;

  const current = selected.map((i) => letters[i]).join('');

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

  const commit = useCallback(() => {
    const word = selRef.current.map((i) => letters[i]).join('');
    setSel([]);
    if (!word) return;

    // Read the store directly rather than the render-time snapshot: two
    // submissions inside one React batch must not both bank the same word.
    const banked = new Set(wordsFor(getSnapshot(), key));
    const result = submit(puzzle, data.wheel, word, banked);

    switch (result.kind) {
      case 'grid': {
        const solvedBefore = puzzle.grid.filter((w) => banked.has(w)).length;
        feedback.correct(solvedBefore);
        addWord(key, result.word);
        say(
          result.isBase
            ? `${result.word.toUpperCase()} · the long one!`
            : `+${result.points}`,
          'good'
        );
        // Completion is an event, not a derived effect: it fires on the word
        // that finishes the grid, exactly once, and banks the streak with it.
        if (solvedBefore + 1 === puzzle.grid.length) {
          update((p) => touchStreak(p, today));
          feedback.complete();
          setShowComplete(true);
        }
        break;
      }
      case 'bonus':
        feedback.bonus();
        addWord(key, result.word);
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
  }, [letters, puzzle, data.wheel, key, say, setSel, today]);

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
        const i = letters.findIndex((l, idx) => l === ch && !prev.includes(idx));
        if (i === -1) return prev;
        feedback.tap();
        return [...prev, i];
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commit, letters, setSel]);

  const useHint = () => {
    if (hintsAvailable <= 0) return;
    const target = puzzle.grid.find((w) => !found.has(w) && !revealed.has(w));
    if (!target) return;
    setRevealed((prev) => new Set(prev).add(target));
    setSpentHints((n) => n + 1);
    feedback.bonus();
    say('First letter revealed', 'neutral');
  };

  const share = async () => {
    const text = shareText({
      dayNumber: index + 1,
      rank: rank.name,
      score,
      gridFound: gridFound.length,
      gridTotal: puzzle.grid.length,
      bonusFound: bonusFound.length,
    });
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

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col px-5 pb-6 pt-4">
      {/* Header — quiet. Day number and streak are evidence, not the hero. */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            Wordy
          </h1>
          <p className="text-[13px] text-text-muted">
            Day {index + 1}
            {progress.streak > 0 ? ` · ${progress.streak} day streak` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMutedPref(!progress.muted)}
          aria-label={progress.muted ? 'Unmute sound' : 'Mute sound'}
          className="grid h-10 w-10 place-items-center rounded-full border border-carbon-border text-text-muted transition-colors hover:text-text-secondary"
        >
          <SoundIcon muted={progress.muted} />
        </button>
      </header>

      <div className="mt-4">
        <RankBar rank={rank} score={score} />
      </div>

      {/* Target grid */}
      <section aria-label="Words to find" className="mt-6">
        <WordTray
          grid={puzzle.grid}
          found={found}
          revealed={revealed}
          base={puzzle.base}
        />
      </section>

      <div className="flex-1" />

      {/* Current word — the only place the accent green appears mid-play */}
      <div
        aria-live="polite"
        className={[
          'mb-3 grid h-11 place-items-center',
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
        ) : (
          <span className="text-[28px] font-bold tracking-[0.14em] text-text-primary">
            {current.toUpperCase()}
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
        <ControlButton onClick={useHint} disabled={hintsAvailable <= 0}>
          Hint {hintsAvailable > 0 ? `(${hintsAvailable})` : ''}
        </ControlButton>
      </div>

      <p className="mt-3 text-center text-[13px] text-text-muted">
        {bonusFound.length} bonus {bonusFound.length === 1 ? 'word' : 'words'}
        {hintsAvailable <= 0 && (
          <span className="text-carbon-strong">
            {' '}
            · {HINT_COST - (bonusFound.length % HINT_COST)} more earns a hint
          </span>
        )}
      </p>

      {showComplete && (
        <CompleteSheet
          rank={rank.name}
          score={score}
          bonus={bonusFound.length}
          streak={progress.streak}
          copied={copied}
          onShare={share}
          onClose={() => setShowComplete(false)}
        />
      )}
    </main>
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
  copied,
  onShare,
  onClose,
}: {
  rank: string;
  score: number;
  bonus: number;
  streak: number;
  copied: boolean;
  onShare: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/70 sm:place-items-center">
      <div className="anim-rise w-full max-w-[420px] rounded-t-3xl border-t border-carbon-border bg-carbon-panel px-6 pb-8 pt-7 sm:rounded-3xl sm:border">
        <p className="text-[13px] uppercase tracking-[0.14em] text-text-muted">
          Grid cleared
        </p>
        <h2 className="mt-1 text-[28px] font-bold text-text-primary">{rank}</h2>

        <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
          <Stat label="Score" value={score} />
          <Stat label="Bonus" value={bonus} />
          <Stat label="Streak" value={streak} />
        </dl>

        <button
          type="button"
          onClick={onShare}
          className="mt-6 h-12 w-full rounded-full bg-gradient-to-b from-steel to-steel-dark text-[15px] font-semibold text-text-primary"
        >
          {copied ? 'Copied' : 'Share result'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 h-11 w-full rounded-full text-[14px] text-text-muted"
        >
          Keep finding bonus words
        </button>
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
