'use client';

/**
 * Fullscreen takeover.
 *
 * Installed as a PWA the manifest already handles this, but most players
 * arrive in a browser tab, where address and toolbars eat ~15% of a phone
 * screen — on a layout budgeted to the pixel for 375x812, that is the
 * difference between fitting and scrolling.
 *
 * Requesting fullscreen must happen inside a user gesture, so this is a
 * control the player presses, never something that fires on load.
 */
export function fullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void>;
  };
  return Boolean(
    document.fullscreenEnabled ||
      el.webkitRequestFullscreen ||
      // iOS Safari on iPhone exposes neither; installing is the route there.
      false
  );
}

/**
 * The same answer, safe to ask during render.
 *
 * `fullscreenSupported()` says false on the server and true in most browsers,
 * so calling it in a component body renders a header the prerendered HTML does
 * not have. It did, and EVERY load of the export died on React error #418 —
 * "the server rendered HTML didn't match the client" — and silently rebuilt
 * the whole tree on the client. The prerender was being paid for at build time
 * and thrown away at run time, invisibly, which is why it lasted.
 *
 * `useSyncExternalStore` exists for exactly this: it hydrates against
 * `supportedSnapshotServer` so the first client render matches the HTML, then
 * re-renders with the real answer. Support cannot change after load, so the
 * subscribe half has nothing to listen to and never fires.
 *
 *   const canFullscreen = useSyncExternalStore(
 *     subscribeSupport, fullscreenSupported, supportedSnapshotServer
 *   );
 */
export { subscribeNever as subscribeSupport } from './storage';

export function supportedSnapshotServer(): boolean {
  return false;
}

export function isFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const d = document as Document & { webkitFullscreenElement?: Element | null };
  return Boolean(document.fullscreenElement || d.webkitFullscreenElement);
}

export async function toggleFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return;
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void>;
  };
  const d = document as Document & {
    webkitExitFullscreen?: () => Promise<void>;
  };

  try {
    if (isFullscreen()) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
      return;
    }
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  } catch {
    /* denied or unsupported — the game is unaffected */
  }
}

const AUTO_KEY = 'ngw-wordy/fullscreen-auto';

/**
 * Enter fullscreen at the earliest moment a browser will allow it.
 *
 * There is no way to do this on load — every browser rejects a fullscreen
 * request that isn't inside a user gesture, by design. The first tap or key
 * press IS a gesture, so that is the earliest honest opportunity.
 *
 * It fires once, and if the player ever leaves fullscreen we stop asking. An
 * app that keeps dragging you back is worse than one that never offered.
 */
export function autoFullscreenOnFirstGesture(): () => void {
  if (typeof document === 'undefined') return () => {};
  if (!fullscreenSupported()) return () => {};

  try {
    if (window.localStorage.getItem(AUTO_KEY) === 'off') return () => {};
  } catch {
    /* private mode — just proceed */
  }

  const go = () => {
    cleanup();
    if (isFullscreen()) return;
    void toggleFullscreen();
  };

  // `once` on each, plus an explicit cleanup so a second gesture never retries.
  const events: Array<keyof DocumentEventMap> = ['pointerdown', 'keydown'];
  const cleanup = () => {
    events.forEach((e) => document.removeEventListener(e, go));
  };
  events.forEach((e) => document.addEventListener(e, go, { once: true }));

  return cleanup;
}

/** Remember that the player left, so we stop pulling them back in. */
export function rememberFullscreenExit() {
  try {
    if (!isFullscreen()) window.localStorage.setItem(AUTO_KEY, 'off');
  } catch {
    /* nothing to do */
  }
}

/** Subscribe to fullscreen changes from any source, including Esc. */
export function subscribeFullscreen(listener: () => void): () => void {
  if (typeof document === 'undefined') return () => {};
  document.addEventListener('fullscreenchange', listener);
  document.addEventListener('webkitfullscreenchange', listener);
  return () => {
    document.removeEventListener('fullscreenchange', listener);
    document.removeEventListener('webkitfullscreenchange', listener);
  };
}
