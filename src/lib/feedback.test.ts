/**
 * The haptic vocabulary, checked without a device in a hand.
 *
 * "Does this feel right" needs hardware. "Is this the same signal twice" and
 * "do the two platforms play the same rhythm" do not — those are arithmetic on
 * the pattern, and they are where the real bug was: six of the eight signals
 * fired a different number of pulses on Android than on iOS, because each
 * platform was handed the rhythm separately and the two descriptions drifted.
 */
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
