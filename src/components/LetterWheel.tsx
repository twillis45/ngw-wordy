'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  letters: string[];
  /** Indices currently selected, in the order they were picked. */
  selected: number[];
  onSelect: (index: number) => void;
  onCommit: () => void;
  onClear: () => void;
  disabled?: boolean;
  /**
   * Escalating mode: letters not yet unlocked. They stay on the wheel so the
   * player can see what's coming, but can't be selected.
   */
  active?: ReadonlySet<string>;
};

/**
 * Geometry is expressed in percentages of the container, not pixels, so the
 * wheel scales with its breakpoint class and the hit-testing follows for free
 * (it normalizes against the live bounding rect). A pixel-sized wheel was the
 * reason tablet and desktop got a phone-sized board in a large screen.
 */
const RADIUS = 36; // % of container, center to a tile's center
const TILE = 21.2; // % of container
const HIT = 13; // % from a tile center that counts as "on" it

/**
 * iPadOS pointer geometry.
 *
 * MAGNET is the hit REGION, deliberately wider than the tile: Apple's pointer
 * starts transforming before it visibly touches a control, "creating the
 * illusion that the element is pulling the pointer toward it". Morphing only
 * once you're already on the tile would feel like a snap, not a magnet.
 */
const MAGNET = 16; // % — where the SHAPE starts to morph
/**
 * Attraction reaches further than the morph does.
 *
 * These were one number, which forced a bad trade: widening the region to
 * strengthen the pull also destroyed the free-circle state (at 22% it covered
 * 88% of the dial). Splitting them means the pull can start early and bite
 * hard while the shape still stays a circle until you're genuinely close.
 *
 * Measured against the dial rather than guessed: at PULL 30 only 2% of the
 * disc was free of attraction, which is the same mistake in a different
 * dimension. At 21 it splits roughly 15% free / 26% drawn-in / 59% morphing —
 * a real untargeted zone, and a wide band where you can feel the tug before
 * anything changes shape.
 */
const PULL = 21; // % — where positional attraction begins
const PULL_BITE = 1.7; // >1 = weak at the edge, sharply stronger near the tile
const FREE = 11; // % — diameter of the untargeted pointer
const TILE_RADIUS_PCT = 28; // rounded-2xl on a tile, as % of tile size
const PARALLAX = 0.3; // how far a tile leans toward the pointer
const LIFT = 0.07; // how much a tile swells as the pointer settles on it

/**
 * Drag-to-connect letter wheel, thumb-zone sized.
 *
 * Two input paths, both first-class:
 *   • drag across tiles (mobile) — pointer capture, hit-test by distance
 *   • tap a tile (accessibility / precision) — each tile is a real <button>
 * Keyboard typing is handled by the parent so it can also drive backspace.
 */
export default function LetterWheel({
  letters,
  selected,
  onSelect,
  onCommit,
  onClear,
  disabled,
  active,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  /**
   * On a mouse the pointer follows HOVER, not just drags — the iPadOS pointer
   * is always present, and requiring a held button meant desktop users only
   * ever saw the OS arrow. Touch has no hover, so it stays drag-only there.
   */
  const [hovering, setHovering] = useState(false);

  const positions = letters.map((_, i) => {
    // Start at the top and go clockwise.
    const angle = (i / letters.length) * Math.PI * 2 - Math.PI / 2;
    return {
      x: 50 + Math.cos(angle) * RADIUS,
      y: 50 + Math.sin(angle) * RADIUS,
    };
  });

  /** Pointer position in container percentage units. */
  const localPoint = useCallback((e: React.PointerEvent) => {
    const box = boxRef.current;
    if (!box) return null;
    const r = box.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return {
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    };
  }, []);

  const isLocked = useCallback(
    (i: number) => (active ? !active.has(letters[i]) : false),
    [active, letters]
  );

  const hitTest = useCallback(
    (pt: { x: number; y: number }) => {
      for (let i = 0; i < positions.length; i += 1) {
        // A locked tile is not a target, so a drag glides straight over it.
        if (active && !active.has(letters[i])) continue;
        const dx = pt.x - positions[i].x;
        const dy = pt.y - positions[i].y;
        if (Math.hypot(dx, dy) <= HIT) return i;
      }
      return -1;
    },
    [positions, active, letters]
  );

  const handleDown = (e: React.PointerEvent) => {
    if (disabled) return;
    const pt = localPoint(e);
    if (!pt) return;
    const hit = hitTest(pt);
    if (hit === -1) return;
    e.preventDefault();
    try {
      boxRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // Capture is an optimisation — it keeps the drag alive outside the box.
      // It throws if the pointer isn't active, and an uncaught throw here
      // killed the whole gesture before dragging was ever set.
    }
    setDragging(true);
    setCursor(pt);
    onClear();
    onSelect(hit);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (disabled) return;
    const pt = localPoint(e);
    if (!pt) return;

    // Track the mouse even when nothing is held down.
    if (!dragging) {
      if (e.pointerType === 'mouse') {
        setHovering(true);
        setCursor(pt);
      }
      return;
    }

    setCursor(pt);
    const hit = hitTest(pt);
    // Re-selecting the letter you're already on is a no-op; the parent
    // rejects indices already in the path.
    if (hit !== -1) onSelect(hit);
  };

  const endDrag = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    setCursor(null);
    onCommit();
  }, [dragging, onCommit]);

  // A pointerup outside the wheel must still commit, or a word can be lost.
  useEffect(() => {
    if (!dragging) return;
    const up = () => endDrag();
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [dragging, endDrag]);

  /**
   * The pointer's relationship to the nearest tile.
   *
   * `t` is 0 outside the hit region, 1 anywhere ON the tile, and eases across
   * the ring between. Everything interpolates along it — position, size, corner
   * radius, lean.
   *
   * Two numbers here were wrong and made the whole effect invisible:
   *
   * MAGNET was 22%, which covers 88% of the disc when tiles sit 36% apart. The
   * pointer was therefore almost always partially morphed and the free circle
   * essentially never appeared, so there were no two states to tell apart. At
   * 16% it covers 59% and the circle is genuinely visible between tiles.
   *
   * And `t` only reached 1 at the exact tile CENTRE, so the pointer was
   * perpetually mid-morph and never decisively snapped — which is what "too
   * loose" feels like. It now saturates across the whole tile.
   */
  const pointer = (() => {
    if ((!dragging && !hovering) || !cursor) return null;

    let nearest = -1;
    let best = Infinity;
    for (let i = 0; i < positions.length; i += 1) {
      if (active && !active.has(letters[i])) continue;
      const d = Math.hypot(cursor.x - positions[i].x, cursor.y - positions[i].y);
      if (d < best) {
        best = d;
        nearest = i;
      }
    }

    if (nearest === -1 || best > PULL) {
      return { x: cursor.x, y: cursor.y, size: FREE, radius: 50, target: -1, t: 0, pull: 0 };
    }

    // Positional attraction: begins early, bites hard as you close in.
    const pRaw = Math.min(1, (PULL - best) / (PULL - HIT));
    const pull = Math.pow(pRaw * pRaw * (3 - 2 * pRaw), PULL_BITE);

    // Shape: unchanged until you're genuinely near, then fully committed
    // anywhere on the tile.
    const mRaw =
      best <= HIT ? 1 : Math.max(0, (MAGNET - best) / (MAGNET - HIT));
    const t = mRaw * mRaw * (3 - 2 * mRaw);

    const at = (a: number, b: number, k: number) => a + (b - a) * k;

    return {
      // Position follows the stronger curve — that is the magnetism you feel.
      x: at(cursor.x, positions[nearest].x, pull),
      y: at(cursor.y, positions[nearest].y, pull),
      size: at(FREE, TILE, t),
      radius: at(50, TILE_RADIUS_PCT, t),
      target: nearest,
      t,
      pull,
    };
  })();

  /**
   * The tile answers the pointer: it leans toward it and swells slightly as
   * the pointer settles. Half of what makes magnetism legible is the target
   * reacting, not just the pointer moving.
   */
  const parallaxFor = (i: number) => {
    if (!pointer || pointer.target !== i || !cursor) return '';
    const dx = (cursor.x - positions[i].x) * PARALLAX * pointer.pull;
    const dy = (cursor.y - positions[i].y) * PARALLAX * pointer.pull;
    const scale = 1 + LIFT * pointer.t;
    return `translate(${dx}%, ${dy}%) scale(${scale.toFixed(3)})`;
  };

  const pathPoints = selected.map((i) => positions[i]);

  return (
    <div
      ref={boxRef}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={endDrag}
      onPointerLeave={() => {
        setHovering(false);
        if (!dragging) setCursor(null);
      }}
      // cursor-none only where the glass pointer replaces the arrow.
      className="relative aspect-square touch-none select-none mouse:cursor-none"
      /*
       * Sized from the viewport, not from breakpoints.
       *
       * The binding constraint on this component is HEIGHT — a landscape
       * tablet has width to spare and none to give, and a width-only
       * breakpoint pushed the controls off screen there. clamp() on vh
       * handles every device in one expression, and unlike stacked
       * media-query utilities it can't be defeated by CSS source order.
       * The 78vw cap keeps it inside the gutters on a narrow phone.
       */
      style={{ width: 'min(clamp(150px, 30vh, 296px), 78vw)' }}
    >
      {/* Matte disc — depth comes from an inset ring, not a glow. */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full border-2 border-edge liquid backdrop-blur-md backdrop-saturate-150"
        style={{ boxShadow: 'var(--disc-inset)' }}
      />

      {/* Connection path. Drawn under the tiles so it reads as a thread. */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        {pathPoints.length > 0 && (
          <>
            {/* Under-stroke: a wider, dimmer line so the thread reads against
                both a light and a dark disc without needing a glow. */}
            <polyline
              points={[
                ...pathPoints.map((p) => `${p.x},${p.y}`),
                ...(dragging && cursor ? [`${cursor.x},${cursor.y}`] : []),
              ].join(' ')}
              fill="none"
              stroke="var(--color-edge)"
              strokeWidth={4.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.35}
            />
            <polyline
              points={[
                ...pathPoints.map((p) => `${p.x},${p.y}`),
                ...(dragging && cursor ? [`${cursor.x},${cursor.y}`] : []),
              ].join(' ')}
              fill="none"
              stroke="var(--color-edge)"
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* A joint at every letter already taken, so the path reads as a
                sequence of decisions rather than one continuous scribble. */}
            {pathPoints.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={2.1}
                fill="var(--color-edge)"
              />
            ))}
          </>
        )}
      </svg>

      {/*
        The pointer, modelled on iPadOS rather than on a glass orb.
        It is a translucent blob when free, and MORPHS into the tile's shape as
        it enters the hit region — so over a control it reads as the control's
        own highlight rather than something sitting on top of it. An HTML
        element, not an SVG circle, because backdrop-filter needs a real box.
      */}
      {pointer && (
        <span
          aria-hidden
          className="glass-puck pointer-events-none absolute"
          style={{
            /*
             * Centred by offsetting left/top by half the size — NOT by
             * translate(-50%,-50%).
             *
             * A transform creates a new BACKDROP ROOT, so the wall's
             * backdrop-filter had nothing behind it to sample: the refraction
             * was computing correctly and drawing air.
             */
            left: `${pointer.x - pointer.size / 2}%`,
            top: `${pointer.y - pointer.size / 2}%`,
            width: `${pointer.size}%`,
            height: `${pointer.size}%`,
            borderRadius: `${pointer.radius}%`,
            // Short transition only on the morph properties. Position is driven
            // per-move and must not lag the finger.
            transition:
              'width 110ms ease-out, height 110ms ease-out, border-radius 110ms ease-out',
          }}
        >
          {/* The glass wall: refraction lives here and only here, so the
              centre of the lens stays clear and the letter reads through it. */}
          <span
            aria-hidden
            className="glass-wall absolute inset-0 backdrop-blur-[5px] backdrop-brightness-125 backdrop-saturate-[1.7]"
            style={{ borderRadius: 'inherit', padding: '30%' }}
          />
        </span>
      )}

      {letters.map((letter, i) => {
        const pos = positions[i];
        const order = selected.indexOf(i);
        const picked = order !== -1;
        const locked = isLocked(i);
        return (
          <button
            key={`${letter}-${i}`}
            type="button"
            // Flight source. The reveal measures this rect to know where the
            // letter should launch from.
            data-wheel-tile={i}
            // Genuinely disabled, not just click-guarded: a styled-but-enabled
            // tile is still keyboard-reachable and reads as available to a
            // screen reader.
            disabled={disabled || locked}
            aria-label={`Letter ${letter.toUpperCase()}${
              locked ? ', locked' : ''
            }${picked ? `, selected position ${order + 1}` : ''}`}
            aria-pressed={picked}
            onClick={() => {
              // Ignore the synthetic click that follows a drag.
              if (dragging || locked) return;
              onSelect(i);
            }}
            className={[
              'absolute grid place-items-center rounded-2xl border-2 font-bold',
              'text-[26px] md:text-[29px]',
              'transition-[transform,background-color,border-color] duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-steel-muted',
              // anim-tick both pulses on selection and holds the selected
              // scale, so there's no transform utility fighting the keyframes.
              locked
                ? 'border-edge/50 bg-carbon-body/40 text-carbon-strong backdrop-blur-sm'
                : picked
                  ? 'anim-tick border-edge bg-steel-dark/70 text-text-primary backdrop-blur-md'
                  : 'border-edge liquid liquid-raised backdrop-blur-md backdrop-saturate-150 text-text-primary active:scale-95',
            ].join(' ')}
            style={{
              left: `${pos.x - TILE / 2}%`,
              top: `${pos.y - TILE / 2}%`,
              width: `${TILE}%`,
              height: `${TILE}%`,
              transform: parallaxFor(i) || undefined,
              transitionProperty: 'transform, background-color, border-color',
              transitionDuration: '120ms',
              boxShadow: locked
                ? 'none'
                : picked
                  ? 'var(--tile-shadow-active)'
                  : 'var(--tile-shadow)',
            }}
          >
            {letter.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
