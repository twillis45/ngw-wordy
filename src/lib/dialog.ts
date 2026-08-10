'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * Modal behaviour that `role="dialog"` alone does not give you.
 *
 * The sheets and the first-run overlay had none of it: focus was never moved
 * in, Tab walked straight out into the board behind, Escape did nothing, and
 * the intro's only dismiss target was a non-focusable `<div>` — so a
 * keyboard-only player was stuck behind it on first launch with no way out.
 *
 * `inert` on the background is what actually makes the rest of the page
 * unreachable to a screen reader and to Tab; `aria-modal` is a hint that
 * assistive tech may or may not honour, and it does nothing for keyboard.
 *
 * Returns a ref to put on the dialog container.
 */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useDialog(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  // Kept in a ref so changing the handler identity can't re-run the setup
  // effect and steal focus back mid-interaction. Synced in an effect rather
  // than during render — a ref write during render is not a safe read/write.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Make everything outside the dialog unreachable. Siblings rather than
    // <main> specifically, so nested/stacked dialogs don't disable each other.
    const siblings: HTMLElement[] = [];
    for (const el of Array.from(document.body.children)) {
      if (el === node.parentElement || el.contains(node)) continue;
      if (!(el instanceof HTMLElement)) continue;
      if (el.hasAttribute('inert')) continue;
      el.setAttribute('inert', '');
      siblings.push(el);
    }

    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );

    /*
     * Focus the dialog itself rather than its first control: announcing the
     * dialog's label before its contents is the behaviour screen-reader users
     * expect, and it avoids landing on a destructive control by accident.
     *
     * UNLESS the dialog names a primary action. The first-run explainer is the
     * case that forced this: it has exactly one control, "Start playing", and
     * with focus parked on the container Enter did nothing at all. A player
     * arriving by keyboard met a full-screen overlay that Escape closed and
     * Enter — the key everyone reaches for — did not. It is also how the
     * failure was found: a scripted key press could not get past the first
     * screen of the game.
     *
     * Marking the action rather than "focus the first/last focusable" keeps it
     * explicit, so a future dialog with a destructive control does not inherit
     * a default that lands on it.
     */
    const primary = node.querySelector<HTMLElement>('[data-dialog-primary]');
    (primary ?? node).focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === node)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    // Capture phase: the game's window-level key handler must not see keys
    // aimed at a dialog. Space was shuffling the wheel behind an open sheet,
    // and every letter key was selecting tiles the player couldn't see.
    node.addEventListener('keydown', onKeyDown);
    return () => {
      node.removeEventListener('keydown', onKeyDown);
      for (const el of siblings) el.removeAttribute('inert');
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, []);

  return ref;
}

/** True when any modal dialog is currently mounted. */
export function dialogOpen() {
  if (typeof document === 'undefined') return false;
  return !!document.querySelector('[role="dialog"]');
}

/**
 * Renders children into `document.body`.
 *
 * Dialogs were rendered inline inside `<main>`, which makes the background
 * impossible to make inert — an element cannot disable its own ancestor, so
 * `inert` silently did nothing and Tab still walked out into the board.
 * Portalling makes `<main>` a sibling, which is what lets it be switched off.
 *
 * Returns null until mounted: `createPortal` needs a real document, and this
 * app is statically exported, so the first render happens on the server.
 */
const noopSubscribe = () => () => {};

export function useMounted() {
  // useSyncExternalStore rather than setState-in-an-effect: the client
  // snapshot is `true` and the SERVER snapshot is `false`, which is exactly
  // the "am I on the client yet" question, expressed without a cascading
  // render. Same pattern the progress, theme and fullscreen stores use here.
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}
