/**
 * A daily reminder, as a calendar file.
 *
 * WHY A .ICS AND NOT A NOTIFICATION. Web Push needs a push service, VAPID keys
 * and a subscription endpoint — a third party receiving data, which breaks
 * `connect-src 'self'` and makes STORE_READINESS 1.5 and 1.6 false as written.
 * It would be the first server this app has. On iOS it barely helps anyway:
 * push only reaches a PWA installed to the home screen, never a Safari tab.
 *
 * A calendar event needs none of that. It is generated here, downloaded by the
 * player, and lives in THEIR calendar — where they can move it, mute it or
 * delete it without touching the game, and where it keeps working whether or
 * not they ever open this site again. Nothing is transmitted, so the privacy
 * rows stay accurate.
 *
 * THE COPY IS DELIBERATELY QUIET. The review board's restraint seat objects to
 * mechanics that farm engagement, and a reminder is the easiest place in a
 * daily game to start threatening people with what they are about to lose.
 * This says a puzzle is up. It does not mention the streak, does not count
 * what breaks, and does not ask for anything back.
 */

/** Two digits, because iCalendar has no opinion about your locale. */
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Fold long lines at 75 octets, per RFC 5545 §3.1.
 *
 * Not decoration: Google Calendar and Outlook both reject or mangle an
 * over-long line, and the SUMMARY plus a URL clears 75 easily. Continuation
 * lines begin with a single space.
 */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    out.push(' ' + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest) out.push(' ' + rest);
  return out.join('\r\n');
}

/**
 * Escape the four characters iCalendar treats as structural.
 *
 * Order matters — the backslash has to go first or it doubles the escapes it
 * just introduced.
 */
const esc = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

export type ReminderOptions = {
  /** 0–23, the player's own clock. */
  hour: number;
  /** 0–59. */
  minute?: number;
  /** Where the puzzle lives. */
  url: string;
  /** Injected so the file is reproducible and the tests are not time-dependent. */
  now?: Date;
  /** Injected for the same reason; the UID must be stable per file, not random. */
  uid?: string;
};

/**
 * Build the .ics text for a daily reminder.
 *
 * FLOATING LOCAL TIME, with no VTIMEZONE and no trailing Z. A `Z` would pin
 * the reminder to UTC, so a player who set 8am and then travelled would be
 * reminded at 8am *the time zone they left*. A floating DTSTART means 8am
 * wherever they are, which is what "remind me in the morning" means. It is
 * also the one case RFC 5545 explicitly designs floating time for.
 */
export function reminderIcs(opts: ReminderOptions): string {
  const { hour, minute = 0, url } = opts;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError(`hour must be 0-23, got ${hour}`);
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new RangeError(`minute must be 0-59, got ${minute}`);
  }

  const now = opts.now ?? new Date();
  const stamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  /*
   * Starts TOMORROW, not today.
   *
   * Somebody setting a reminder at 9pm for 8am has already played today; a
   * first fire in eleven hours is right, and a first fire that already passed
   * this morning is a calendar entry that looks broken on arrival.
   */
  const start = new Date(now);
  start.setDate(start.getDate() + 1);
  const dtstart =
    `${start.getFullYear()}${pad(start.getMonth() + 1)}${pad(start.getDate())}` +
    `T${pad(hour)}${pad(minute)}00`;

  const uid = opts.uid ?? `sixonthedial-daily-${stamp}`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Six on the Dial//Daily reminder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${esc(uid)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${dtstart}`,
    'DURATION:PT5M',
    'RRULE:FREQ=DAILY',
    `SUMMARY:${esc('Six on the Dial')}`,
    `DESCRIPTION:${esc("Today's puzzle is up.")}`,
    `URL:${esc(url)}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc('Six on the Dial')}`,
    // At the event, not before it. A reminder for a reminder is noise.
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  // CRLF throughout, per RFC 5545 §3.1. Bare \n is the single most common
  // reason an otherwise valid file is refused on import.
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** A filename that says what it is once it is sitting in a downloads folder. */
export const REMINDER_FILENAME = 'six-on-the-dial-daily.ics';
