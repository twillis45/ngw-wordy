/**
 * Spellability is a MULTISET question, not a set question.
 *
 * Written before the engine changed, and failing on purpose. The whole
 * catalogue currently rests on bases of six DISTINCT letters, which makes
 * set-membership accidentally correct — you can never need a letter twice
 * because you never have it twice. Allowing one repeated letter in a base
 * (COTTON, CHURCH, POTATO, COFFEE, COLLAR) breaks that equivalence in both
 * directions:
 *
 *   false NEGATIVE — LETTER is spellable from LETTER and a set check that
 *                    asks "is every letter present" says yes, but a check
 *                    that dedupes the ROW first would reject it
 *   false POSITIVE — TOTTER needs three T's; a wheel spelling COTTON has two
 *
 * The second is the dangerous one. It is the same class of bug as the bitmask
 * that once counted `cool` and `total` as spellable from six distinct letters,
 * inflating a measurement from 45 boards to 118 and producing LOCUST, which
 * was then presented as the best board of the exercise. LOCUST is kept below
 * as a named regression case.
 */
import { describe, expect, it } from 'vitest';
import { canSpell, isReachable } from './game';

describe('canSpell — letters are consumed, not merely present', () => {
  it('spells a word needing one of each', () => {
    expect(canSpell('cot', 'cotton')).toBe(true);
  });

  it('spells a word needing a letter TWICE when the wheel has it twice', () => {
    expect(canSpell('coot', 'cotton')).toBe(true);
    expect(canSpell('cotton', 'cotton')).toBe(true);
  });

  it('REFUSES a word needing a letter more often than the wheel has it', () => {
    // cotton has two T's and two O's. tot-tot would need four.
    expect(canSpell('tottto', 'cotton')).toBe(false);
    // church has two H's and two C's, one R. "rr" is not available.
    expect(canSpell('churr', 'church')).toBe(false);
  });

  it('the LOCUST case: a distinct-letter wheel cannot spell a doubled word', () => {
    // LOCUST has six distinct letters. `cool` needs two O's; `total` two T's.
    expect(canSpell('cool', 'locust')).toBe(false);
    expect(canSpell('total', 'locust')).toBe(false);
    expect(canSpell('lost', 'locust')).toBe(true);
  });

  it('is unaffected by letter order', () => {
    expect(canSpell('otc', 'cotton')).toBe(true);
  });
});

describe('isReachable — unlocking a letter must not unlock both copies', () => {
  it('needs as many unlocked copies as the word consumes', () => {
    // One T unlocked. `tot` needs two.
    expect(isReachable('tot', ['c', 'o', 't'])).toBe(false);
    expect(isReachable('cot', ['c', 'o', 't'])).toBe(true);
  });

  it('allows the doubled word once both copies are unlocked', () => {
    expect(isReachable('tot', ['c', 'o', 't', 't'])).toBe(true);
  });

  it('still refuses a letter that is not unlocked at all', () => {
    expect(isReachable('con', ['c', 'o', 't'])).toBe(false);
  });
});
