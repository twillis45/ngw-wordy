'use client';

/**
 * Theme preference.
 *
 * Kept in its own localStorage key rather than the progress store, because the
 * no-flash script in the document head has to read it before any JS bundle
 * loads — it can't wait for the store to hydrate or know its JSON shape.
 */
export type Theme = 'auto' | 'light' | 'dark';

export const THEME_KEY = 'ngw-wordy/theme';

/**
 * Runs in <head> before first paint. Inlined as a string so an explicit choice
 * is applied to <html> before anything renders; without it a light-mode player
 * gets a dark flash on every load.
 *
 * 'auto' deliberately sets nothing — the CSS media query handles it, so the OS
 * can change under a running tab and the page follows.
 */
export const NO_FLASH_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_KEY
)});if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

/**
 * Theme as an external store.
 *
 * It lives in localStorage and on <html>, both outside React, and it can change
 * from another tab or from the OS while a tab is open. useSyncExternalStore is
 * the correct shape for that; a load effect that calls setState is not, and the
 * linter is right to reject it.
 */
const listeners = new Set<() => void>();
let snapshot: Theme = 'auto';
let hydrated = false;

export function subscribeTheme(listener: () => void): () => void {
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

function onExternalChange(e: StorageEvent) {
  if (e.key !== null && e.key !== THEME_KEY) return;
  snapshot = readTheme();
  listeners.forEach((l) => l());
}

export function getThemeSnapshot(): Theme {
  if (!hydrated && typeof window !== 'undefined') {
    hydrated = true;
    snapshot = readTheme();
  }
  return snapshot;
}

export function getThemeServerSnapshot(): Theme {
  return 'auto';
}

export function readTheme(): Theme {
  if (typeof window === 'undefined') return 'auto';
  const t = window.localStorage.getItem(THEME_KEY);
  return t === 'light' || t === 'dark' ? t : 'auto';
}

export function applyTheme(theme: Theme) {
  snapshot = theme;
  listeners.forEach((l) => l());

  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = theme;

  try {
    if (theme === 'auto') window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* private mode — the theme still applies for this session */
  }
}

/** What the page is actually showing right now, following the OS under 'auto'. */
export function effectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'auto') return theme;
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

/** auto -> light -> dark -> auto */
export function nextTheme(theme: Theme): Theme {
  return theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto';
}
