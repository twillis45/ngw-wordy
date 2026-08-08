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
};

const SIZE = 264; // px, the wheel's square box
const RADIUS = 95; // distance from center to a tile's center
const TILE = 56;
const HIT = 34; // px from a tile center that counts as "on" it

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
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const positions = letters.map((_, i) => {
    // Start at the top and go clockwise.
    const angle = (i / letters.length) * Math.PI * 2 - Math.PI / 2;
    return {
      x: SIZE / 2 + Math.cos(angle) * RADIUS,
      y: SIZE / 2 + Math.sin(angle) * RADIUS,
    };
  });

  const localPoint = useCallback((e: PointerEvent | React.PointerEvent) => {
    const box = boxRef.current;
    if (!box) return null;
    const r = box.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }, []);

  const hitTest = useCallback(
    (pt: { x: number; y: number }) => {
      for (let i = 0; i < positions.length; i += 1) {
        const dx = pt.x - positions[i].x;
        const dy = pt.y - positions[i].y;
        if (Math.hypot(dx, dy) <= HIT) return i;
      }
      return -1;
    },
    [positions]
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

  const pathPoints = selected.map((i) => positions[i]);

  return (
    <div
      ref={boxRef}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={endDrag}
      className="relative touch-none select-none"
      style={{ width: SIZE, height: SIZE }}
    >
      {/* Matte disc — depth comes from an inset ring, not a glow. */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full border border-carbon-border bg-carbon-panel"
        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
      />

      {/* Connection path. Drawn under the tiles so it reads as a thread. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0"
        width={SIZE}
        height={SIZE}
      >
        {pathPoints.length > 0 && (
          <polyline
            points={[
              ...pathPoints.map((p) => `${p.x},${p.y}`),
              ...(dragging && cursor ? [`${cursor.x},${cursor.y}`] : []),
            ].join(' ')}
            fill="none"
            stroke="var(--color-steel-muted)"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.65}
          />
        )}
      </svg>

      {letters.map((letter, i) => {
        const pos = positions[i];
        const order = selected.indexOf(i);
        const active = order !== -1;
        return (
          <button
            key={`${letter}-${i}`}
            type="button"
            disabled={disabled}
            aria-label={`Letter ${letter.toUpperCase()}${
              active ? `, selected position ${order + 1}` : ''
            }`}
            aria-pressed={active}
            onClick={() => {
              // Ignore the synthetic click that follows a drag.
              if (dragging) return;
              onSelect(i);
            }}
            className={[
              'absolute grid place-items-center rounded-2xl border font-bold',
              'transition-[transform,background-color,border-color] duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-steel-muted',
              active
                ? 'scale-105 border-steel bg-steel-dark text-text-primary'
                : 'border-carbon-strong bg-carbon-surface-2 text-text-primary active:scale-95',
            ].join(' ')}
            style={{
              left: pos.x - TILE / 2,
              top: pos.y - TILE / 2,
              width: TILE,
              height: TILE,
              fontSize: 26,
              boxShadow: active
                ? 'inset 0 1px 0 rgba(255,255,255,0.10)'
                : '0 2px 6px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            {letter.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
