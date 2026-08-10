import type { Metadata } from 'next';
import Legal from '@/components/Legal';
import { absoluteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'The terms for using Wordy.',
  alternates: { canonical: absoluteUrl('/terms/') },
};

export default function TermsPage() {
  return (
    <Legal title="Terms of use" updated="10 August 2026">
      <p>
        Wordy is a word game, free to play. By using it you agree to these
        terms, which are deliberately brief.
      </p>

      <h2>Using the game</h2>
      <p>
        Play it, share your results, tell your friends. Please don&rsquo;t
        redistribute the puzzle content or clues as your own, and don&rsquo;t
        attempt to disrupt the service for other people.
      </p>

      <h2>Your progress</h2>
      <p>
        Progress lives in your browser. Clearing site data, switching browsers
        or switching devices will lose it, and we have no way to recover it —
        there is no account and no server copy. Please treat a streak as a
        pleasant record rather than something guaranteed.
      </p>

      <h2>No warranty</h2>
      <p>
        Wordy is provided as-is, without warranty of any kind. It may contain
        errors, a puzzle may be harder than intended, and it may be unavailable
        at times. To the extent the law allows, we are not liable for any loss
        arising from using it.
      </p>

      <h2>Content</h2>
      <p>
        Word lists and definitions come from public-domain sources; see{' '}
        <a href="/support">Support</a> for attribution. Puzzle themes and clues
        are original work and remain the property of their author.
      </p>

      <h2>Changes</h2>
      <p>
        These terms may change. The date at the top of this page shows when they
        last did.
      </p>
    </Legal>
  );
}
