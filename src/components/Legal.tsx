import Link from 'next/link';

/**
 * Shared chrome for the legal and support pages.
 *
 * These exist because both stores hard-block submission without a reachable
 * privacy policy and support URL — but they are also the only pages a person
 * lands on when something has gone wrong, so they get the same type ladder and
 * the same measure as the rest of the app rather than being an afterthought.
 */
export default function Legal({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto min-h-svh w-full max-w-[680px] px-5 py-10 md:py-16">
      <Link
        href="/"
        className="text-meta text-text-secondary underline decoration-edge-mid underline-offset-4 hover:text-text-primary"
      >
        ← Back to the game
      </Link>

      <h1 className="mt-8 text-title font-semibold tracking-[-0.01em] text-text-primary">
        {title}
      </h1>
      <p className="mt-1 text-meta text-text-muted">Last updated {updated}</p>

      {/*
        Spacing lives on the container, not on each element: sibling margins
        collapse unpredictably and this page is written as prose, so the rhythm
        has to survive an editor adding a paragraph without thinking about it.
      */}
      <div className="legal mt-8 flex flex-col gap-4 text-body leading-relaxed text-text-secondary">
        {children}
      </div>
    </main>
  );
}
