import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Wordy',
  description: 'How many words can you make from six letters?',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Wordy' },
};

export const viewport: Viewport = {
  themeColor: '#070809',
  // The wheel is a drag surface — pinch-zoom would fight it.
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
