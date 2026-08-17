import type { MetadataRoute } from 'next';
import { withBase } from '@/lib/basePath';

// Metadata routes are dynamic by default; `output: 'export'` requires this to
// be explicit or the build fails collecting page data.
export const dynamic = 'force-static';

/**
 * Manifest fields are NOT rewritten by Next's basePath — they're plain data,
 * so start_url and every icon src has to be prefixed explicitly or an
 * installed app launches into a 404 on GitHub Pages.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    /*
     * `id` is the app's permanent identity to the browser. Without it the id
     * defaults to start_url, so the day start_url changes — adding a query
     * param, moving off the Pages sub-path onto the real domain — the browser
     * treats the deploy as a DIFFERENT app: the installed icon stops updating
     * and a second install appears beside it. It is resolved against the
     * origin like a URL, hence withBase.
     */
    id: withBase('/'),
    name: 'Six on the Dial — six-letter word game',
    /*
     * Home-screen label, where ~12 characters survive. The full name is 15
     * and truncates to "Six on th…" on iOS, so the label is the game's own
     * nickname for its wheel. Change here and in appleWebApp.title together.
     */
    short_name: 'The Dial',
    description:
      'A six-letter word game with hand-authored puzzles: find every word on the wheel, and read the clue behind the board.',
    start_url: withBase('/'),
    scope: withBase('/'),
    lang: 'en-US',
    dir: 'ltr',
    // fullscreen first, then degrade — an installed player gets the whole
    // screen, and anything that can't honour it falls back cleanly.
    display: 'fullscreen',
    display_override: ['fullscreen', 'standalone', 'minimal-ui'],
    orientation: 'portrait',
    background_color: '#070809',
    theme_color: '#070809',
    categories: ['games', 'education'],
    /*
     * `purpose` is stated on every entry. It defaults to "any", so omitting it
     * is harmless in isolation — but an installer that finds only untagged
     * icons will letterbox one inside its own shape, and one that finds only
     * maskable icons will draw the safe-zone padding on a plain surface. Both
     * sets, both labelled, is the only combination that is right everywhere.
     */
    icons: [
      {
        src: withBase('/icon-192.png'),
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: withBase('/icon-512.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: withBase('/icon-maskable-192.png'),
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: withBase('/icon-maskable-512.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
