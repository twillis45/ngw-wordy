'use client';

import { useEffect, useRef } from 'react';
import { RANK_BASIS, rankLadder, type Rank } from '@/lib/game';
import type { DayCell } from '@/lib/storage';
import { nextMilestone } from '@/lib/record';
import type { PlayerRecord } from '@/lib/record';
import { CheckIcon } from './Icon';

/**
 * The evidence rail.
 *
 * Everything here already existed in the engine but was invisible or reduced
 * to a bare count — you could see *that* you found 3 bonus words, never
 * *which*. On a wide screen the honest thing to put beside the board is the
 * player's own record, not a stretched board.
 *
 * It renders below the board on tablet and beside it on desktop; the grid
 * parent decides which, so there is one copy of this markup.
 */
type Props = {
  gridWords: string[];
  found: ReadonlySet<string>;
  bonusFound: string[];
  rank: Rank;
  /** Every word banked, bonus included. What "Your words" is worth. */
  score: number;
  /** Words found on this board out of everything findable on it. */
  boardFound?: number;
  boardTotal?: number;
  /**
   * The six rows only — the basis `rank` and RANK_BASIS both use.
   *
   * The ladder took `score`/`puzzle.maxScore` while the rank beside it was
   * computed from the grid, so this one card gave two answers to one question:
   * the header read "2 to go" and the row under it read "+10". It also
   * disagreed with the RankBar at the top of the board, which had already been
   * migrated to the grid basis. RANK_BASIS is printed directly above this list
   * and says ranks track the six rows; now the numbers do too.
   */
  /** Rows cleared, and how many the board has. The rank basis. */
  rowsFilled: number;
  totalRows: number;
  days: DayCell[];
  /** The player's own history — see lib/record.ts. */
  record: PlayerRecord;
  /** Today's square filled during this session — see Game.tsx. */
  streakJustEarned?: boolean;
  streak: number;
  bestStreak: number;
  /** Freezes held — each covers one missed day, automatically. */
  freezes: number;
  /** Away since this day, or null. */
  vacationSince?: string | null;
  onVacation?: (on: boolean) => void;
  /**
   * Visibility of the how-to card is a CSS concern, not a JS one — driving it
   * off a measured breakpoint would mean a hydration-unsafe guess about the
   * viewport. Default shows it only on widescreen, where there's room to spare;
   * the mobile sheet passes '' to always show it.
   */
  howToClassName?: string;
  /** This board is finished — see the challenge note in the words card. */
  boardComplete?: boolean;
  /** Pass the ladder on. Only offered when the board is done. */
  onChallenge?: () => void;
  hasDefinition: (word: string) => boolean;
  onShowDefinition: (word: string) => void;
};

export default function Rail({
  gridWords,
  found,
  bonusFound,
  rank,
  score,
  boardFound = 0,
  boardTotal = 0,
  rowsFilled,
  totalRows,
  days,
  record,
  streakJustEarned = false,
  streak,
  bestStreak,
  freezes,
  vacationSince = null,
  onVacation,
  /*
   * Width was never the whole question. This card is the LAST thing in the
   * rail, so on a wide-but-short window — 1900x980 is an ordinary maximised
   * Chrome on a laptop — adding it was what pushed the Streak off the bottom,
   * while a narrower 1440x900 fitted fine. It needs room in both directions.
   */
  howToClassName = 'hidden 2xl:[@media(min-height:1000px)]:block',
  boardComplete = false,
  onChallenge,
  hasDefinition,
  onShowDefinition,
}: Props) {
  /*
   * Does this rail have anything below the fold?
   *
   * `.rail-scroll` fades its last 28px, and that fade is a promise — "there
   * is more down here". An unconditional mask makes the promise on layouts
   * where it is false and erases the bottom of whatever sits last instead,
   * which is how the Streak card spent a long time half-gone. It cannot be
   * answered in CSS: no selector can ask whether a box overflows.
   *
   * This lives HERE, in the component that owns the class, and not in the
   * page that happens to render one of them. It was in Game.tsx first, keyed
   * off the desktop column — and the rail is rendered TWICE, once in that
   * column and once inside the mobile progress sheet. The sheet's copy never
   * got the attribute at all, so it could never fade no matter how much it
   * had to scroll. Nothing looked wrong, because neither instance happened to
   * overflow at the sizes anyone checked.
   *
   * Two conditions, both required: the content must overflow, AND we must not
   * already be at the end — at the bottom there is again nothing below to
   * promise. Re-measured on scroll, on resize, and when the cards themselves
   * change height (banking a word grows "Your words"), which is what the
   * ResizeObserver on the CHILDREN rather than the box is for.
   */
  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => {
      const more = el.scrollHeight - el.clientHeight - el.scrollTop > 1;
      el.dataset.fade = more ? 'true' : 'false';
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  });

  const solvedTargets = gridWords.filter((w) => found.has(w));

  return (
    /*
     * h-full so the column fills the grid row the board already fills. Without
     * it the column is content-sized and stopped 107px short of the board's
     * bottom edge on a 1440x900 — measured — which read as the rail floating
     * rather than as a deliberate gap.
     */
    <div className="flex h-full min-h-0 flex-col gap-3 short:gap-2.5">
      {/*
        Everything ABOVE Streak scrolls; Streak does not.
        
        The rail used to be one scroll box with Streak as its last child, and
        that put the card the rail exists to surface in the one position where
        it is lost first — below the fold on a short window, and under the
        bottom fade on every other one. Both failures were measured, and both
        are structural: a last child in a scrollport is exactly the thing a
        scrollport hides.
        
        Splitting it means the fade now has an honest job (it covers content
        that really can continue) and Streak has a floor it cannot fall
        through. `min-h-0` on both halves because a flex child's default
        min-height is auto, which refuses to shrink and would push Streak back
        off the bottom — the exact bug, reintroduced by omission.
      */}
      <div
        ref={scrollerRef}
        className="rail-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto short:gap-2.5"
      >
      <Card title="Your words" meta={`${score} pts`}>
        {/*
          Targets are COUNTED here, not listed.
          
          They used to be listed, and that was right while the board showed a
          solved row as six filled boxes — the rail was the only place the word
          itself appeared. Now a finished row folds to the word, so on any
          screen wide enough to show the rail beside the board the same five
          words were on screen twice, a few hundred pixels apart, in two
          different shapes.
          
          The board wins that: it is where the word was earned, it is where
          the row it belongs to is, and it already carries the definition
          affordance these chips carried. What stays here is the number,
          because "5 of 6" is the one thing the board states only by having a
          gap in it. Bonus words keep their chips — they have no row to fold
          into, so this is still the only place they exist.
        */}
        {/*
          How much of THIS board is left — a real ratio, not a percentile.

          The audit wanted the Vocabulary pattern ("you outrank 4% of
          learners"). That needs a population, and there is no server and no
          telemetry here by design, so printing one would mean inventing a
          distribution and passing it off as other players. This says
          something true instead: every board has a finite answer set, so
          "23 of 41" is a fact about the board. It gives away no answers — a
          count is not a word — and it does the job the percentile was wanted
          for, which is telling somebody how much is still there.
        */}
        {boardTotal > 0 && (
          <p className="mb-1 text-meta text-text-secondary">
            {boardFound} of {boardTotal} words found
          </p>
        )}
        <p className="text-meta text-text-muted">
          <span className="text-text-secondary">
            Targets · {solvedTargets.length}/{gridWords.length}
          </span>
          {solvedTargets.length > 0 && ' · shown on the board'}
        </p>

        {/*
          The challenge, where it does not vanish.

          It lived only on the completion sheet, which made the best growth
          mechanic in this app a ONE-SHOT on the single screen a player is
          least likely to want to stop at — finish a board, feel finished,
          dismiss the sheet, and the link is gone for good. The board's words:
          "the one moment a player is least likely to want to stop and share."

          Here it persists for as long as the finished board is open, and it
          is the same handler, so the ladder it passes on is the same ladder.
          Hidden until the board is done, because a challenge carrying an
          unfinished score is not a challenge.
        */}
        {boardComplete && onChallenge && (
          <button
            type="button"
            onClick={onChallenge}
            className="liquid-interactive mb-3 h-9 w-full rounded-full border-2 border-edge liquid backdrop-blur-[var(--glass-blur)] px-4 text-meta font-medium text-text-primary"
          >
            Challenge a friend
          </button>
        )}

        <Group
          label={`Bonus · ${bonusFound.length}`}
          empty="Extra words you find show up here"
        >
          {[...bonusFound]
            .sort((a, b) => b.length - a.length || a.localeCompare(b))
            .map((w) => (
              <Chip
                key={w}
                word={w}
                tone="bonus"
                definable={hasDefinition(w)}
                onOpen={onShowDefinition}
              />
            ))}
        </Group>
      </Card>

      {/*
        The header carries WHERE YOU ARE, then how far the next rung is.

        "2 to Clever" on its own does not survive being checked against the
        ladder under it: the rows read Sharp 5, Clever 8, so the arithmetic on
        screen says three. Both numbers were right — the distance is measured
        from the score, which was 6, and the score was the one quantity the card
        never showed. Naming it closes the sum in the reader's favour: 5 is
        behind you, 8 is the next rung, you are at 6, so it is 2.
      */}
      {/*
        Rank absorbs the column's leftover height. It is the only card here
        with a LIST — eight rungs that can breathe — so growing it adds space
        between rows rather than a pool of nothing at the bottom of a card.
        Streak stays its own size and sits on the floor of the rail.

        It both GROWS and SHRINKS, which is only safe because the ladder
        below scrolls. An earlier pass used `flex-1` without that, and the
        card shrank to 157px around a 176px list and spilled the rungs over
        the Streak card. With the list able to scroll, shrinking is contained
        — and shrinking is what keeps Streak on screen at all: at 898x586 the
        rail overflowed by 52px and Streak was cut by 47.
      */}
      <Card
        /*
         * NATURAL height. This used to be `flex-1`, absorbing the column's
         * leftover so that Streak would sit on the floor of the rail — and
         * that reason expired when Streak moved OUT of the scroller and
         * became a pinned footer. What was left was a card that grew to 977px
         * around 286px of rungs on a 1024x1366 iPad: the list correct and
         * centred inside an enormous bordered void. The leftover height
         * belongs to the column, where it reads as spacing, not to a card,
         * where it reads as a hole.
         *
         * The internal scroll went with it for the same reason: the ladder
         * only ever needed to shrink to keep Streak on screen, and the
         * scroller around these cards handles overflow now.
         */
        className="flex flex-col"
        title="Rank"
        meta={
          rank.next
            ? `${rowsFilled} rows · ${rank.rowsToNext} to ${rank.next}`
            : `${rowsFilled} rows · maxed`
        }
      >
        {/* Without this the names imply cleverness while the numbers measure
            exhaustiveness, and nothing on screen reconciles them. */}
        {/* Dropped on a short viewport. This same sentence is now the last line
            of the first-run explainer, so on a screen with no room to spare it
            is the one thing here a player has already been told — unlike the
            ladder and the streak, which exist nowhere else on desktop. */}
        <p className="mb-2.5 hidden text-meta leading-snug text-text-muted short:hidden [@media(min-height:801px)]:block">
          {RANK_BASIS}
        </p>
        {/*
          The ladder is the one thing here that can lose height gracefully. It
          is eight rungs of the same shape, so a scroll costs a reader almost
          nothing — where clipping the Streak card costs them the whole card,
          which is the failure this rail has had twice before.

          CENTRED at a fixed rhythm, not `justify-between`.

          Spreading the rungs to fill the card was deliberate once, on the
          reasoning that a list which grows should add space between its rows
          rather than leave "a pool of nothing at the bottom". Measured across
          the rail's real range, that does not hold up: the gap between rungs
          ran 0.9px at 898x586 and 108.8px at 1024x1366 — a 120x swing on the
          same component, ending three and a half times the height of the rows
          it was separating. At that point the rungs have stopped reading as
          one list.

          Checked against how this is actually done — Duolingo, Mimo, Speak,
          Life Reset and Agoda all keep tier rows contiguous at a constant
          rhythm and let the leftover height sit outside the list. None of them
          distribute rows to fill a container. The rhythm is what makes a
          ladder read as a ladder.

          So: one gap at every size, and the slack is split above and below
          rather than injected between every pair of rows. `justify-center`
          rather than `justify-start` because that keeps the pool from
          collecting entirely at the bottom, which was the real objection.
          check-rail.mjs now asserts the gap never exceeds the rung height.
        */}
        <ol className="flex flex-col gap-1.5 short:gap-0.5">
          {rankLadder(rowsFilled, totalRows).map((step) => (
            <li
              key={step.name}
              aria-current={step.current ? 'step' : undefined}
              className={[
                'flex items-center gap-2.5 rounded-lg px-2 py-1 text-body short:py-0.5 short:text-meta',
                step.current ? 'liquid liquid-raised relative font-semibold' : '',
                step.reached ? 'text-text-primary' : 'text-text-muted',
              ].join(' ')}
            >
              <span
                aria-hidden
                className={[
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  step.current
                    ? 'bg-edge'
                    : step.reached
                      ? 'bg-steel-muted'
                      : 'bg-edge',
                ].join(' ')}
              />
              <span className="flex-1">{step.name}</span>
              {/*
                ONE quantity down the column: what each rank costs.

                This alternated between `${step.at} pts` for reached ranks and
                `+${step.toGo}` for the rest — a threshold and a distance, in
                one column, distinguished only by a plus sign. Reading down it
                meant switching units halfway, and the reached half collided
                with the score shown two cards up ("Sharp 15 pts" beside "Your
                words 15 pts" are not the same fifteen).

                A ladder of costs also holds still while you play; only the
                highlight moves. How far the next rung is has its own place --
                the card header, and the bar at the top of the board.
              */}
              <span className="text-meta tabular-nums text-text-muted">
                {step.at === 1 ? '1 row' : `${step.at} rows`}
              </span>
            </li>
          ))}
        </ol>
      </Card>

      {/*
        The player's own record.

        The board of 2026-08-21 scored this dimension 2/10 — the lowest in
        that review, and lower than the leaderboard it declined to build. The
        game computed a score on every board and showed it for the CURRENT
        board only: no best, no total, no sense of how much of the catalogue
        was left. Every daily leader looked at shows a player their history.

        INSIDE the scroller, unlike Streak, because it is reference rather
        than status — a thing you look up, where the streak is a thing you
        check. Every figure is derived from stored words rather than counted
        alongside them, so this card cannot drift out of step with the rest of
        the rail.
      */}
      {/*
        Packs in the meta, boards in the body.

        "21 of 499 boards" is true and says nothing about the thing a player
        is actually collecting: the catalogue is sold as PACKS, and a player
        three packs into fourteen has no way to see that from a board count.
        The board count keeps its place below; it just stops being the
        headline for a collection it does not describe.
      */}
      <Card
        title="Record"
        meta={
          record.packsTotal > 0
            ? `${record.packsDone}/${record.packsTotal} packs`
            : `${record.cleared}/${record.total} boards`
        }
      >
        {/*
          THREE figures, on one row.

          Best streak is deliberately absent: the Streak card already carries
          it in its own meta as "best N", and putting it here too repeats a
          number a few hundred pixels from itself — the same duplication the
          Targets list had before the board folded it into a count.

          One row rather than a 2x2 grid because the card sits at the bottom
          of a scroller that was already close to full: at 1440x900 the 2x2
          version pushed the rail 20px past its box and left the last figures
          half-cut under the fade. A card the player has to scroll to finish
          reading is a worse answer than a card that says less.
        */}
        <dl className="grid grid-cols-3 gap-x-3">
          {[
            { k: 'Best score', v: record.bestScore.toLocaleString() },
            { k: 'Boards', v: `${record.cleared}` },
            { k: 'Days', v: `${record.daysPlayed}` },
          ].map((row) => (
            <div key={row.k} className="flex flex-col gap-0.5">
              <dt className="text-kicker uppercase tracking-[0.1em] text-text-muted">
                {row.k}
              </dt>
              <dd className="text-item font-semibold tabular-nums text-text-primary">
                {row.v}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      </div>

      {/*
        Outside the scroller, and shrink-0 so it keeps its full height when the
        column is squeezed. This is the card two previous regressions cut off.
      */}
      <Card
        className="shrink-0"
        title="Streak"
        /*
          The window goes in the META, not on a line of its own.
          
          Dates reached the accessible name and the `title` and stopped there,
          which fixed the screen reader and left a sighted player on a PHONE
          with nothing — there is no hover on touch, and the row still read
          `S S M T W T F` where two cells begin S and two begin T. Stating the
          range once resolves all seven without touching the cells: given the
          range the letters become positional, and the second S is Saturday
          because Saturday is where the range ends.
          
          On its own line it cost 19px and pushed the Record card under the
          fade at 1440x900 — measured, and check-rail did not catch it because
          that script guarded only this card. Both are fixed; the meta line was
          already there and had room.
        */
        meta={[
          days[0]?.date && days[days.length - 1]?.date
            ? (() => {
                const from = days[0].date.replace(/^[A-Za-z]+, /, '');
                const to = days[days.length - 1].date.replace(/^[A-Za-z]+, /, '');
                /* One month five weeks out of six — do not say August twice. */
                return from.split(' ')[0] === to.split(' ')[0]
                  ? `${from} – ${to.split(' ')[1]}`
                  : `${from} – ${to}`;
              })()
            : null,
          bestStreak > 1 ? `best ${bestStreak}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      >
        <div role="list" className="flex items-end justify-between gap-1">
          {days.map((d, i) => (
            /*
              The whole cell is ONE labelled thing.

              It used to be two silent ones: the box carried `aria-hidden` and
              the letter under it was a bare span, so a screen reader heard
              `S S M T W T F` and nothing else — not which dates those were,
              and not whether any of them had been played. The played state
              was carried entirely by a border colour and a tick glyph inside
              an aria-hidden box, which is to say it was not carried at all.

              `listitem` under the row's `list`, so the seven read as a set
              and the reader is told how many there are.
            */
            <div
              key={d.key}
              role="listitem"
              aria-label={
                d.date
                  ? `${d.date}${i === days.length - 1 ? ' (today)' : ''}: ${
                      d.played ? 'played' : 'not played'
                    }`
                  : undefined
              }
              title={d.date || undefined}
              className="flex flex-col items-center gap-1.5 short:gap-1"
            >
              <span
                aria-hidden
                className={[
                  'grid h-6 w-6 place-items-center rounded-md border-2 lg:h-7 lg:w-7',
                  d.played
                    ? 'border-steel bg-steel-dark/40 text-text-primary'
                    // Unplayed cells hold no glyph, so no text color here —
                    // carbon-strong is a border token and must never set text.
                    : 'border-edge/60 liquid relative',
                  // Today reads as today whether or not it's been played.
                  i === days.length - 1 ? 'ring-1 ring-steel-muted/40' : '',
                  /*
                   * The one square that just filled gets the arrival the
                   * streak never had. Only today's, and only when it changed
                   * during this session — a cell that popped because it is
                   * filled would replay on every reload.
                   */
                  i === days.length - 1 && d.played && streakJustEarned
                    ? 'anim-land'
                    : '',
                ].join(' ')}
              >
                {d.played ? <CheckIcon /> : null}
              </span>
              {/* Decorative now: the cell above carries the real name. */}
              <span aria-hidden className="text-kicker text-text-muted">
                {d.label}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-meta text-text-muted">
          {vacationSince
            ? `Paused at ${streak} ${streak === 1 ? 'day' : 'days'}. Enjoy it.`
            : streak > 1
              ? `${streak} days in a row.`
              : 'Play tomorrow to start a streak.'}
        </p>
        {/*
          Freezes, stated plainly and only when held.

          The point of showing them is BEFORE the miss, not after: a player
          who knows a slip is covered is a player who is not afraid of the
          streak, and fear of losing one is the thing that makes people stop
          opening an app rather than start. Hidden until earned, because a
          zero here would advertise a mechanic at exactly the moment it offers
          nothing.
        */}
        {/*
          The next rung, named.

          "4 days in a row" tells a player what they have and gives them no
          reason to believe day five is worth more than day four was. A named
          milestone gives the streak a near edge — Deepstash runs a 7/14/30
          track and Finch celebrates at three, and we celebrated nothing until
          a board was complete.

          Hidden once the last rung is passed rather than replaced with an
          endless ladder: past 100 days a player is told what they have, not
          what they still owe.
        */}
        {(() => {
          /*
           * Nothing at zero. The line above already says "play tomorrow to
           * start a streak", and following it with "3 more days to 3" both
           * repeats it and counts toward a rung the player has not stepped
           * onto — a milestone is a near edge for someone already walking,
           * not a target handed to someone standing still.
           */
          const next = streak > 0 && !vacationSince ? nextMilestone(streak) : null;
          if (!next) return null;
          return (
            <p className="mt-1 text-meta text-text-secondary">
              {next.toGo === 1
                ? `1 more day to ${next.at}.`
                : `${next.toGo} more days to ${next.at}.`}
            </p>
          );
        })()}
        {freezes > 0 && !vacationSince && (
          <p className="mt-1 text-meta text-text-muted">
            {freezes === 1
              ? '1 freeze — covers a missed day.'
              : `${freezes} freezes — each covers a missed day.`}
          </p>
        )}
        {/*
          The pause control, and it is deliberately plain.

          A freeze covers a slip; this covers a week somebody already knows
          about. It sits on the Streak card rather than in settings because
          the moment a player thinks "I am going away" is the moment they are
          looking at their streak and worrying about it — which is the feeling
          the whole mechanic exists to remove.
        */}
        {onVacation && (streak > 0 || vacationSince) && (
          <button
            type="button"
            onClick={() => onVacation(!vacationSince)}
            className="mt-2.5 text-meta text-text-muted underline underline-offset-2 hover:text-text-secondary"
          >
            {vacationSince ? 'I am back' : 'Going away?'}
          </button>
        )}
      </Card>

      <div className={howToClassName}>
        <Card title="How to play">
          <ul className="flex flex-col gap-2 text-body leading-relaxed text-text-secondary">
            <li>Drag across the wheel, or just type.</li>
            <li>Fill every row to clear the grid.</li>
            <li>
              Extra words still score — every 3 of them earns a hint.
            </li>
            <li>New letters daily.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Card({
  title,
  meta,
  children,
  className = '',
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
  /** Lets one card in the column absorb leftover height — see the rail root. */
  className?: string;
}) {
  /*
   * Panel radius, not card radius. These three sit directly on the page beside
   * the board panel, which makes them its peers — they measured 16px against
   * its 24px, which read as drift rather than hierarchy.
   */
  return (
    <section
      className={`relative rounded-3xl border border-edge liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] p-4 lg:p-3.5 short:p-3 ${className}`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-item font-semibold text-text-primary">
          {title}
        </h2>
        {meta && (
          <span className="text-meta tabular-nums text-text-muted">
            {meta}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function Group({
  label,
  empty,
  children,
}: {
  label: string;
  empty: string;
  children: React.ReactNode[];
}) {
  const has = children.length > 0;
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-1.5 text-meta text-text-muted">{label}</p>
      {has ? (
        <div className="flex flex-wrap gap-1.5">{children}</div>
      ) : (
        <p className="text-meta text-text-muted">{empty}</p>
      )}
    </div>
  );
}

function Chip({
  word,
  tone,
  definable,
  onOpen,
}: {
  word: string;
  tone: 'base' | 'target' | 'bonus';
  definable: boolean;
  onOpen: (word: string) => void;
}) {
  const cls = [
    'relative rounded-md px-2 py-1 text-meta font-medium uppercase tracking-[0.06em] liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)]',
    tone === 'base'
      ? 'liquid-raised bg-success/15 text-success-ink'
      : tone === 'target'
        ? 'liquid-raised text-text-primary'
        : 'text-text-secondary',
  ].join(' ');

  // A word with no entry stays a plain span, so nothing invites a dead tap.
  if (!definable) return <span className={cls}>{word}</span>;

  return (
    <button
      type="button"
      onClick={() => onOpen(word)}
      aria-label={`${word}. Show definition.`}
      className={`${cls} underline decoration-steel-muted decoration-dotted underline-offset-2 transition-colors hover:decoration-steel-muted`}
    >
      {word}
    </button>
  );
}
