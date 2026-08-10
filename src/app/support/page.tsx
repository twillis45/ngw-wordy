import type { Metadata } from 'next';
import Legal from '@/components/Legal';

export const metadata: Metadata = {
  title: 'Support — Wordy',
  description: 'Help with Wordy, and what it is built from.',
};

/**
 * Both stores require a reachable support URL. This doubles as the
 * attributions page, which they also expect and which the project owes its
 * public-domain sources regardless.
 */
export default function SupportPage() {
  return (
    <Legal title="Support" updated="10 August 2026">
      <h2>Getting help</h2>
      <p>
        Something wrong with a puzzle, or a word you think should count? Email{' '}
        <a href="mailto:info@noguessworksystems.com">
          info@noguessworksystems.com
        </a>
        .
      </p>
      <p>
        Please include the six letters on the wheel and what you expected — that
        is usually enough to find the puzzle.
      </p>

      <h2>Common questions</h2>
      <p>
        <strong>My progress disappeared.</strong> Progress is stored in your
        browser only. Clearing site data, using private browsing, or switching
        browser or device will lose it, and it cannot be recovered.
      </p>
      <p>
        <strong>A real word wasn&rsquo;t accepted.</strong> Each puzzle carries a
        fixed answer list built from a standard word list. Some genuine words
        are missing from it. Tell us and we will look.
      </p>
      <p>
        <strong>Some letters are dim.</strong> They unlock as you fill rows. You
        can turn that off under the <em>?</em> button.
      </p>

      <h2>What Wordy is built from</h2>
      <p>
        <strong>Word list:</strong> ENABLE (Enhanced North American Benchmark
        Lexicon), released into the public domain by Alan Beale and Mendel
        Cooper. Filtered to remove slurs and crude terms.
      </p>
      <p>
        <strong>Definitions:</strong> WordNet 3.1, the lexical database from
        Princeton University, used under its own licence. Clues are edited from
        its definitions.
      </p>
      <p>
        <strong>Sound:</strong> synthesised in the browser with the Web Audio
        API. No sampled audio is used.
      </p>
      <p>
        <strong>Themes and clues:</strong> original, written for this game.
      </p>
      <p>
        See also <a href="/privacy">Privacy</a> and <a href="/terms">Terms</a>.
      </p>
    </Legal>
  );
}
