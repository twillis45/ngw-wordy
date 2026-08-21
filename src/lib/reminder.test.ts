/*
 * The reminder is a FILE somebody else's software has to accept.
 *
 * Every other output in this app is rendered by code we control, so a mistake
 * shows up on screen. This one is parsed by Google Calendar, Apple Calendar
 * and Outlook, each of which fails differently and none of which tells the
 * player why. So the structural rules RFC 5545 actually enforces are asserted
 * here rather than eyeballed once and assumed.
 */
import { describe, expect, it } from 'vitest';
import { reminderIcs, REMINDER_FILENAME } from './reminder';

const NOW = new Date(Date.UTC(2026, 7, 21, 17, 30, 0)); // 2026-08-21T17:30:00Z
const opts = { hour: 8, url: 'https://sixonthedial.com/', now: NOW, uid: 'test-uid' };

describe('reminderIcs', () => {
  it('is a well-formed VCALENDAR wrapping one VEVENT', () => {
    const ics = reminderIcs(opts);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics.match(/END:VEVENT/g)).toHaveLength(1);
  });

  /*
   * CRLF, not LF. This is the single most common reason a valid-looking file
   * is refused on import, and it is invisible in every editor.
   */
  it('uses CRLF on every line', () => {
    const ics = reminderIcs(opts);
    expect(ics.includes('\r\n')).toBe(true);
    expect(/[^\r]\n/.test(ics)).toBe(false);
  });

  it('recurs daily', () => {
    expect(reminderIcs(opts)).toContain('RRULE:FREQ=DAILY');
  });

  /*
   * FLOATING time — no trailing Z on DTSTART. A Z pins the reminder to UTC,
   * so a player who picks 8am and then travels is reminded at 8am in the zone
   * they left. Floating means 8am wherever they are.
   */
  it('starts at a floating local time, not UTC', () => {
    const line = reminderIcs(opts).split('\r\n').find((l) => l.startsWith('DTSTART'));
    expect(line).toBe('DTSTART:20260822T080000');
    expect(line).not.toMatch(/Z$/);
  });

  /*
   * Tomorrow. Somebody setting a reminder at 9pm for 8am has already played
   * today; an event whose first fire is this morning looks broken on arrival.
   */
  it('first fires the day after it is created', () => {
    const late = reminderIcs({ ...opts, now: new Date(Date.UTC(2026, 7, 21, 23, 55)) });
    expect(late).toContain('DTSTART:20260822T080000');
  });

  it('honours the minute', () => {
    expect(reminderIcs({ ...opts, hour: 19, minute: 45 })).toContain('DTSTART:20260822T194500');
  });

  it('refuses an impossible time rather than emitting a broken file', () => {
    expect(() => reminderIcs({ ...opts, hour: 24 })).toThrow(RangeError);
    expect(() => reminderIcs({ ...opts, hour: -1 })).toThrow(RangeError);
    expect(() => reminderIcs({ ...opts, minute: 60 })).toThrow(RangeError);
    expect(() => reminderIcs({ ...opts, hour: 8.5 })).toThrow(RangeError);
  });

  /*
   * No line over 75 octets, per RFC 5545 §3.1 — Outlook and Google both
   * mangle over-long lines, and SUMMARY plus a URL clears 75 easily.
   */
  it('folds every line to 75 characters', () => {
    const ics = reminderIcs({ ...opts, url: 'https://sixonthedial.com/' + 'x'.repeat(120) });
    for (const line of ics.split('\r\n')) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
  });

  it('continues folded lines with a leading space', () => {
    const ics = reminderIcs({ ...opts, url: 'https://sixonthedial.com/' + 'x'.repeat(120) });
    const lines = ics.split('\r\n');
    const i = lines.findIndex((l) => l.startsWith('URL:'));
    expect(lines[i + 1].startsWith(' ')).toBe(true);
  });

  /*
   * THE COPY DOES NOT MENTION THE STREAK, and that is a decision rather than
   * an oversight. The restraint seat on the review board objects to mechanics
   * that farm engagement, and a daily reminder is the easiest place in this
   * game to start threatening a player with what they are about to lose. It
   * says a puzzle is up. Anything stronger belongs in front of the board
   * before it ships, so this test is the thing that forces that conversation.
   */
  it('says a puzzle is up and never threatens the streak', () => {
    const ics = reminderIcs(opts).toLowerCase();
    expect(ics).toContain("today's puzzle is up");
    for (const word of ['streak', 'lose', 'losing', 'don\'t break', 'keep your']) {
      expect(ics).not.toContain(word);
    }
  });

  it('names the file so it is identifiable in a downloads folder', () => {
    expect(REMINDER_FILENAME).toBe('six-on-the-dial-daily.ics');
  });
});
