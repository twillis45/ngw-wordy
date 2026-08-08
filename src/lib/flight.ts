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
    'position:fixed;inset:0;z-index:40;pointer-events:none;overflow:hidden';
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
      'background:var(--color-steel-dark)',
      'border:1px solid var(--color-steel)',
      'box-shadow:var(--tile-shadow-active)',
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
