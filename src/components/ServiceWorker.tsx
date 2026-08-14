'use client';

import { useEffect } from 'react';
import { withBase } from '@/lib/basePath';

/**
 * Registers the service worker in production only — in dev it would serve
 * stale bundles and make every change look like it did not apply.
 *
 * Renders nothing; this is exactly the "synchronize React with an external
 * system" case an effect is for.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      // Both the script URL and the scope must carry the base path, or the
      // worker registers at the origin root and controls nothing on Pages.
      navigator.serviceWorker
        .register(withBase('/sw.js'), { scope: withBase('/') })
        .catch(() => {
          /* offline support is an enhancement — never block the game on it */
        });
    };

    /*
     * A NEW WORKER TAKING OVER MEANS THIS PAGE IS ALREADY STALE.
     *
     * The worker calls skipWaiting and claims clients, so it starts serving
     * the new build immediately — but the page that triggered the update has
     * ALREADY loaded its CSS and JS from the previous cache. Nothing in that
     * sequence corrects the document you are looking at.
     *
     * Measured during a review: after a deploy it took TWO full reloads to see
     * the new stylesheet. The first re-registered the worker and still painted
     * the old assets; only the second picked them up. A player does not reload
     * twice, so they would sit on a superseded build for the whole session —
     * which is exactly the staleness this fix set out to remove, surviving one
     * layer down.
     *
     * `hadController` is the guard that makes this safe. On a FIRST-EVER visit
     * there is no controller, the worker claims the page, and reloading there
     * would be a gratuitous flash on a page that is already current. Only a
     * HANDOVER — one controller replacing another — means what is on screen is
     * out of date.
     */
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    const onControllerChange = () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      onControllerChange
    );

    // Registering during load contends with the assets the game needs first.
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => {
      window.removeEventListener('load', register);
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        onControllerChange
      );
    };
  }, []);

  return null;
}
