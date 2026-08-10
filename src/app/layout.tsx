import type { Metadata, Viewport } from 'next';
import ServiceWorker from '@/components/ServiceWorker';
import { withBase } from '@/lib/basePath';
import { NO_FLASH_SCRIPT } from '@/lib/theme';
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
      { url: withBase('/icon-192.png'), sizes: '192x192', type: 'image/png' },
      { url: withBase('/icon-512.png'), sizes: '512x512', type: 'image/png' },
    ],
    apple: withBase('/apple-touch-icon.png'),
  },
};

export const viewport: Viewport = {
  // One entry per scheme, so the browser chrome matches the page outdoors too.
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#070809' },
    { media: '(prefers-color-scheme: light)', color: '#eef3f8' },
  ],
  /*
   * Zoom stays ENABLED. `maximumScale: 1` + `userScalable: false` is the
   * documented WCAG 1.4.4 failure F69: it kills pinch-zoom document-wide, and
   * because every size in this UI was px it also meant no text could be
   * enlarged by any route at all. The drag surface is protected by
   * `touch-action: none` on the wheel itself (LetterWheel), which is the
   * scoped tool for that job — the viewport is not.
   */
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          A static export on GitHub Pages cannot set response headers, so the
          policy has to travel in the document. This is blast-radius control
          rather than a patch: there is no user-generated content and exactly
          one inline script (the theme no-flash, a compile-time constant with
          no interpolation), so the present-day XSS surface is small — but a
          supply-chain compromise in a dependency would otherwise have the run
          of the page.

          `connect-src 'self'` is the load-bearing line. It is only possible
          because the third-party dictionary fetch was removed; the app now
          talks to nobody. Note that frame-ancestors is ignored in a meta tag
          and needs a real header, so it is set where the host allows one.
        */}
        <meta
          httpEquiv="Content-Security-Policy"
          content={[
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data:",
            "font-src 'self'",
            "connect-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'none'",
          ].join('; ')}
        />
        {/* Applies an explicit theme before first paint. Without it, a
            light-mode player gets a dark flash on every load. */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
