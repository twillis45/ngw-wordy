import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site';

// Metadata routes are dynamic by default; `output: 'export'` requires this to
// be explicit or the build fails collecting page data.
export const dynamic = 'force-static';

/**
 * Four routes, listed by hand.
 *
 * There is nothing to enumerate from: puzzles are not routes, they are a JSON
 * file the single page reads, so a "generated" sitemap here would be the same
 * four strings with more machinery around them. Adding a route means adding a
 * line — which is the failure this comment exists to make obvious.
 *
 * URLs carry the trailing slash because `trailingSlash: true` is what the host
 * actually serves; a sitemap entry that redirects is a wasted crawl.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  // One timestamp for the whole build, so the four entries agree with each
  // other rather than differing by the milliseconds between calls.
  const lastModified = new Date();

  return [
    {
      url: absoluteUrl('/'),
      lastModified,
      // The board changes every day; the legal pages effectively never do.
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: absoluteUrl('/support/'),
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: absoluteUrl('/privacy/'),
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: absoluteUrl('/terms/'),
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
