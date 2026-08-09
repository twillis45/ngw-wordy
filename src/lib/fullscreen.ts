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
