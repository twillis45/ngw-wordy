/**
 * Where the app is mounted. Empty on localhost and on a root-served host;
 * "/ngw-wordy" on GitHub Pages, which serves a project repo from a subpath.
 *
 * Next rewrites `basePath` into its own links and assets automatically, but
 * NOT into things we author by hand — manifest fields, icon URLs, the service
 * worker registration. Those go through `withBase`.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function withBase(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_PATH}${clean}`;
}
