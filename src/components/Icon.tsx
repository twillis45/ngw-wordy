/**
 * The one icon convention.
 *
 * The set had drifted into three different drawing conventions living side by
 * side in the same header: stroked SVG (fullscreen/theme/sound), typographic
 * glyphs standing in for icons ("?", "›", "✓"), and — within the SVGs — two
 * stroke weights (2 vs 1.8) at three optical sizes (16/17/18). Four controls in
 * one 9px-tall row, no two drawn the same way, which is exactly the kind of
 * inconsistency you feel before you can name it.
 *
 * The convention below is the one most of the set already followed, so nothing
 * visibly lurches: a 24-unit grid, stroke only, no fill, currentColor, 1.8
 * weight, round caps and joins, one optical size.
 *
 * ONE optical size is deliberate. A shared 24-unit grid does not survive being
 * rendered at 16 in one slot and 18 in the next: the same 1.8 stroke lands at
 * 1.2px and 1.35px, so icons meant to be siblings pick up different apparent
 * weights. Fixing the render size fixes the rendered stroke.
 *
 * Glyph characters are not icons here. A font's "✓" carries the font's weight,
 * not ours, and shifts shape per platform — which is how the streak grid ended
 * up with a mark that no other icon in the product matched.
 */
import type { ReactNode } from 'react';

/** 24-unit grid: every path below is authored against it. */
const VIEW_BOX = '0 0 24 24';

/** One optical size, so the rendered stroke is identical in every slot. */
const SIZE = 18;

export function Icon({
  children,
  /**
   * Meaning-carrying icons pass a name and become an image to a screen reader.
   * Everything else stays aria-hidden — the default, because in this product
   * every icon sits inside a control that already carries the accessible name,
   * and a second name on the child would double-announce it.
   */
  label,
  className,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={VIEW_BOX}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {children}
    </svg>
  );
}

export function FullscreenIcon({ on }: { on: boolean }) {
  return (
    <Icon>
      {on ? (
        // Arrows pointing in — the way out.
        <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" />
      ) : (
        <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
      )}
    </Icon>
  );
}

export function SunIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </Icon>
  );
}

export function MoonIcon() {
  return (
    <Icon>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </Icon>
  );
}

export function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <Icon>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      {muted ? (
        <>
          <path d="m17 9 4 6" />
          <path d="m21 9-4 6" />
        </>
      ) : (
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      )}
    </Icon>
  );
}

/**
 * Was the literal character "?" set in the button. It sat between three stroked
 * SVGs and inherited font weight and metrics instead of the icon convention, so
 * it read heavier and sat a hair off the optical centre its neighbours shared.
 */
export function HelpIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.4 9.2a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.2-2.6 4" />
      <path d="M12 17.4h.01" />
    </Icon>
  );
}

/** Disclosure affordance. Was the character "›" in three different rows. */
export function ChevronIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="m9.5 5 7 7-7 7" />
    </Icon>
  );
}

/** Streak mark. Was the character "✓", i.e. whatever the platform font drew. */
export function CheckIcon() {
  return (
    <Icon>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Icon>
  );
}
