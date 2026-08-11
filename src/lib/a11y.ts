'use client';

/**
 * Display preferences: text size and reading comfort.
 *
 * The player board's accessibility wing found none of this in the preference
 * shape, and rated it ABOVE the streak in what must survive a device change —
 * a config that does not come across makes the new phone unplayable on arrival,
 * which is worse than losing a number.
 *
 * Kept in their own localStorage keys rather than the progress store, for the
 * same reason the theme is: the no-flash script in <head> has to apply them
 * before first paint. A theme applied late is a flash; a TEXT SIZE applied late
 * is a reflow — the whole board jumps once the bundle boots, which is worse.
 *
 * Type in this app is already six named roles in `rem`, so scaling the root
 * font size moves the entire ladder in proportion and nothing has to be
 * re-specced. That is the payoff for the earlier tokenisation work.
 */
export type TextScale = 'default' | 'large' | 'larger';
export type Reading = 'default' | 'relaxed';

export const TEXT_KEY = 'ngw-wordy/text';
export const READING_KEY = 'ngw-wordy/reading';

/** Root font size per step. 100% is the browser's own base, whatever the OS set. */
export const SCALE_PCT: Record<TextScale, number> = {
  default: 100,
  large: 115,
  larger: 132,
};

/**
 * Applied in <head> before first paint, for the reflow reason above.
 *
 * Deliberately writes the same attributes `apply*` writes, so there is one
 * shape to reason about rather than a head-script dialect and a runtime one.
 */
export const NO_FLASH_SCRIPT = `try{var d=document.documentElement;var s=localStorage.getItem(${JSON.stringify(
  TEXT_KEY
)});if(s==='large'||s==='larger'){d.dataset.text=s;d.style.fontSize=(s==='large'?115:132)+'%'}var r=localStorage.getItem(${JSON.stringify(
  READING_KEY
)});if(r==='relaxed')d.dataset.reading=r}catch(e){}`;

const listeners = new Set<() => void>();
let textSnap: TextScale = 'default';
let readSnap: Reading = 'default';
let hydrated = false;

function onExternalChange(e: StorageEvent) {
  if (e.key !== null && e.key !== TEXT_KEY && e.key !== READING_KEY) return;
  textSnap = readTextScale();
  readSnap = readReading();
  listeners.forEach((l) => l());
}

export function subscribeA11y(listener: () => void): () => void {
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

function hydrate() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  textSnap = readTextScale();
  readSnap = readReading();
}

export function getTextScale(): TextScale {
  hydrate();
  return textSnap;
}
export function getReading(): Reading {
  hydrate();
  return readSnap;
}
/** Both server snapshots are the defaults, so SSR and first paint agree. */
export function getTextServerSnapshot(): TextScale {
  return 'default';
}
export function getReadingServerSnapshot(): Reading {
  return 'default';
}

export function readTextScale(): TextScale {
  if (typeof window === 'undefined') return 'default';
  const v = window.localStorage.getItem(TEXT_KEY);
  return v === 'large' || v === 'larger' ? v : 'default';
}

export function readReading(): Reading {
  if (typeof window === 'undefined') return 'default';
  return window.localStorage.getItem(READING_KEY) === 'relaxed' ? 'relaxed' : 'default';
}

export function applyTextScale(scale: TextScale) {
  textSnap = scale;
  listeners.forEach((l) => l());
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (scale === 'default') {
    delete root.dataset.text;
    root.style.removeProperty('font-size');
  } else {
    root.dataset.text = scale;
    root.style.fontSize = `${SCALE_PCT[scale]}%`;
  }
  try {
    if (scale === 'default') window.localStorage.removeItem(TEXT_KEY);
    else window.localStorage.setItem(TEXT_KEY, scale);
  } catch {
    /* private mode — it still applies for this session */
  }
}

export function applyReading(mode: Reading) {
  readSnap = mode;
  listeners.forEach((l) => l());
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'default') delete root.dataset.reading;
  else root.dataset.reading = mode;
  try {
    if (mode === 'default') window.localStorage.removeItem(READING_KEY);
    else window.localStorage.setItem(READING_KEY, mode);
  } catch {
    /* private mode */
  }
}

export const TEXT_ORDER: TextScale[] = ['default', 'large', 'larger'];
export const TEXT_LABEL: Record<TextScale, string> = {
  default: 'Default',
  large: 'Large',
  larger: 'Largest',
};

/** Next step in the cycle, so one control can carry all three. */
export function nextTextScale(current: TextScale): TextScale {
  return TEXT_ORDER[(TEXT_ORDER.indexOf(current) + 1) % TEXT_ORDER.length];
}
