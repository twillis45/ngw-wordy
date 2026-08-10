import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  // Next already emits `noindex` for not-found, which is the part that matters:
  // a static host serves 404.html with a 200, so nothing but the meta tag stops
  // this page competing with the real ones. Only the title is set here.
  title: 'Page not found',
};

/**
 * Replaces Next's built-in 404, which is an unstyled black-on-white line in a
 * system font — on a dark, installed PWA it reads as the app having crashed
 * rather than as a wrong address.
 *
 * The exit is the point: nearly every 404 here is a stale deep link or a
 * mistyped legal path, and the game itself is one route away.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-[680px] flex-col justify-center px-5 py-10">
      <p className="text-meta text-text-muted">404</p>
      <h1 className="mt-2 text-title font-semibold tracking-[-0.01em] text-text-primary">
        That page isn’t here
      </h1>
      <p className="mt-3 text-body leading-relaxed text-text-secondary">
        The link may be out of date. Today’s board is still waiting.
      </p>
      <Link
        href="/"
        className="mt-8 self-start text-body text-text-secondary underline decoration-edge-mid underline-offset-4 hover:text-text-primary"
      >
        ← Back to the game
      </Link>
    </main>
  );
}
