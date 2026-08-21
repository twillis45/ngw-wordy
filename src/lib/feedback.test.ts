/**
 * The haptic vocabulary, checked without a device in a hand.
 *
 * "Does this feel right" needs hardware. "Is this the same signal twice" and
 * "do the two platforms play the same rhythm" do not — those are arithmetic on
 * the pattern, and they are where the real bug was: six of the eight signals
 * fired a different number of pulses on Android than on iOS, because each
 * platform was handed the rhythm separately and the two descriptions drifted.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RHYTHM, androidPattern, pulseCount, type Rhythm } from './feedback';

const entries = Object.entries(RHYTHM) as [string, Rhythm][];

describe('haptic rhythms', () => {
  it('always has exactly one more pulse than gap', () => {
    // A gap is the silence BETWEEN two pulses, so any other ratio describes a
    // rhythm that cannot be played: a trailing gap is silence after the last
    // buzz, which nobody can feel.
    for (const [name, r] of entries) {
      expect(r.gaps.length, `${name}`).toBe(r.pulses.length - 1);
    }
  });

  it('plays the same number of pulses on both platforms', () => {
    /*
     * This is the regression. `iosTicks` clicks once and then once per gap, so
     * iOS always feels gaps.length + 1 bumps. The hand-written Android arrays
     * carried one fewer than that, so `bonus` was a single pulse on Android —
     * identical to `tap` — and `correct` matched `duplicate`.
     */
    for (const [name, r] of entries) {
      const android = androidPattern(r).filter((_, i) => i % 2 === 0).length;
      const ios = r.gaps.length + 1;
      expect(android, `${name}: android pulses`).toBe(ios);
      expect(android, `${name}: matches pulseCount`).toBe(pulseCount(r));
    }
  });

  it('never gives two signals the same shape', () => {
    /*
     * Two signals sharing a pulse count AND a gap pattern are the same signal,
     * whatever the design intended. Sharing a pulse count alone is fine and
     * deliberate — `correct` and `reject` are both triples, distinguished by
     * one being even (45, 45) and the other broken (110, 45).
     */
    const shapes = new Map<string, string>();
    for (const [name, r] of entries) {
      const key = `${r.pulses.length}:${r.gaps.join(',')}`;
      expect(shapes.has(key), `${name} is identical to ${shapes.get(key)}`).toBe(false);
      shapes.set(key, name);
    }
  });

  it('keeps the lightest signal unique, so a letter tap is never mistaken', () => {
    // `tap` fires on every letter joined to a word — by far the most frequent
    // signal in the game. If anything else is also a single bare pulse, the
    // rarest events feel like the commonest one.
    const singles = entries.filter(([, r]) => r.pulses.length === 1).map(([n]) => n);
    expect(singles).toEqual(['tap']);
  });

  it('separates the reward from the error by shape, not just duration', () => {
    // Milliseconds are not legible through a phone case; rhythm is. `correct`
    // and `duplicate` are the pair a player meets most often in succession,
    // and they must not be confusable.
    expect(pulseCount(RHYTHM.correct)).not.toBe(pulseCount(RHYTHM.duplicate));
    // The two celebrations differ in direction: prize accelerates, complete
    // slows down. Same pulse count, opposite gap trend.
    const trend = (g: number[]) => Math.sign(g[g.length - 1] - g[0]);
    expect(trend(RHYTHM.prize.gaps)).toBeLessThan(0);
    expect(trend(RHYTHM.complete.gaps)).toBeGreaterThan(0);
  });
});

/*
 * THE GAME IS IN C MAJOR, and it was only mostly true.
 *
 * `correct` walks C5 D5 E5 G5 A5 C6 and prize/complete are a C major triad —
 * that half was designed. Three events were not: tap sounded a D#5, duplicate
 * an F#4 and spend a C#5 falling to an F#4. Out of key, and the two F#s make a
 * tritone against the tonic everything else resolves to, which is the single
 * interval most reliably heard as an error — in the sound for a NON-error.
 *
 * This asserts the pitched content, not the noise bursts. `noise({ freq })`
 * sets a bandpass centre for a transient click; it is not a note and holding
 * it to a scale would be a category error. I made exactly that mistake when I
 * first measured this file and called 3000Hz "off-grid".
 */
describe('the sound set is in one key', () => {
  const C_MAJOR = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  const noteOf = (hz: number) => {
    const n = 12 * Math.log2(hz / 440) + 69;
    const rounded = Math.round(n);
    return { name: NAMES[((rounded % 12) + 12) % 12], cents: (n - rounded) * 100 };
  };

  /*
   * Read from the source rather than re-listed here, so a new sound is caught
   * the day it is added instead of the day somebody remembers this test.
   * `reject` is exempt BY NAME: it is the one deliberate dissonance, and
   * naming it is what stops a later reader tuning it into the key.
   */
  const src = readFileSync(new URL('./feedback.ts', import.meta.url), 'utf8');
  const rejectBody = src.slice(src.indexOf('reject() {'), src.indexOf('duplicate() {'));

  /*
   * ALL frequency-shaped numbers in the block, not just `freq:` properties.
   *
   * The first version of this matched `freq:` and `glideTo:` only, and so
   * checked eight values while silently skipping the two things most worth
   * checking: the `correct` ladder and the prize/complete triads are bare
   * array literals. The pitches I had just called well-designed were the ones
   * not being tested.
   */
  /*
   * COMMENTS STRIPPED FIRST. The fix for the three out-of-key sounds records
   * the old values in prose — "Was 620Hz, which is D#5" — and a regex over raw
   * text cannot tell a note from a sentence about a note. The first run of
   * this test failed on 620, 380 and 560 while the code beside them read
   * 523.25, 392 and 587.33. It was reading my own explanation.
   */
  const block = src
    .slice(src.indexOf('export const feedback = {'))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  const rejectStart = block.indexOf('reject() {');
  const rejectEnd = block.indexOf('duplicate() {');

  const pitches = [...block.matchAll(/[\d]+\.?[\d]*/g)]
    .map((m) => ({ hz: Number(m[0]), at: m.index ?? 0 }))
    // Frequencies only: gains, durations and delays are all well under 1,
    // and nothing in this file sounds a pitch below 40Hz or above 5kHz.
    .filter(({ hz }) => hz >= 40 && hz <= 5000)
    // Noise bursts are bandpass centres, not notes.
    .filter(({ at }) => {
      const from = block.lastIndexOf('\n', at);
      return !block.slice(from, block.indexOf('\n', at)).includes('noise(');
    })
    // reject is the one deliberate dissonance, exempt by name.
    .filter(({ at }) => at < rejectStart || at >= rejectEnd);

  it('finds pitches to check', () => {
    // 8 tone properties plus the ladder and both triads.
    expect(pitches.length).toBeGreaterThanOrEqual(16);
    expect(rejectBody).toContain('sawtooth');
  });

  it.each(pitches)('$hz Hz is a note in C major', ({ hz }) => {
    const { name, cents } = noteOf(hz);
    expect(C_MAJOR, `${hz}Hz is ${name}, outside C major`).toContain(name);
    expect(Math.abs(cents), `${hz}Hz is ${Math.round(cents)} cents off ${name}`).toBeLessThan(10);
  });
});
