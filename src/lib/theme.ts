'use client';

/**
 * Theme preference.
 *
 * Kept in its own localStorage key rather than the progress store, because the
 * no-flash script in the document head has to read it before any JS bundle
 * loads — it can't wait for the store to hydrate or know its JSON shape.
 */
/**
 * 'studio' is the LOCKED Studio Matte palette, and it is a fourth member rather
 * than a tweak to 'dark' because the two disagree about one specific thing.
 *
 * The whole app is already Studio Matte — globals.css opens by saying so, and
 * names the bans it inherits from the NGW system: no #f0bc44, no #e08c38, no
 * warm gold as a hierarchy accent. 'dark' then takes one deliberate exception,
 * the selection amber, argued at length in that file: on a board of desaturated
 * blue-greys a selected tile could only ever be a lighter shade, never a
 * different thing, so it leaves the hue family on purpose.
 *
 * 'studio' keeps those surfaces and swaps the accent moment from green to
 * orange. That is the move globals.css already argues for at the
 * [data-accent='matte'] block: the confidence-hierarchy rule is that ONE thing
 * on screen is saturated, so REPLACING the accent with orange respects it,
 * while adding orange alongside green would not. Warm gold is banned as a
 * hierarchy accent, not as the accent itself.
 *
 * A fourth theme rather than a redefinition of 'dark', because 'dark' is what
 * everyone already using the game has, and its green is load-bearing there.
 */
export type Theme = 'auto' | 'light' | 'dark' | 'studio';

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
)});if(t==='light'||t==='dark'||t==='studio')document.documentElement.dataset.theme=t}catch(e){}`;

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
  return t === 'light' || t === 'dark' || t === 'studio' ? t : 'auto';
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

/**
 * What the page is actually showing right now, following the OS under 'auto'.
 *
 * 'studio' answers 'dark': callers use this to pick between a light and a dark
 * ASSET — the share card, an icon — and Studio Matte is a dark palette. Adding
 * it to the return type would push a third case onto every one of those call
 * sites to describe a distinction none of them cares about.
 */
export function effectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'studio') return 'dark';
  if (theme !== 'auto') return theme;
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

/**
 * The OS colour scheme, as a store the render can read safely.
 *
 * `effectiveTheme('auto')` asks matchMedia during render and answers 'dark' on
 * the server, because the server has no OS to ask. Any visitor whose system is
 * set to LIGHT therefore drew a sun where the prerendered HTML had a moon, and
 * React threw away the page. It passed on a dark-mode laptop and failed on a
 * light-mode CI runner, which is how it stayed hidden.
 *
 * The server snapshot is 'dark' deliberately: it must agree with what
 * effectiveTheme already writes into the HTML, or the fix would introduce the
 * mismatch it removes. Light-mode visitors get one silent re-render, which is
 * what useSyncExternalStore is for.
 */
export function systemScheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function systemSchemeServer(): 'light' | 'dark' {
  return 'dark';
}

/** Unlike a capability, this one really does change - the OS toggle at dusk. */
export function subscribeSystemScheme(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  mq.addEventListener('change', listener);
  return () => mq.removeEventListener('change', listener);
}

/** auto -> light -> dark -> studio -> auto */
export function nextTheme(theme: Theme): Theme {
  return theme === 'auto'
    ? 'light'
    : theme === 'light'
      ? 'dark'
      : theme === 'dark'
        ? 'studio'
        : 'auto';
}
