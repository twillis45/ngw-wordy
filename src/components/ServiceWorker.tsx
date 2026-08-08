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

    // Registering during load contends with the assets the game needs first.
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
