'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  letters: string[];
  /** Indices currently selected, in the order they were picked. */
  selected: number[];
  onSelect: (index: number) => void;
  onCommit: () => void;
  onClear: () => void;
  /** Remove the last-picked letter — the tap path's Backspace. */
  onUndo: () => void;
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
/*
 * Selection radius — deliberately matched to where the pointer LOOKS committed.
 *
 * This was 13 while positional attraction starts at PULL (21), so between 13
 * and 21 the glass pointer was drawn most of the way onto a tile — at 14% away
 * it is ~93% of the way there, visually merged with the letter — and a click
 * still did nothing. On desktop, where the OS cursor is hidden and the glass
 * pointer IS your cursor, that is not "tuning": you aim with the pointer, the
 * pointer says you are on the letter, and the game disagrees. It reads as taps
 * not registering.
 *
 * 15 is where the pull curve crosses ~0.85, i.e. where it starts looking
 * committed. Tiles sit 36% apart at six letters, so anything up to 18 is still
 * unambiguous — there is forgiveness available here and it was not being spent.
 */
const HIT = 15; // % from a tile center that counts as "on" it

/**
 * iPadOS pointer geometry.
 *
 * MAGNET is the hit REGION, deliberately wider than the tile: Apple's pointer
 * starts transforming before it visibly touches a control, "creating the
 * illusion that the element is pulling the pointer toward it". Morphing only
 * once you're already on the tile would feel like a snap, not a magnet.
 */
/*
 * Where the SHAPE starts to morph. The ramp is MAGNET - HIT wide, and that
 * width is the whole point: raising HIT to 15 while this sat at 16 left a ONE
 * PERCENT ramp, so the morph became a step — 13px of size appearing from a
 * hair of mouse movement, which reads as the puck jumping.
 *
 * 19 gives a 4% ramp. Tiles are 36% apart, so the midpoint between two is 18%
 * from each: there the puck is only ~16% morphed, which keeps the free circle
 * genuinely visible between letters — the property the original 16 was
 * protecting.
 */
const MAGNET = 19; // % — where the SHAPE starts to morph
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
const PULL_BITE = 1.7;
/** Ceiling on attraction OUTSIDE the selection radius — see `pull` below. */
const PULL_CAP = 0.66; // >1 = weak at the edge, sharply stronger near the tile
/*
 * The untargeted pointer reads as a lens over the board, so it has to be big
 * enough to feel like it could hold a letter. At 11 it was half a tile — a dot,
 * not a lens.
 */
const FREE = 15; // % — diameter of the untargeted pointer
const TILE_RADIUS_PCT = 28; // rounded-2xl on a tile, as % of tile size
/**
 * How far the pointer must travel before a press counts as a drag, in % of
 * the dial. Tiles sit 36% apart, so 3% is far below "moved toward a
 * neighbour" and comfortably above the jitter of a thumb resting on glass.
 */
const DRAG_SLOP = 3;
/** Shortest scoreable word — mirrors MIN_LEN in the puzzle generator. */
const MIN_WORD = 3;
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
  onUndo,
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
  /*
   * Magnetism is a TOUCH affordance, and on a mouse it is actively wrong.
   *
   * With `mouse:cursor-none` the glass shape IS the cursor, so positional
   * attraction means the thing you are steering slides sideways on its own
   * while you are trying to aim it. On a finger that reads as the tile pulling
   * you in; on a mouse it reads as the cursor being taken away from you.
   */
  const [byMouse, setByMouse] = useState(false);

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

  /**
   * A press is not yet a drag.
   *
   * This component claimed "two input paths, both first-class: drag… tap a
   * tile". Only one existed. `handleDown` used to enter drag state on
   * pointerdown, so pointerup ran `onCommit` — meaning a single TAP cleared
   * the word, selected one letter, and submitted it. "Too short." Every tap
   * after that wiped the one before, so there was no way to build a word
   * without a sustained multi-target drag, and no submit control anywhere.
   *
   * That made the game unplayable with VoiceOver, TalkBack, Switch Control or
   * any tremor, and it is where a first-time player quits — six round glossy
   * tiles are the most button-looking things on the screen, and pressing one
   * returned a scolding.
   *
   * So: pointerdown only ARMS a gesture. It becomes a drag on movement past a
   * threshold; otherwise pointerup leaves it alone and the tile's own click
   * handler appends the letter. Click also covers keyboard and AT activation
   * for free, which is why the tap path lives there rather than in pointerup.
   */
  const armed = useRef<{ x: number; y: number; i: number } | null>(null);
  /** Set when a gesture became a drag, so the trailing click is ignored. */
  const dragged = useRef(false);
  /** Pointer id to capture IF this gesture becomes a drag. */
  const capturedId = useRef<number | null>(null);

  const handleDown = (e: React.PointerEvent) => {
    if (disabled) return;
    const pt = localPoint(e);
    if (!pt) return;
    const hit = hitTest(pt);
    if (hit === -1) return;
    /*
     * NO pointer capture here, and no preventDefault. Both kill the tap.
     *
     * Capturing on pointerdown retargets the subsequent pointerup to the
     * CONTAINER, so the browser computes `click` against the container rather
     * than the tile — and the tile's onClick never runs. That is why clicking
     * a letter did nothing on desktop while a synthetic element.click() in a
     * test passed: the synthetic call skips the real event flow entirely, so
     * it could not see this.
     *
     * Capture is only needed to keep a DRAG alive outside the box, so it is
     * taken at the moment a drag actually starts (see handleMove) and not a
     * moment earlier.
     */
    capturedId.current = e.pointerId;
    setByMouse(e.pointerType === 'mouse');
    armed.current = { x: pt.x, y: pt.y, i: hit };
    dragged.current = false;
    setCursor(pt);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (disabled) return;
    const pt = localPoint(e);
    if (!pt) return;

    if (!dragging) {
      const start = armed.current;
      if (start) {
        setCursor(pt);
        // Promote to a drag only once the pointer has actually travelled.
        if (Math.hypot(pt.x - start.x, pt.y - start.y) > DRAG_SLOP) {
          dragged.current = true;
          // Now it is a drag, so keep it alive if the pointer leaves the box.
          if (capturedId.current !== null) {
            try {
              boxRef.current?.setPointerCapture(capturedId.current);
            } catch {
              // Capture is an optimisation; losing it only costs us tracking
              // outside the element, and it throws if the pointer went away.
            }
          }
          setDragging(true);
          // The path begins at the tile that was pressed, not at wherever the
          // pointer happened to cross the threshold.
          onClear();
          onSelect(start.i);
          const hit = hitTest(pt);
          if (hit !== -1) onSelect(hit);
        }
        return;
      }
      // Track the mouse even when nothing is held down.
      if (e.pointerType === 'mouse') {
        setHovering(true);
        setByMouse(true);
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
    armed.current = null;
    capturedId.current = null;
    if (!dragging) {
      // A tap. Leave the selection alone — the click handler appends.
      setCursor(null);
      return;
    }
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

    /*
     * The resting size is computed ONCE, because it is used by two branches
     * and they were disagreeing.
     *
     * The untargeted branch returned a bare FREE while the targeted branch
     * applied the desktop boost, so crossing the attraction boundary popped
     * the puck 25% larger with the mouse perfectly still. The centre never
     * moved — which is why measuring drift kept reporting zero — but a shape
     * that changes size on its own still reads as the pointer moving, and it
     * fires exactly as you approach a letter.
     */
    const rest = byMouse ? FREE * 1.25 : FREE;

    if (nearest === -1 || best > PULL) {
      return { x: cursor.x, y: cursor.y, size: rest, radius: 50, target: -1, t: 0, pull: 0 };
    }

    /*
     * Positional attraction: begins early, bites hard as you close in — but is
     * CAPPED outside the selection radius.
     *
     * Without the cap the pointer reached ~0.88 of the way onto a tile it would
     * refuse to select, so it visually merged with a letter that was not
     * actually yours. On desktop the OS cursor is hidden and this glass shape
     * IS the cursor, so that is the pointer lying about where you are — the
     * clicks-do-nothing complaint.
     *
     * Now the pull reads honestly: outside the radius it says "being drawn
     * toward", and only inside does it say "on it".
     */
    const pRaw = Math.min(1, (PULL - best) / (PULL - HIT));
    const eased = Math.pow(pRaw * pRaw * (3 - 2 * pRaw), PULL_BITE);
    const pull = byMouse ? 0 : best <= HIT ? 1 : Math.min(eased, PULL_CAP);

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
      // Slightly larger than the tile so the committed state visibly
      // ENCOMPASSES the whole letter rather than sitting exactly on top of it,
      // which reads as a coincidence rather than a lock.
      // Bigger on a mouse: this is standing in for the OS cursor, so it has
      // to be findable at a glance on a 1728px screen. Same `rest` as the
      // untargeted branch, so there is no step where they meet.
      size: at(rest, TILE * 1.14, t),
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
      // shortwide:max-h — on a landscape tablet the board column's height isn't
      // definite (the md grid sizes it from content), so `height: 100%` has
      // nothing to resolve against and the wheel takes the full 296px cap:
      // 96px more than that screen has to give, and the controls go off the
      // bottom. An explicit ceiling is the only thing that binds there.
      className="relative aspect-square touch-none select-none shortwide:max-h-[200px] mouse:cursor-none"
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
      style={{
        // Sized from the HEIGHT its flex parent leaves over, not from a vh
        // bucket. A bucket can't win: `26vh` under a `max-height: 800px` rule
        // covers 568 through 800, so a 737-tall phone got the same ratio as a
        // 568 one and 101px of slack pooled in a spacer above the wheel.
        // Growing into the leftover instead means the void cannot exist at any
        // viewport, and the hero gets the space rather than nothing getting it.
        //
        // Capping HEIGHT by 78vw is what keeps a narrow phone honest — the box
        // is square, so a height cap is a width cap. Width stays `auto` so
        // aspect-ratio derives it; setting both would be a conflict the browser
        // resolves by dropping the ratio.
        height: 'clamp(150px, min(100%, 78vw), 296px)',
        width: 'auto',
        aspectRatio: '1',
        /*
         * Makes the dial a query container so the LETTERS can be sized from
         * it (13.7cqmin on each tile). The type was a fixed `text-hero`
         * while the dial became fluid, so it was proportionally wrong at both
         * ends — nearly filling a 31.8px tile on a small phone, undersized in
         * a 62.7px tile on a tablet.
         *
         * Safe for the glass: `container-type` implies `contain: layout size
         * style`, and it is `contain: PAINT` that establishes a backdrop root.
         * Verified by measuring the tiles' backdrop-filter after the change —
         * this is the same trap the pointer's `transform` fell into.
         */
        containerType: 'size',
      }}
    >
      {/* Matte disc — depth comes from an inset ring, not a glow. */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full border-2 border-edge liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)]"
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
            /*
             * Anchored at the pointer, centred by NEGATIVE MARGIN — not by
             * subtracting half the size from left/top.
             *
             * That subtraction is why the puck drifted when a letter was
             * selected: `left` jumped to its new value the instant the size
             * changed, while `width` eased over 110ms, so the visual centre
             * slid several pixels through every morph. Margin changes in
             * lockstep with size instead, so the centre holds still.
             *
             * cqmin, because the dial is a square query container — 1cqmin is
             * 1% of it, so these are the same numbers the geometry already uses,
             * and a margin in cqmin resolves against the container rather than
             * against the ambiguous percentage basis.
             */
            left: `${pointer.x}%`,
            top: `${pointer.y}%`,
            width: `${pointer.size}cqmin`,
            height: `${pointer.size}cqmin`,
            marginLeft: `${-pointer.size / 2}cqmin`,
            marginTop: `${-pointer.size / 2}cqmin`,
            borderRadius: `${pointer.radius}%`,
            // Size and its centring margin ease together; position never eases,
            // so the puck cannot lag the pointer.
            transition:
              'width 110ms ease-out, height 110ms ease-out, margin-left 110ms ease-out, margin-top 110ms ease-out, border-radius 110ms ease-out',
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

      {/*
        The submit control. There wasn't one.
        Committing was reachable only by ending a drag or pressing Enter, so on
        a touch device with no keyboard the drag was the ONLY way to enter a
        word. This lives in the dial's dead centre: it costs no layout on a
        board we already had to fight for vertical space on, it is inside the
        thumb arc, and it appears only once there is something to submit.
      */}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={onCommit}
          disabled={disabled || selected.length < MIN_WORD}
          aria-label={
            selected.length < MIN_WORD
              ? `Word too short — ${MIN_WORD} letters minimum`
              : 'Submit word'
          }
          className={[
            'absolute left-1/2 top-1/2 z-10 grid -translate-x-1/2 -translate-y-1/2',
            'place-items-center rounded-full border-2 font-semibold uppercase',
            'tracking-[0.08em] transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-steel-muted',
            selected.length < MIN_WORD
              ? 'border-edge-hairline text-text-muted'
              : 'border-edge bg-steel-dark/60 text-text-primary active:scale-95',
          ].join(' ')}
          style={{
            width: '30%',
            height: '30%',
            fontSize: '7cqmin',
            // Matches the tiles: sized from the dial so it scales with it.
          }}
        >
          {selected.length < MIN_WORD ? `${selected.length}/${MIN_WORD}` : 'Enter'}
        </button>
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
              if (locked) return;
              // Ignore the synthetic click that follows a drag.
              if (dragged.current) {
                dragged.current = false;
                return;
              }
              // Tapping the letter you added last takes it back, so the tap
              // path has an undo without needing a keyboard Backspace.
              if (selected.length > 0 && selected[selected.length - 1] === i) {
                onUndo();
                return;
              }
              onSelect(i);
            }}
            className={[
              // leading-none is load-bearing, not tidying: the inherited 1.5
              // line-height gave a 26px letter a 39px line box inside a 36.4px
              // tile. The box was TALLER than the tile it was centred in, so it
              // overflowed the bottom and sat every glyph 3.07px low. Measured
              // horizontal offset was already 0.00 — only the vertical was off,
              // which is exactly the signature of a line box, not a grid.
              'absolute grid place-items-center rounded-2xl border-2 font-bold leading-none',
              'transition-[transform,background-color,border-color] duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-steel-muted',
              // anim-tick both pulses on selection and holds the selected
              // scale, so there's no transform utility fighting the keyframes.
              // A locked tile is DIM, not blank. `text-carbon-strong` on this
              // fill measured 1.32:1 — the letter was rendered and invisible,
              // so a locked puck read as an empty one and the mode looked
              // broken. It also defeated this component's whole premise: the
              // letters stay on the wheel so you can see what's coming.
              // Muted text is 5.53:1 here against the active tile's 13.33:1,
              // which is a legible letter that still plainly isn't yours yet.
              locked
                ? 'border-edge/60 liquid backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] text-text-muted'
                : picked
                  ? 'anim-tick border-edge bg-steel-dark/70 text-text-primary backdrop-blur-[var(--glass-blur)]'
                  : 'border-edge liquid liquid-raised backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] text-text-primary active:scale-95',
            ].join(' ')}
            style={{
              left: `${pos.x - TILE / 2}%`,
              top: `${pos.y - TILE / 2}%`,
              width: `${TILE}%`,
              height: `${TILE}%`,
              // A constant fraction of the dial (see container-type above), so
              // the letter keeps the same relationship to its tile at every
              // size — everything else here is already a percentage of the
              // container, and the type was the one thing that wasn't.
              fontSize: '13.7cqmin',
              transform: parallaxFor(i) || undefined,
              transitionProperty: 'transform, background-color, border-color',
              transitionDuration: '120ms',
              // Only the non-glass states set a shadow here. A resting tile
              // carries `.liquid-raised`, whose rim/caustic/contact stack IS
              // the glass — and an inline shadow silently outranks it, which
              // is what flattened the wheel back to a plain drop shadow.
              boxShadow: locked
                ? 'none'
                : picked
                  ? 'var(--tile-shadow-active)'
                  : undefined,
            }}
          >
            {letter.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
