'use client';

/**
 * Viewport queries as external stores.
 *
 * Same shape as the theme store, and for the same reason: a media query lives
 * outside React and changes without us (rotation, window resize, a keyboard
 * appearing). Reading it in an effect would mean a hydration-unsafe guess and
 * a setState cascade; useSyncExternalStore is the correct tool.
 */
const stores = new Map<
  string,
  { mql: MediaQueryList; listeners: Set<() => void>; value: boolean }
>();

function store(query: string) {
  let s = stores.get(query);
  if (!s) {
    const mql = window.matchMedia(query);
    s = { mql, listeners: new Set(), value: mql.matches };
    mql.addEventListener('change', () => {
      s!.value = s!.mql.matches;
      s!.listeners.forEach((l) => l());
    });
    stores.set(query, s);
  }
  return s;
}

export function subscribeMedia(query: string) {
  return (listener: () => void) => {
    if (typeof window === 'undefined') return () => {};
    const s = store(query);
    s.listeners.add(listener);
    return () => s.listeners.delete(listener);
  };
}

export function mediaSnapshot(query: string) {
  return () => {
    if (typeof window === 'undefined') return false;
    return store(query).value;
  };
}

export const mediaServerSnapshot = () => false;

/**
 * Below this the full tray does not fit alongside the wheel and controls.
 *
 * Measured, not guessed: at 320x568 the page overflowed by 239px with the tray
 * at its smallest and the wheel already on its floor. The six stacked rows are
 * ~200px of that, and the compact row that clue mode already uses is ~34px —
 * so the fix is to reuse it rather than shave every margin to nothing.
 */
export const SHORT_VIEWPORT = '(max-height: 800px)';
