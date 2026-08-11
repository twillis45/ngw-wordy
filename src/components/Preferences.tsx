'use client';

import { useEffect } from 'react';
import { applyReading, applyTextScale, readReading, readTextScale } from '@/lib/a11y';
import { applyTheme, readTheme } from '@/lib/theme';

/**
 * Re-apply display preferences once React has hydrated.
 *
 * The no-flash scripts in <head> set `data-theme`, `data-text` and an inline
 * font-size on <html> before first paint, and they work — verified through
 * `load`. Then React hydrates, reconciles the <html> element it rendered, and
 * strips every attribute it does not know about. Measured on the built export:
 *
 *   ready:interactive   theme=light  text=larger  fontSize=132%
 *   DOMContentLoaded    theme=light  text=larger  fontSize=132%
 *   load                theme=light  text=larger  fontSize=132%
 *   after hydration     null         null         null
 *
 * `suppressHydrationWarning` is already on <html>; it silences the WARNING and
 * does not stop the reconciliation. So the preference has to be written a
 * second time, after React has finished having its opinion about the element.
 *
 * This is not only the new text settings — the THEME has been losing itself on
 * every reload the same way, which is why a light-mode player kept landing back
 * on dark. The head scripts are still required: without them the correct value
 * arrives one frame late, which is a flash for the theme and a full reflow of
 * the board for text size.
 */
export default function Preferences() {
  useEffect(() => {
    applyTheme(readTheme());
    applyTextScale(readTextScale());
    applyReading(readReading());
  }, []);

  return null;
}
