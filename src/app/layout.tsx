import type { Metadata, Viewport } from 'next';
import ServiceWorker from '@/components/ServiceWorker';
import Preferences from '@/components/Preferences';
import { withBase } from '@/lib/basePath';
import { NO_FLASH_SCRIPT } from '@/lib/theme';
import { NO_FLASH_SCRIPT as A11Y_NO_FLASH } from '@/lib/a11y';
import { NO_FLASH_SCRIPT as ACCENT_NO_FLASH } from '@/lib/accent';
import { SITE_URL, absoluteUrl } from '@/lib/site';
import { isDailyEligible } from '@/lib/game';
import themes from '../../data/themes.json';
import './globals.css';

/*
 * One sentence, used in three places — <meta name="description">, og:description
 * and twitter:description. Written out once because when they drift, the copy a
 * person sees in a shared link stops matching the copy Google shows, and only
 * one of the two ever gets updated.
 *
 * It says "word game" and "written clues" deliberately: the generic phrasing
 * ("puzzle app") is what makes this indistinguishable from every anagram
 * timewaster in the results.
 */
/*
 * The counts are COUNTED, not typed.
 *
 * They were literals — "397 of them, across 20 themes" — and both numbers
 * changed six times in a single authoring session. A hard-coded count in
 * shipped metadata is a claim that silently becomes false: nothing fails, no
 * test breaks, and the description a crawler reads is simply wrong until
 * somebody happens to notice. docs/AUTHORING.md already forbids this inside
 * clues; the rule is no different here.
 */
const themed = themes.puzzles.length;
const themeCount = new Set(themes.puzzles.map((p) => p.theme)).size;

/*
 * The general packs are a SUBORDINATE CLAUSE, and that is a ruling rather than
 * a style choice.
 *
 * The catalogue is broadening past Black American cultural life. Asked how the
 * product should describe itself afterwards, the board was blunt: a blurb
 * reading "100 puzzles across many themes" removes the only reason anybody
 * chooses this over a free alternative. The specificity stays in position one
 * where it does the selling, the broadening trails it, and the count never
 * leads — a number is the one claim every competitor can beat.
 *
 * `general` is counted rather than assumed, so the sentence stops mentioning
 * the other packs on a build that has none of them.
 */
const general = themes.puzzles.filter(
  (p) => p.theme && !isDailyEligible(p.theme)
).length;

const DESCRIPTION =
  `A six-letter word game with hand-authored puzzles. Find every word on the wheel, then read the clue behind the board — written from inside Black American cultural life, across ${themeCount} themes` +
  `${general > 0 ? ', plus a few packs from the long way home' : ''}. ${themed} boards, every one about something.`;

export const metadata: Metadata = {
  /*
   * Resolves every relative URL Next emits for metadata (og:image, canonical).
   * Without it Next warns at build time and falls back to localhost, which
   * would ship a social card pointing at the developer's machine.
   */
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Six on the Dial — six-letter word game',
    // Sub-pages set their own full title; this keeps any that don't from
    // losing the product name in a browser tab or a search result.
    template: '%s — Six on the Dial',
  },
  description: DESCRIPTION,
  applicationName: 'Six on the Dial',
  // Two spellings of a page — with and without the trailing slash, or on the
  // Pages sub-path as well as the real domain — is one page's rank split in
  // half. The canonical says which one counts.
  alternates: { canonical: absoluteUrl('/') },
  openGraph: {
    type: 'website',
    siteName: 'Six on the Dial',
    title: 'Six on the Dial — six-letter word game',
    description: DESCRIPTION,
    url: absoluteUrl('/'),
    locale: 'en_US',
    /*
     * A real, committed PNG rather than a generated one: `output: 'export'`
     * has no runtime, so next/og's ImageResponse cannot run — and a card with
     * no image is rendered by every chat app as a bare grey link.
     *
     * width/height are declared because crawlers that will not download the
     * image before rendering the preview (iMessage, Slack on first paste) lay
     * it out from these; omitting them collapses the card to a thumbnail.
     */
    images: [
      {
        url: absoluteUrl('/og.png'),
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'The Six on the Dial wordmark, with the o in on drawn as the game’s six-tile letter wheel.',
      },
    ],
  },
  twitter: {
    // summary_large_image, not summary: summary crops to a small square and
    // throws away the half of the card that says what the game is.
    card: 'summary_large_image',
    title: 'Six on the Dial — six-letter word game',
    description: DESCRIPTION,
    images: [absoluteUrl('/og.png')],
  },
  // Safari turns bare numbers in the rules and scores into tappable phone
  // links otherwise, which is both wrong and a stray blue on a matte UI.
  formatDetection: { telephone: false, address: false, email: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'The Dial',
  },
  icons: {
    icon: [
      { url: withBase('/icon-192.png'), sizes: '192x192', type: 'image/png' },
      { url: withBase('/icon-512.png'), sizes: '512x512', type: 'image/png' },
    ],
    // 180x180 stated: iOS picks the apple-touch-icon nearest its target size,
    // and an unsized entry is treated as a last resort behind any sized one.
    apple: [
      {
        url: withBase('/apple-touch-icon.png'),
        sizes: '180x180',
        type: 'image/png',
      },
    ],
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
            /*
             * Sync is the ONLY thing that may widen this, and only when a build
             * explicitly opts in. An unconfigured build keeps `'self'` exactly
             * as it was, so the privacy posture is not spent by shipping the
             * feature — only by turning it on. The origin is a compile-time
             * constant, never anything a page or a player can influence.
             */
            process.env.NEXT_PUBLIC_SYNC_URL
              ? `connect-src 'self' ${new URL(process.env.NEXT_PUBLIC_SYNC_URL).origin}`
              : "connect-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'none'",
          ].join('; ')}
        />
        {/* Applies an explicit theme before first paint. Without it, a
            light-mode player gets a dark flash on every load. */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
        {/* Text size before first paint too: a late theme is a flash, a late
            text size is a full reflow of the board. */}
        <script dangerouslySetInnerHTML={{ __html: A11Y_NO_FLASH }} />
        {/* Accent before first paint too. Applied late it is not a flash but a
            colour change on every solved row at once, which lands on exactly
            the part of the board the player is looking at. */}
        <script dangerouslySetInnerHTML={{ __html: ACCENT_NO_FLASH }} />
      </head>
      <body>
        {children}
        <ServiceWorker />
        {/* Re-applies theme and text settings after hydration, because React
            strips the head scripts work off <html>. See Preferences.tsx. */}
        <Preferences />
      </body>
    </html>
  );
}
