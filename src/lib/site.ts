/**
 * The one place the deployed origin is known.
 *
 * `NEXT_PUBLIC_SHARE_URL` already exists for the share card and is set by
 * every real deploy (`.github/workflows/pages.yml` passes the Pages base URL;
 * Render sets it in the dashboard), so social cards, the canonical link and
 * the sitemap read it rather than introducing a second, drift-prone name.
 *
 * The fallback is localhost ON PURPOSE. A guessed production domain would
 * quietly ship a sitemap and og:url pointing at a host nobody owns, which is
 * worse than an obviously-local one — a plain local build should look local.
 * Changing the default is this one line.
 */
const FALLBACK_ORIGIN = 'http://localhost:3000';

/**
 * No trailing slash, so `${SITE_URL}${path}` never produces a double slash —
 * two spellings of the same page is exactly what a canonical tag exists to
 * prevent.
 *
 * Note this may include a sub-path (GitHub Pages serves this repo from
 * /sixonthedial), so it is NOT necessarily a bare origin.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SHARE_URL || FALLBACK_ORIGIN
).replace(/\/+$/, '');

/**
 * Absolute URL for a site-relative path.
 *
 * Social crawlers and sitemaps do not resolve relative URLs, and `basePath` is
 * already baked into SITE_URL on a sub-path host — so paths passed here must
 * NOT go through `withBase()` as well, or the mount point appears twice.
 *
 * `trailingSlash: true` is on, so directory routes are emitted with the slash;
 * matching it here keeps the canonical URL identical to the served one.
 */
export function absoluteUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${clean}`;
}
