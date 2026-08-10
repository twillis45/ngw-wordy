import type { Metadata } from 'next';
import Legal from '@/components/Legal';

export const metadata: Metadata = {
  title: 'Privacy — Wordy',
  description: 'What Wordy stores, and what it sends. (Nothing leaves your device.)',
};

/**
 * Both the App Store and Google Play require a reachable privacy policy URL
 * for every app, with no exception for apps that collect nothing — "we collect
 * nothing" still has to be published somewhere.
 *
 * This one is unusually short because it is unusually true: there is no
 * backend, no account, no analytics, no advertising SDK and no cookie. Saying
 * so plainly is worth more than a page of hedged boilerplate.
 */
export default function PrivacyPage() {
  return (
    <Legal title="Privacy" updated="10 August 2026">
      <p>
        Wordy runs entirely in your browser. There is no server, no account and
        no login. Nothing you do here is sent anywhere.
      </p>

      <h2>What is stored</h2>
      <p>
        Your progress is saved in your own browser&rsquo;s local storage, on your
        own device: the words you have found, which puzzles you have cleared,
        your streak, your hint balance, and your preferences (theme, sound, and
        the two optional modes).
      </p>
      <p>
        We cannot see any of it. It never leaves the device, and it is not
        backed up to us, because there is no us to back it up to.
      </p>

      <h2>What is collected</h2>
      <p>
        Nothing. No analytics, no crash reporting, no advertising, no
        fingerprinting, no cookies, no email address, no name. Wordy makes no
        network requests to anyone once the page has loaded.
      </p>

      <h2>Deleting your data</h2>
      <p>
        Clearing your browser&rsquo;s site data for Wordy erases everything, and
        that is the whole of it — there is no copy anywhere else, and no request
        to send us. Note that this also deletes your progress and streak, and we
        cannot restore them.
      </p>

      <h2>Children</h2>
      <p>
        Wordy is suitable for all ages and is not directed at children
        specifically. Because it collects no personal information from anyone,
        it collects none from children either.
      </p>

      <h2>Hosting</h2>
      <p>
        The site is served as static files. Whoever hosts it may keep ordinary
        server logs, such as IP addresses and requested URLs, in the way every
        web server does. That is outside our control and is not linked to
        anything about you inside the game.
      </p>

      <h2>Changes</h2>
      <p>
        If this ever stops being true — if a future version adds accounts,
        purchases or analytics — this page will be updated before that version
        ships, and the date at the top will change.
      </p>
    </Legal>
  );
}
