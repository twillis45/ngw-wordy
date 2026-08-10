/**
 * The reveal: letters fly from the wheel into their slots in the tray.
 *
 * This is deliberately imperative DOM outside React. It's a one-shot transient
 * effect with no state anyone reads — modelling it as React state would mean a
 * render pass per frame-critical step, plus a two-pass dance to measure from-
 * and to-rects. The Web Animations API does it in one call per letter and
 * cleans up after itself.
 *
 * Studio Matte constraints: no particles, no confetti, no glow. The magic is
 * the physical connection between where you drew the word and where it lands.
 */

const LAYER_ID = 'wordy-flight-layer';

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function layer(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById(LAYER_ID);
  if (el) return el;
  el = document.createElement('div');
  el.id = LAYER_ID;
  el.setAttribute('aria-hidden', 'true');
  // Above the board, below any sheet. Never hit-testable.
  el.style.cssText =
    'position:fixed;inset:0;z-index:55;pointer-events:none;overflow:visible';
  document.body.appendChild(el);
  return el;
}

export type FlightPair = {
  letter: string;
  from: DOMRect;
  to: DOMRect;
};

/**
 * Animate each letter from its wheel tile to its tray slot.
 * Returns the total duration so the caller can time what follows.
 */
export function flyLetters(pairs: FlightPair[]): number {
  const host = layer();
  if (!host || pairs.length === 0 || reducedMotion()) return 0;

  const DURATION = 380;
  const STAGGER = 45;

  pairs.forEach((pair, i) => {
    const ghost = document.createElement('span');
    ghost.textContent = pair.letter.toUpperCase();

    // Start as a copy of the wheel tile, end as a copy of the tray slot.
    ghost.style.cssText = [
      'position:fixed',
      `left:${pair.from.left}px`,
      `top:${pair.from.top}px`,
      `width:${pair.from.width}px`,
      `height:${pair.from.height}px`,
      'display:grid',
      'place-items:center',
      'border-radius:14px',
      'font-weight:700',
      `font-size:${Math.round(pair.from.height * 0.46)}px`,
      'color:var(--color-text-primary)',
      'background:var(--glass-fill-raised)',
      'border:1px solid var(--color-steel)',
      'box-shadow:inset 1.5px 1.5px 0 var(--glass-rim-light-strong), inset 0 -2px 1px -1px var(--glass-caustic-strong), 0 3px 10px -4px var(--glass-contact-strong)',
      'will-change:transform,opacity',
    ].join(';');

    host.appendChild(ghost);

    const dx =
      pair.to.left + pair.to.width / 2 - (pair.from.left + pair.from.width / 2);
    const dy =
      pair.to.top + pair.to.height / 2 - (pair.from.top + pair.from.height / 2);
    const scale = pair.to.height / pair.from.height;

    const anim = ghost.animate(
      [
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        {
          // Slight lift at the midpoint so the path arcs instead of sliding.
          transform: `translate(${dx * 0.55}px, ${dy * 0.42 - 14}px) scale(${
            (1 + scale) / 2
          })`,
          opacity: 1,
          offset: 0.55,
        },
        {
          transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
          opacity: 0.9,
        },
      ],
      {
        duration: DURATION,
        delay: i * STAGGER,
        easing: 'cubic-bezier(0.33, 0.02, 0.30, 1)',
        fill: 'forwards',
      }
    );

    anim.onfinish = () => ghost.remove();
    // If the tab is backgrounded mid-flight, onfinish may never run.
    anim.oncancel = () => ghost.remove();
  });

  return DURATION + (pairs.length - 1) * STAGGER;
}

/**
 * The bonus set-piece.
 *
 * A bonus word previously produced a 13px toast, which is a strange amount of
 * ceremony for the mechanic the whole economy runs on: every extra word scores,
 * and every third earns a hint. This is a scene in three beats — the word
 * arrives as glass, a ring of light passes through it, then it travels to the
 * counter it feeds and the counter answers.
 *
 * Imperative DOM for the same reason as the letter flight: it is transient,
 * nothing reads it, and React state would mean a render pass per beat.
 */
export function celebrateBonus(opts: {
  word: string;
  points: number;
  earnedHint: boolean;
  targetSelector: string;
}): number {
  const host = layer();
  if (!host) return 0;

  const target = document.querySelector<HTMLElement>(opts.targetSelector);
  const cx = window.innerWidth / 2;
  const cy = Math.round(window.innerHeight * 0.5);

  const reduce = reducedMotion();
  const ARRIVE = reduce ? 0 : 420;
  const HOLD = reduce ? 900 : 620;
  const TRAVEL = reduce ? 260 : 460;

  scrimBehind(host, cx, cy, 260, ARRIVE + HOLD + TRAVEL);

  // Beat 2: the ring. Pure decoration, so this is the part reduced motion
  // actually drops — the word and the count still arrive either way.
  if (!reduce) {
  const ring = document.createElement('span');
  ring.className = 'anim-bonus-ring';
  ring.style.cssText = [
    'position:fixed',
    `left:${cx}px`,
    `top:${cy}px`,
    'width:150px',
    'height:150px',
    'border-radius:999px',
    'border:2px solid var(--color-success)',
    'box-shadow:0 0 28px -2px var(--color-success), inset 0 0 18px -6px var(--color-success)',
    'backdrop-filter:blur(2px) brightness(1.2)',
    '-webkit-backdrop-filter:blur(2px) brightness(1.2)',
    'animation-delay:180ms',
  ].join(';');
  host.appendChild(ring);
  setTimeout(() => ring.remove(), 1000);
  }

  // Beat 1: the word, as glass.
  const card = document.createElement('div');
  /*
   * Liquid glass, but built differently from the pointer on purpose.
   *
   * The card animates with `transform`, which makes it a backdrop root for any
   * child — so a masked ring like the pointer's would have nothing to sample
   * (the same bug that made the pointer render air). The refraction therefore
   * goes on the card ITSELF, where its own transform doesn't interfere, and
   * depth comes from the rim, caustic and specular instead of a wall.
   */
  card.className = 'anim-bonus-in liquid liquid-raised';
  // Denser than a panel: this one sits over the board and has to win.
  card.style.cssText = [
    'position:fixed',
    'overflow:hidden',
    `left:${cx}px`,
    `top:${cy}px`,
    'padding:18px 28px',
    'border-radius:22px',
    'background:color-mix(in srgb, var(--color-carbon-surface-2) 94%, transparent)',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'gap:2px',
    'backdrop-filter:blur(calc(var(--glass-blur) * 2)) saturate(var(--glass-saturate)) brightness(1.08)',
    '-webkit-backdrop-filter:blur(calc(var(--glass-blur) * 2)) saturate(var(--glass-saturate)) brightness(1.08)',
    'border:1px solid var(--color-edge)',
    'will-change:transform,opacity',
  ].join(';');

  const word = document.createElement('span');
  word.textContent = opts.word.toUpperCase();
  word.style.cssText =
    'font-size:30px;font-weight:800;letter-spacing:0.08em;color:var(--color-text-primary);white-space:nowrap';

  const sub = document.createElement('span');
  sub.textContent = opts.earnedHint
    ? `+${opts.points} · hint earned`
    : `+${opts.points} bonus`;
  sub.style.cssText =
    'font-size:14px;font-weight:700;color:var(--color-success);letter-spacing:0.03em';

  card.append(word, sub);
  if (reduce) card.style.transform = 'translate(-50%, -50%)';
  host.appendChild(card);

  // Beat 3: travel to the counter, and let the counter answer.
  setTimeout(() => {
    const to = target?.getBoundingClientRect();
    const from = card.getBoundingClientRect();
    const dx = to ? to.left + to.width / 2 - (from.left + from.width / 2) : 0;
    const dy = to ? to.top + to.height / 2 - (from.top + from.height / 2) : -80;

    const anim = card.animate(
      [
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        {
          transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.28)`,
          opacity: 0,
        },
      ],
      { duration: TRAVEL, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' }
    );
    anim.onfinish = () => card.remove();
    anim.oncancel = () => card.remove();

    // Land the pulse as the card arrives, not when it leaves.
    setTimeout(() => {
      if (!target) return;
      target.classList.add('anim-counter-pop');
      setTimeout(() => target.classList.remove('anim-counter-pop'), 450);
    }, TRAVEL * 0.75);
  }, ARRIVE + HOLD);

  return ARRIVE + HOLD + TRAVEL;
}

/**
 * Rank promotion.
 *
 * Climbing a rank was a silent text swap — the one recurring reward in the
 * game with no moment attached to it. A glass banner drops from the top, holds
 * long enough to read, and retreats without ever taking a tap.
 */
export function celebrateRank(name: string, toNext: string | null): number {
  const host = layer();
  if (!host) return 0;
  /*
   * Promotion is the one recurring reward with no other channel — the rank
   * strip changes quietly and a progressbar value change is not announced by
   * anything. Returning early here meant a reduced-motion player could climb
   * from Solid to Complete and never be told once.
   */
  const reduce = reducedMotion();

  const el = document.createElement('div');
  el.className = reduce
    ? 'liquid liquid-raised'
    : 'anim-rank-banner liquid liquid-raised';
  el.style.cssText = [
    'position:fixed',
    'left:50%',
    'top:calc(env(safe-area-inset-top) + 12px)',
    'padding:10px 20px',
    'border-radius:999px',
    'border:1px solid var(--color-edge)',
    // Dense enough to read over the board. The shared glass fill is tuned for
    // panels sitting on the page, not cards sitting over content.
    'background:color-mix(in srgb, var(--color-carbon-surface-2) 94%, transparent)',
    'display:flex',
    'align-items:baseline',
    'gap:10px',
    'white-space:nowrap',
    'overflow:hidden',
    // Same reason as the prize card: the keyframes carry the centring.
    ...(reduce ? ['transform:translate(-50%,0)', 'opacity:1'] : []),
    `backdrop-filter:blur(var(--glass-blur)) saturate(var(--glass-saturate))`,
    `-webkit-backdrop-filter:blur(var(--glass-blur)) saturate(var(--glass-saturate))`,
  ].join(';');

  const label = document.createElement('span');
  label.textContent = name;
  label.style.cssText =
    'font-size:17px;font-weight:800;color:var(--color-text-primary);letter-spacing:0.01em';

  const sub = document.createElement('span');
  sub.textContent = toNext ? `next: ${toNext}` : 'top of the ladder';
  sub.style.cssText = 'font-size:12px;color:var(--color-success);font-weight:600';

  el.append(label, sub);
  host.appendChild(el);
  setTimeout(() => el.remove(), 2400);
  return 2200;
}

/**
 * The prize: the word that uses every letter.
 *
 * It is the hardest thing in any puzzle and it was getting the same treatment
 * as a three-letter bonus. This is the biggest moment in the game and now
 * reads like it — a heavy glass arrival with light spilling out of it.
 */
/**
 * A soft radial scrim behind a celebration card.
 *
 * Glass is translucent by definition, so a card landing over the tray had the
 * tray's letters reading straight through it and the word was unreadable. This
 * darkens and softens only the area under the card, so the glass still shows a
 * backdrop — just not a competing one.
 */
function scrimBehind(host: HTMLElement, cx: number, cy: number, size: number, ms: number) {
  /*
   * A whisper, not a curtain.
   *
   * The first version used the modal scrim colour at full size with a 6px
   * backdrop blur, which on a dark board painted a black cloud over half the
   * screen — and because the card itself is glass, it then vanished INTO the
   * cloud. The card has to be the brightest thing in the frame; the scrim's
   * only job is to stop tray letters reading through it.
   *
   * So: tighter, much weaker, no blur, and it dies well before the card's edge.
   */
  const scrim = document.createElement('span');
  scrim.style.cssText = [
    'position:fixed',
    `left:${cx}px`,
    `top:${cy}px`,
    `width:${size}px`,
    `height:${size}px`,
    'transform:translate(-50%,-50%)',
    'border-radius:999px',
    'background:radial-gradient(closest-side,' +
      ' color-mix(in srgb, var(--color-carbon-body) 78%, transparent) 0%,' +
      ' transparent 68%)',
  ].join(';');
  host.appendChild(scrim);
  const a = scrim.animate(
    [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }],
    { duration: ms, easing: 'ease-out', fill: 'forwards' }
  );
  a.onfinish = () => scrim.remove();
  a.oncancel = () => scrim.remove();
}

export function celebratePrize(word: string, points: number): number {
  const host = layer();
  if (!host) return 0;

  /*
   * Reduced motion DEGRADES this; it used to delete it.
   *
   * The guard was `if (!host || reducedMotion()) return 0`, so the single
   * hardest thing in the game — finding the word that uses every letter —
   * produced nothing at all for a reduced-motion player: the row filled
   * instantly, the float was crushed to 0.01ms by the global rule, and there
   * was no toast either because the '+N' say() sits in the else branch of the
   * prize check. Silence, for the biggest achievement on offer.
   *
   * The fix that already existed in celebrateBonus was never generalised, so
   * this is the same shape: keep the card, hold it longer, drop the motion.
   */
  const reduce = reducedMotion();
  const cx = window.innerWidth / 2;
  const cy = Math.round(window.innerHeight * 0.42);
  scrimBehind(host, cx, cy, 300, 1500);

  // Two rings, offset, so the light reads as spilling rather than pulsing once.
  // Pure decoration — the first thing reduced motion gives up.
  (reduce ? [] : [0, 160]).forEach((delay) => {
    const ring = document.createElement('span');
    ring.className = 'anim-prize-ring';
    ring.style.cssText = [
      'position:fixed',
      `left:${cx}px`,
      `top:${cy}px`,
      'width:170px',
      'height:170px',
      'border-radius:999px',
      'border:2px solid var(--color-success)',
      'box-shadow:0 0 34px -4px var(--color-success), inset 0 0 22px -8px var(--color-success)',
      `animation-delay:${delay}ms`,
    ].join(';');
    host.appendChild(ring);
    setTimeout(() => ring.remove(), 1400 + delay);
  });

  const card = document.createElement('div');
  // Without the entry animation the card must already be at its resting
  // opacity, or the global reduced-motion rule leaves it invisible.
  card.className = reduce
    ? 'liquid liquid-raised'
    : 'anim-prize-in liquid liquid-raised';
  card.style.cssText = [
    'position:fixed',
    'overflow:hidden',
    `left:${cx}px`,
    `top:${cy}px`,
    'padding:20px 30px',
    'border-radius:26px',
    'border:2px solid var(--color-edge)',
    'background:color-mix(in srgb, var(--color-carbon-surface-2) 94%, transparent)',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'gap:4px',
    `backdrop-filter:blur(calc(var(--glass-blur) * 2)) saturate(var(--glass-saturate)) brightness(1.1)`,
    `-webkit-backdrop-filter:blur(calc(var(--glass-blur) * 2)) saturate(var(--glass-saturate)) brightness(1.1)`,
    // Centring normally comes from the keyframes, so without them the card
    // would sit half its own size off-centre.
    reduce ? 'transform:translate(-50%,-50%)' : '',
    reduce ? 'opacity:1' : '',
  ]
    .filter(Boolean)
    .join(';');

  const w = document.createElement('span');
  w.textContent = word.toUpperCase();
  w.style.cssText =
    'font-size:32px;font-weight:800;letter-spacing:0.1em;color:var(--color-text-primary);white-space:nowrap';

  const sub = document.createElement('span');
  sub.textContent = `every letter · +${points}`;
  sub.style.cssText =
    'font-size:13px;font-weight:700;color:var(--color-success);letter-spacing:0.04em';

  card.append(w, sub);
  host.appendChild(card);

  const out = card.animate(
    [{ opacity: 1 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.12)' }],
    { duration: 340, delay: 1150, easing: 'ease-in', fill: 'forwards' }
  );
  out.onfinish = () => card.remove();
  out.oncancel = () => card.remove();
  return 1500;
}

/** Collect from/to rects for a word. Returns [] if the DOM isn't ready. */
export function measureFlight(
  word: string,
  wheelLetters: string[]
): FlightPair[] {
  if (typeof document === 'undefined') return [];

  const pairs: FlightPair[] = [];
  // A letter may appear twice in a word; don't reuse the same wheel tile.
  const usedTiles = new Set<number>();

  for (let i = 0; i < word.length; i += 1) {
    const ch = word[i];

    const tileIndex = wheelLetters.findIndex(
      (l, idx) => l === ch && !usedTiles.has(idx)
    );
    if (tileIndex === -1) continue;

    const tile = document.querySelector<HTMLElement>(
      `[data-wheel-tile="${tileIndex}"]`
    );
    const slot = document.querySelector<HTMLElement>(
      `[data-slot="${word}-${i}"]`
    );
    if (!tile || !slot) continue;

    usedTiles.add(tileIndex);
    pairs.push({
      letter: ch,
      from: tile.getBoundingClientRect(),
      to: slot.getBoundingClientRect(),
    });
  }

  return pairs;
}
