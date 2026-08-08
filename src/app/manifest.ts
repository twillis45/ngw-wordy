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
    name: 'Wordy',
    short_name: 'Wordy',
    description: 'Six letters. How many words can you make?',
    start_url: withBase('/'),
    scope: withBase('/'),
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#070809',
    theme_color: '#070809',
    categories: ['games', 'education'],
    icons: [
      { src: withBase('/icon-192.png'), sizes: '192x192', type: 'image/png' },
      { src: withBase('/icon-512.png'), sizes: '512x512', type: 'image/png' },
      {
        src: withBase('/icon-maskable-512.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
