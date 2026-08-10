import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site';

// Metadata routes are dynamic by default; `output: 'export'` requires this to
// be explicit or the build fails collecting page data.
export const dynamic = 'force-static';

/**
 * Generated rather than a static file in `public/`, because the Sitemap line
 * has to be an absolute URL and the origin is only known at build time — a
 * hardcoded one would point at the wrong host from GitHub Pages.
 *
 * Everything here is public and crawlable; the only thing worth keeping out of
 * an index is Next's build output, which is fingerprinted, linked from nothing
 * a crawler reads as content, and pure crawl-budget waste.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/_next/',
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
