import type { NextConfig } from 'next';

/**
 * Static export, so the game can be served by any dumb file host —
 * GitHub Pages while developing, a Render Static Site later. Nothing here
 * needs a Node runtime: puzzles are read at build time and every route
 * prerenders.
 *
 * BASE_PATH exists because GitHub Pages serves a project repo from a
 * subpath (/ngw-wordy), while localhost and Render serve from the root.
 * It is empty by default so local dev is unaffected; the Pages workflow
 * sets it. Anything that hardcodes a leading "/" must go through it —
 * that includes the manifest, the icons and the service worker.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: basePath || undefined,
  // Pages resolves /foo/ to /foo/index.html; without this, deep links 404.
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
