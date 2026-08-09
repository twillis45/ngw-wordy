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
const MAGNET = 22; // % — where the morph begins
const FREE = 14; // % — diameter of the untargeted pointer
const TILE_RADIUS_PCT = 28; // rounded-2xl on a tile, as % of tile size
const PARALLAX = 0.14; // how far a tile leans toward the pointer

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
    boxRef.current?.setPointerCapture(e.pointerId);
    setDragging(true);
    setCursor(pt);
    onClear();
    onSelect(hit);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!dragging || disabled) return;
    const pt = localPoint(e);
    if (!pt) return;
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
   * `t` runs 0 at the edge of the hit region to 1 at the tile's centre, and
   * everything about the pointer is interpolated along it: position, size,
   * corner radius, and how far the tile leans back. That single value is what
   * makes the morph continuous rather than a state flip.
   */
  const pointer = (() => {
    if (!dragging || !cursor) return null;

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

    if (nearest === -1 || best > MAGNET) {
      return { x: cursor.x, y: cursor.y, size: FREE, radius: 50, target: -1, t: 0 };
    }

    // Ease so the pull accelerates as you approach, the way magnetism reads.
    const linear = 1 - best / MAGNET;
    const t = linear * linear * (3 - 2 * linear);
    const lerp = (a: number, b: number) => a + (b - a) * t;

    return {
      x: lerp(cursor.x, positions[nearest].x),
      y: lerp(cursor.y, positions[nearest].y),
      size: lerp(FREE, TILE),
      radius: lerp(50, TILE_RADIUS_PCT),
      target: nearest,
      t,
    };
  })();

  /** A tile leans toward the pointer while it's inside the hit region. */
  const parallaxFor = (i: number) => {
    if (!pointer || pointer.target !== i || !cursor) return '';
    const dx = (cursor.x - positions[i].x) * PARALLAX * pointer.t;
    const dy = (cursor.y - positions[i].y) * PARALLAX * pointer.t;
    return `translate(${dx}%, ${dy}%)`;
  };

  const pathPoints = selected.map((i) => positions[i]);

  return (
    <div
      ref={boxRef}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={endDrag}
      className="relative aspect-square touch-none select-none"
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
      style={{ width: 'min(clamp(196px, 28vh, 296px), 78vw)' }}
    >
      {/* Matte disc — depth comes from an inset ring, not a glow. */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full border-2 border-edge bg-carbon-panel"
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
          className="glass-puck pointer-events-none absolute backdrop-blur-[14px] backdrop-saturate-[1.6]"
          style={{
            left: `${pointer.x}%`,
            top: `${pointer.y}%`,
            width: `${pointer.size}%`,
            height: `${pointer.size}%`,
            borderRadius: `${pointer.radius}%`,
            transform: 'translate(-50%, -50%)',
            // Short transition only on the morph properties. Position is driven
            // per-move and must not lag the finger.
            transition:
              'width 110ms ease-out, height 110ms ease-out, border-radius 110ms ease-out',
          }}
        />
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
                ? 'border-edge/50 bg-carbon-body text-carbon-strong'
                : picked
                  ? 'anim-tick border-edge bg-steel-dark text-text-primary'
                  : 'border-edge bg-carbon-surface-2 text-text-primary active:scale-95',
            ].join(' ')}
            style={{
              left: `${pos.x - TILE / 2}%`,
              top: `${pos.y - TILE / 2}%`,
              width: `${TILE}%`,
              height: `${TILE}%`,
              transform: parallaxFor(i) || undefined,
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
