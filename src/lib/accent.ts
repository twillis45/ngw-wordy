'use client';

/**
 * Accent preference — a SEPARATE axis from light/dark.
 *
 * Modelled on lib/theme.ts, and deliberately not folded into it. Theme answers
 * "how bright is the page"; accent answers "what colour is the one accent
 * moment". They compose: matte-on-light and matte-on-dark are both real states,
 * so four combinations exist and none of them is a special case. Folding accent
 * into the Theme union would have made it six enum members that cannot express
 * "orange, follow the OS for brightness".
 *
 * Its own localStorage key for the same reason theme has one: the no-flash
 * script in <head> reads it before any bundle loads, so it cannot wait for a
 * store to hydrate or know its JSON shape.
 */
/*
 * NAMING, because it is now confusing and renaming it would be worse.
 *
 * 'matte' is the SHIPPED DEFAULT as of 2026-08-17 — orange in every theme,
 * which is what studio already was and what light and dark now match. 'default'
 * is therefore a misnomer: it is the green option, and it is the one that has
 * to be stored explicitly.
 *
 * The strings are not renamed because they are PERSISTED. Anyone carrying
 * `accent: "matte"` in localStorage keeps meaning orange, and a rename needs a
 * migration to buy nothing but a nicer identifier. The user-facing labels
 * below never say "default", so only this file has to hold the oddity.
 */
export type Accent = 'default' | 'matte' | 'tide' | 'plum';

export const ACCENT_KEY = 'ngw-wordy/accent';

/** Orange. What ships when the player has never chosen. */
export const DEFAULT_ACCENT: Accent = 'matte';

/**
 * Runs in <head> before first paint.
 *
 * An accent applied after hydration is not a flash, it is a COLOR CHANGE on
 * every solved row at once — worse than the dark-mode flash this pattern was
 * introduced for, because it lands on the part of the board the player is
 * looking at.
 *
 * The test is now INVERTED, because matte is the default: write the attribute
 * unless the player explicitly stored 'default'. Only the green option leaves
 * the stylesheet's own values standing.
 *
 * The read is its own try/catch so a storage failure still lands on matte.
 * Wrapping the whole thing meant a private-mode browser wrote no attribute and
 * rendered green while readAccent() below reported matte — the DOM and the
 * store disagreeing about the one thing this script exists to keep in step.
 */
export const NO_FLASH_SCRIPT =
  `var a=null;try{a=localStorage.getItem(${JSON.stringify(ACCENT_KEY)})}catch(e){}` +
  `if(a!=='default')document.documentElement.dataset.accent='matte';`;

const listeners = new Set<() => void>();
let snapshot: Accent = DEFAULT_ACCENT;
let hydrated = false;

export const ACCENT_ORDER: Accent[] = ['matte', 'default', 'tide', 'plum'];

function isAccent(v: unknown): v is Accent {
  return (ACCENT_ORDER as readonly unknown[]).includes(v);
}

/** Cycle for the settings control; wraps back to the shipped default. */
export function nextAccent(cur: Accent): Accent {
  return ACCENT_ORDER[(ACCENT_ORDER.indexOf(cur) + 1) % ACCENT_ORDER.length];
}

export function readAccent(): Accent {
  try {
    const v = localStorage.getItem(ACCENT_KEY);
    return isAccent(v) ? v : DEFAULT_ACCENT;
  } catch {
    // Private mode, or storage disabled. The default is a complete, correct
    // state, so this is not an error path — it is just the unset one.
    return DEFAULT_ACCENT;
  }
}

function onExternalChange(e: StorageEvent) {
  if (e.key !== null && e.key !== ACCENT_KEY) return;
  snapshot = readAccent();
  listeners.forEach((l) => l());
}

export function subscribeAccent(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', onExternalChange);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', onExternalChange);
    }
  };
}

export function getAccentSnapshot(): Accent {
  if (!hydrated && typeof window !== 'undefined') {
    hydrated = true;
    snapshot = readAccent();
  }
  return snapshot;
}

/**
 * Server render has no storage and must not guess — see theme.ts.
 *
 * It returns the DEFAULT rather than a fixed string, and that is load-bearing
 * now that the default is matte. The accent is rendered into markup (the
 * settings row prints ACCENT_LABELS[accent]), so this value IS the prerendered
 * text. Leaving it at 'default' would prerender "Signal green" while every
 * fresh client reads matte — React would hydrate one label and immediately
 * repaint another, which is the mismatch #7, #10 and #11 were about.
 *
 * A player who explicitly chose green still re-renders after hydration. That
 * is the supported useSyncExternalStore path: hydrate matching the HTML, then
 * re-render with the real answer.
 */
export function getAccentServerSnapshot(): Accent {
  return DEFAULT_ACCENT;
}

export function applyAccent(next: Accent): void {
  if (typeof document === 'undefined') return;
  if (next === 'matte') document.documentElement.dataset.accent = next;
  else delete document.documentElement.dataset.accent;
}

export function setAccent(next: Accent): void {
  snapshot = next;
  try {
    /*
     * Store the NON-default and clear the default, whichever that now is.
     * This used to remove the key for 'default' — which, once matte became the
     * default, would have meant choosing green wrote nothing and the player
     * came back to orange. The choice that differs from the shipped default is
     * the one worth persisting.
     */
    if (next === DEFAULT_ACCENT) localStorage.removeItem(ACCENT_KEY);
    else localStorage.setItem(ACCENT_KEY, next);
  } catch {
    /* storage unavailable — the accent still applies for this session */
  }
  applyAccent(next);
  listeners.forEach((l) => l());
}

export const ACCENT_LABELS: Record<Accent, string> = {
  default: 'Signal green',
  matte: 'Studio matte',
  tide: 'Tide',
  plum: 'Plum',
};

/*
 * WHY CYAN AND MAGENTA, and not two more warm colours.
 *
 * Green and orange — the two accents that already shipped — are the classic
 * deuteranopia confusion pair. A player with the commonest colour-vision
 * deficiency may not be able to tell the existing options apart at all, which
 * makes a choice between them no choice. 195° and 310° separate from both, and
 * from each other, under red-green deficiency.
 *
 * The accent is decoration rather than state, so this is not an accessibility
 * FIX — nothing in the game is identified by accent alone, per the kit's
 * commitment that meaning never rides on hue. It is the difference between
 * offering four options and offering four that a colour-blind player can
 * actually distinguish.
 */
