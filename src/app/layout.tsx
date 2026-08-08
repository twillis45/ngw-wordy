import type { Metadata, Viewport } from 'next';
import ServiceWorker from '@/components/ServiceWorker';
import './globals.css';

export const metadata: Metadata = {
  title: 'Wordy',
  description: 'Six letters. How many words can you make?',
  applicationName: 'Wordy',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Wordy',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#070809',
  // The wheel is a drag surface — pinch-zoom would fight it.
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
