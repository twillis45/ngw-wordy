import { describe, expect, it } from 'vitest';
import { CHAIN_MAX, chainFromHash, chainToHash, placeIn } from './backup';

describe('chainFromHash', () => {
  it('reads a ladder in play order', () => {
    expect(chainFromHash('#play=85&chain=42.38.51')).toEqual([42, 38, 51]);
  });

  it('is null when absent, so a plain link is unaffected', () => {
    expect(chainFromHash('#play=85')).toBeNull();
    expect(chainFromHash('')).toBeNull();
  });

  it('refuses anything that is not a list of plain integers', () => {
    for (const bad of ['#chain=', '#chain=4..2', '#chain=-1', '#chain=1e3', '#chain=abc']) {
      expect(chainFromHash(bad)).toBeNull();
    }
  });

  it('refuses a chain longer than the cap rather than truncating it silently', () => {
    const tooMany = Array.from({ length: CHAIN_MAX + 1 }, () => '5').join('.');
    expect(chainFromHash(`#chain=${tooMany}`)).toBeNull();
  });
});

describe('chainToHash', () => {
  it('appends to the end, so the URL reads oldest first', () => {
    expect(chainToHash([42, 38], 51)).toBe('42.38.51');
  });

  it('drops the OLDEST when full — a full ladder must not become a dead link', () => {
    const full = Array.from({ length: CHAIN_MAX }, (_, i) => i + 1);
    const out = chainToHash(full, 99).split('.').map(Number);
    expect(out).toHaveLength(CHAIN_MAX);
    expect(out[out.length - 1]).toBe(99);
    expect(out[0]).toBe(2); // the 1 fell off the front
  });
});

describe('placeIn', () => {
  it('counts the player into the ladder they are joining', () => {
    expect(placeIn([42, 38, 51], 45)).toEqual({ place: 2, of: 4 });
  });

  it('gives a tie the better place', () => {
    expect(placeIn([50, 40], 50)).toEqual({ place: 1, of: 3 });
  });

  it('handles being first to play', () => {
    expect(placeIn([], 10)).toEqual({ place: 1, of: 1 });
  });
});
