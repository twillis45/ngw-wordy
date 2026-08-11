'use client';

/**
 * Optional cross-device sync, with a server that cannot read your progress.
 *
 * THE BOARD'S RULING. Asked whether the no-account posture was worth more than
 * real sync, the seats split hard: every paying seat would take a login, and
 * seats 29, 12, 20, 13, 3 and 31 refuse an account outright — 29 because a
 * signup screen is a delete, 20 because a mandatory account is also an
 * accessibility barrier. The board did not vote to spend the privacy win. It
 * voted for OPTIONAL ACCOUNT, NO WALL: play forever having given nothing, sign
 * in only if you want sync.
 *
 * WHY THIS BEATS NYT RATHER THAN MATCHING IT. NYT requires an account and can
 * read everything in it. Here:
 *
 *   - There is no email, no username and no password reset. The only credential
 *     is a passphrase the player chooses, which never leaves the device.
 *   - The passphrase derives TWO independent values: an opaque sync id, which
 *     is all the server ever learns, and an encryption key, which it never
 *     sees. Progress is sealed with AES-GCM before it is uploaded.
 *   - The server therefore stores an anonymous id and a box of ciphertext. It
 *     cannot tell you what any player's streak is, because it cannot open it.
 *
 * That is a thing the leader structurally cannot offer, because their whole
 * model is an account they can read.
 *
 * DISABLED BY DEFAULT AND INVISIBLE WHEN DISABLED. With no endpoint
 * configured, `isSyncConfigured()` is false, the UI never renders, no network
 * call is possible, and `connect-src` stays locked to self. A build that does
 * not opt in is byte-for-byte as private as it was before this file existed.
 *
 * THE HONEST LIMIT, STATED PLAINLY IN THE UI: forget the passphrase and the
 * progress is unrecoverable. There is no reset, because a reset would require
 * us to hold something that could open the box. That is the trade being made,
 * and the player has to be told it before they choose it, not after.
 */

/** Configured at build time. Absent -> the whole feature is off. */
const ENDPOINT = process.env.NEXT_PUBLIC_SYNC_URL ?? '';

export function isSyncConfigured(): boolean {
  return ENDPOINT.length > 0;
}

/**
 * A fixed application salt.
 *
 * Per-user salts are the norm when a server stores them alongside a record, but
 * there is no record here until the id is derived, and the id IS derived from
 * this. The passphrase strength requirement below is what carries the weight
 * instead, and the UI enforces it.
 */
const SALT = new TextEncoder().encode('ngw-wordy/sync/v1');
/** OWASP's floor for PBKDF2-HMAC-SHA256. Runs once per sync action, not per keystroke. */
const ITERATIONS = 600_000;

export type Keys = { id: string; key: CryptoKey };

const hex = (b: ArrayBuffer) =>
  [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

/**
 * Derive the sync id and the encryption key from one passphrase.
 *
 * They are derived from the same master but through different labels, so
 * knowing the id — which the server does — reveals nothing about the key.
 */
export async function deriveKeys(passphrase: string): Promise<Keys> {
  const subtle = crypto.subtle;
  const base = await subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase.normalize('NFKC').trim()),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const master = await subtle.deriveBits(
    { name: 'PBKDF2', salt: SALT, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    256
  );
  const hkdf = await subtle.importKey('raw', master, 'HKDF', false, ['deriveBits', 'deriveKey']);
  const idBits = await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: SALT, info: new TextEncoder().encode('id') },
    hkdf,
    128
  );
  const key = await subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: SALT, info: new TextEncoder().encode('enc') },
    hkdf,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  return { id: hex(idBits), key };
}

/** Seal a backup code. Fresh IV every time; it is prepended to the ciphertext. */
export async function seal(code: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(code)
  );
  const out = new Uint8Array(iv.length + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), iv.length);
  let s = '';
  for (const b of out) s += String.fromCharCode(b);
  return btoa(s);
}

export async function open(sealed: string, key: CryptoKey): Promise<string | null> {
  try {
    const raw = Uint8Array.from(atob(sealed), (c) => c.charCodeAt(0));
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: raw.slice(0, 12) },
      key,
      raw.slice(12)
    );
    return new TextDecoder().decode(pt);
  } catch {
    // Wrong passphrase, or a tampered box. AES-GCM fails closed and these are
    // indistinguishable to us, which is correct — we cannot tell the player
    // which it was without being able to read the box.
    return null;
  }
}

export type PushResult = { ok: true } | { ok: false; reason: string };
export type PullResult =
  | { ok: true; code: string }
  | { ok: false; reason: string; empty?: boolean };

const NET = 'Could not reach sync. Your progress on this device is untouched.';

export async function push(code: string, keys: Keys): Promise<PushResult> {
  if (!isSyncConfigured()) return { ok: false, reason: 'Sync is not enabled in this build.' };
  try {
    const body = await seal(code, keys.key);
    const res = await fetch(`${ENDPOINT.replace(/\/$/, '')}/v1/blob/${keys.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'text/plain' },
      body,
    });
    return res.ok ? { ok: true } : { ok: false, reason: `Sync refused the upload (${res.status}).` };
  } catch {
    return { ok: false, reason: NET };
  }
}

export async function pull(keys: Keys): Promise<PullResult> {
  if (!isSyncConfigured()) return { ok: false, reason: 'Sync is not enabled in this build.' };
  try {
    const res = await fetch(`${ENDPOINT.replace(/\/$/, '')}/v1/blob/${keys.id}`);
    if (res.status === 404) {
      return { ok: false, empty: true, reason: 'Nothing saved under that phrase yet.' };
    }
    if (!res.ok) return { ok: false, reason: `Sync refused the download (${res.status}).` };
    const code = await open((await res.text()).trim(), keys.key);
    if (code === null) {
      return {
        ok: false,
        reason: 'That phrase did not open the saved progress. Check it and try again.',
      };
    }
    return { ok: true, code };
  } catch {
    return { ok: false, reason: NET };
  }
}

/**
 * Is this passphrase strong enough to be the only thing standing between an
 * anonymous id and someone's progress?
 *
 * Deliberately a length-and-variety floor rather than a complexity ritual: the
 * research is consistent that length beats character classes, and four words
 * is both stronger and easier to remember than an unpronounceable eight.
 */
export function passphraseProblem(p: string): string | null {
  const t = p.normalize('NFKC').trim();
  if (t.length < 12) return 'Use at least 12 characters — a short phrase of a few words is ideal.';
  if (/^\d+$/.test(t)) return 'Digits alone are quick to guess. Add some words.';
  if (new Set(t).size < 6) return 'That repeats too few characters to be hard to guess.';
  return null;
}
