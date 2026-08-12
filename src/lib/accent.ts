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
export type Accent = 'default' | 'matte';

export const ACCENT_KEY = 'ngw-wordy/accent';

/**
 * Runs in <head> before first paint.
 *
 * An accent applied after hydration is not a flash, it is a COLOUR CHANGE on
 * every solved row at once — worse than the dark-mode flash this pattern was
 * introduced for, because it lands on the part of the board the player is
 * looking at. 'default' deliberately writes nothing, so the stylesheet's own
 * values stand and there is no attribute to strip.
 */
export const NO_FLASH_SCRIPT = `try{var a=localStorage.getItem(${JSON.stringify(
  ACCENT_KEY
)});if(a==='matte')document.documentElement.dataset.accent=a}catch(e){}`;

const listeners = new Set<() => void>();
let snapshot: Accent = 'default';
let hydrated = false;

function isAccent(v: unknown): v is Accent {
  return v === 'default' || v === 'matte';
}

export function readAccent(): Accent {
  try {
    const v = localStorage.getItem(ACCENT_KEY);
    return isAccent(v) ? v : 'default';
  } catch {
    // Private mode, or storage disabled. The default is a complete, correct
    // state, so this is not an error path — it is just the unset one.
    return 'default';
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

/** Server render has no storage and must not guess — see theme.ts. */
export function getAccentServerSnapshot(): Accent {
  return 'default';
}

export function applyAccent(next: Accent): void {
  if (typeof document === 'undefined') return;
  if (next === 'matte') document.documentElement.dataset.accent = next;
  else delete document.documentElement.dataset.accent;
}

export function setAccent(next: Accent): void {
  snapshot = next;
  try {
    if (next === 'default') localStorage.removeItem(ACCENT_KEY);
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
};
