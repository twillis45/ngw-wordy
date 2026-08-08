import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Wordy',
    short_name: 'Wordy',
    description: 'Six letters. How many words can you make?',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#070809',
    theme_color: '#070809',
    categories: ['games', 'education'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
