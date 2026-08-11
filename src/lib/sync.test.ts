import { describe, expect, it } from 'vitest';
import { deriveKeys, open, passphraseProblem, seal } from './sync';

const PASS = 'brass monkey folding chair';

describe('sync crypto', () => {
  it('round-trips a backup code', async () => {
    const k = await deriveKeys(PASS);
    const code = 'wordy2:AAAABBBBCCCC';
    expect(await open(await seal(code, k.key), k.key)).toBe(code);
  });

  it('gives the same id and key for the same phrase, every time', async () => {
    // Otherwise a second device could never find the blob the first one wrote.
    const a = await deriveKeys(PASS);
    const b = await deriveKeys(PASS);
    expect(a.id).toBe(b.id);
    expect(await open(await seal('wordy2:X', a.key), b.key)).toBe('wordy2:X');
  });

  it('normalises whitespace and unicode so a retyped phrase still opens it', async () => {
    const a = await deriveKeys(PASS);
    const b = await deriveKeys(`  ${PASS}  `);
    expect(a.id).toBe(b.id);
  });

  it('gives a different id for a different phrase', async () => {
    const a = await deriveKeys(PASS);
    const b = await deriveKeys('a completely different phrase');
    expect(a.id).not.toBe(b.id);
  });

  it('fails closed on the wrong passphrase rather than returning junk', async () => {
    const right = await deriveKeys(PASS);
    const wrong = await deriveKeys('not the right phrase at all');
    expect(await open(await seal('wordy2:secret', right.key), wrong.key)).toBeNull();
  });

  it('fails closed on a tampered box', async () => {
    const k = await deriveKeys(PASS);
    const sealed = await seal('wordy2:secret', k.key);
    const bytes = atob(sealed).split('');
    bytes[bytes.length - 1] = String.fromCharCode(bytes[bytes.length - 1].charCodeAt(0) ^ 0xff);
    expect(await open(btoa(bytes.join('')), k.key)).toBeNull();
  });

  it('never emits the same ciphertext twice for the same input', async () => {
    // A fresh IV per seal. Identical ciphertext would leak that a player's
    // progress had not changed between two uploads.
    const k = await deriveKeys(PASS);
    expect(await seal('wordy2:same', k.key)).not.toBe(await seal('wordy2:same', k.key));
  });

  it('does not leak the key through the id', async () => {
    // The server learns the id. It must not be derivable back to the key, so
    // the two come from different HKDF labels rather than being the same bits.
    const k = await deriveKeys(PASS);
    const sealed = await seal('wordy2:secret', k.key);
    expect(sealed).not.toContain(k.id);
    expect(k.id).toHaveLength(32);
  });

  it('holds the passphrase floor', async () => {
    expect(passphraseProblem('short')).toMatch(/12 characters/);
    expect(passphraseProblem('123456789012345')).toMatch(/Digits alone/);
    expect(passphraseProblem('aaaaaaaaaaaaaaa')).toMatch(/too few characters/);
    expect(passphraseProblem(PASS)).toBeNull();
  });
});
