/**
 * Compact, transferable progress codes.
 *
 * The v1 code was `btoa(JSON.stringify(progress))`. For an engaged player that
 * is 38,000 characters — not a code, a wall of text nobody can move between
 * devices. The player board named progress durability its most common blocker
 * and then told us exactly what to encode.
 *
 * THE BOARD'S RANKING, and this format follows it exactly:
 *   1. streak and best streak   — "the betrayal item"
 *   2. days played              — a reset stats counter reads as a bug
 *   3. which boards were cleared
 *   4. SETTINGS                 — an accessibility config that does not survive
 *                                 makes the new phone unplayable on arrival,
 *                                 and that seat rates it above the streak
 *   5. hint balance
 *   6. bonus words              — dropped, and only two seats objected
 *   7. half-finished boards     — bottom; nobody argued for it across devices
 *
 * Dropping which BONUS words were found is what makes this small: those masks
 * were 3.8KB of high-entropy data on their own. Target words are six per board
 * and fit in six bits, so the whole catalogue costs one byte per board.
 *
 * Result: ~880 characters, fixed, regardless of how far in you are. That fits
 * in a URL, which is the transfer the board actually endorsed — copy a link,
 * send it to yourself, tap it on the new phone. No typing, no camera.
 *
 * QR IS DELIBERATELY NOT BUILT. The board refused it: a game that asks for
 * nothing, asking for camera permission to move a word game's streak, is a
 * worse trade than losing the streak. Two accessibility seats also cannot
 * reliably aim a camera. The code is small enough to QR; we are choosing not to.
 */
import type { Progress } from './storage';
import { EMPTY } from './storage';
import type { PuzzleFile } from './game';

export const CODE_PREFIX = 'wordy2:';
/** Day 0 for the played-days bitmap. Before the game existed, so nothing is lost. */
const EPOCH = Date.UTC(2025, 0, 1);
const DAY_MS = 86_400_000;
/**
 * Ceiling on how far from EPOCH a played day can be, so a corrupt code cannot
 * ask us to allocate an enormous bitmap. The bitmap itself is NOT this size —
 * it spans only first-played to last-played, because provisioning twelve years
 * up front cost 548 bytes of zeros, half the payload, for a player who has
 * been here a month.
 */
const DAY_SPAN = 4383;
const HEADER = 24;

const dayIndex = (key: string): number => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return -1;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const i = Math.round((t - EPOCH) / DAY_MS);
  return i >= 0 && i < DAY_SPAN ? i : -1;
};

const keyFromIndex = (i: number): string => {
  const d = new Date(EPOCH + i * DAY_MS);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
};

/**
 * A cheap fingerprint of the catalogue this code was made against.
 *
 * Board state is stored positionally, so if the catalogue is rebuilt and the
 * boards move, applying those bits would mark the WRONG puzzles cleared. The
 * fingerprint lets a restore detect that and keep only the parts that do not
 * depend on catalogue order — which is most of what the board ranked highest.
 */
export function fingerprint(file: PuzzleFile): number {
  let h = 0x811c9dc5;
  for (const p of file.puzzles) {
    for (let i = 0; i < p.base.length; i++) {
      h ^= p.base.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h & 0xffff;
}

const b64url = (bytes: Uint8Array): string => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const unb64url = (s: string): Uint8Array => {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

/** Everything the board ranked as worth carrying, as a pasteable code. */
export function encodeProgress(p: Progress, file: PuzzleFile): string {
  const n = file.puzzles.length;
  const dayIdx = Object.keys(p.days)
    .map(dayIndex)
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);
  // Span only what the player actually has. A byte boundary on the start keeps
  // the shift arithmetic trivial on the way back out.
  const firstDay = dayIdx.length ? (dayIdx[0] >> 3) << 3 : 0;
  const dayBytes = dayIdx.length ? Math.ceil((dayIdx[dayIdx.length - 1] - firstDay + 1) / 8) : 0;
  const buf = new Uint8Array(HEADER + dayBytes + n);
  const view = new DataView(buf.buffer);

  buf[0] = 2;
  view.setUint16(1, fingerprint(file), true);
  view.setUint16(3, Math.min(p.streak, 65535), true);
  view.setUint16(5, Math.min(p.bestStreak, 65535), true);
  view.setUint32(7, Math.min(p.bonusTotal, 0xffffffff), true);
  view.setUint32(11, Math.min(p.spent, 0xffffffff), true);
  buf[15] = Math.min(p.warmupsDone, 255);
  buf[16] =
    (p.muted ? 1 : 0) | (p.clueMode ? 2 : 0) | (p.escalating ? 4 : 0) | (p.seenIntro ? 8 : 0);
  const last = p.lastPlayed ? dayIndex(p.lastPlayed) : -1;
  view.setUint16(17, last < 0 ? 0xffff : last, true);
  view.setUint16(19, n, true);
  view.setUint16(21, firstDay, true);
  buf[23] = Math.min(dayBytes, 255);

  for (const i of dayIdx) {
    const off = i - firstDay;
    buf[HEADER + (off >> 3)] |= 1 << (off & 7);
  }

  const cleared = new Set(p.clearedIds);
  const base = HEADER + dayBytes;
  file.puzzles.forEach((puz, i) => {
    const id = String(puz.id);
    // A cleared board has every target word by definition, so the cleared flag
    // and a full mask are the same fact. Storing the mask alone keeps one
    // source of truth and lets a partial board restore mid-solve.
    if (cleared.has(id)) {
      buf[base + i] = 0x3f;
      return;
    }
    const found = p.words[id];
    if (!found?.length) return;
    let mask = 0;
    puz.grid.forEach((w, gi) => {
      if (found.includes(w)) mask |= 1 << gi;
    });
    buf[base + i] = mask;
  });

  return CODE_PREFIX + b64url(buf);
}

export type DecodeResult =
  | { ok: true; progress: Progress; boardsRestored: number; catalogueMatched: boolean }
  | { ok: false; reason: string };

/**
 * Read a code back.
 *
 * Returns what it restored so the caller can SAY so. The board's 10+ bar was a
 * restore that "states plainly what came back and what didn't" — a silent
 * partial restore is how a player concludes the feature is broken.
 */
export function decodeProgress(code: string, file: PuzzleFile): DecodeResult {
  const trimmed = code.trim();
  if (!trimmed.startsWith(CODE_PREFIX)) {
    return { ok: false, reason: 'That does not look like a Wordy backup code.' };
  }
  let buf: Uint8Array;
  try {
    buf = unb64url(trimmed.slice(CODE_PREFIX.length));
  } catch {
    return { ok: false, reason: 'That code could not be read — check it copied in full.' };
  }
  if (buf.length < HEADER || buf[0] !== 2) {
    return { ok: false, reason: 'That code is from a version this app cannot read.' };
  }
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const stored = view.getUint16(1, true);
  const catalogueMatched = stored === fingerprint(file);

  const flags = buf[16];
  const lastIdx = view.getUint16(17, true);
  const firstDay = view.getUint16(21, true);
  const dayBytes = buf[23];
  if (buf.length < HEADER + dayBytes || firstDay + dayBytes * 8 > DAY_SPAN) {
    return { ok: false, reason: 'That code could not be read — check it copied in full.' };
  }
  const days: Record<string, true> = {};
  for (let off = 0; off < dayBytes * 8; off++) {
    if (buf[HEADER + (off >> 3)] & (1 << (off & 7))) days[keyFromIndex(firstDay + off)] = true;
  }

  const words: Record<string, string[]> = {};
  const clearedIds: string[] = [];
  let boardsRestored = 0;
  if (catalogueMatched) {
    const base = HEADER + dayBytes;
    const count = Math.min(view.getUint16(19, true), file.puzzles.length);
    for (let i = 0; i < count; i++) {
      const mask = buf[base + i];
      if (!mask) continue;
      const puz = file.puzzles[i];
      const found = puz.grid.filter((_, gi) => mask & (1 << gi));
      words[String(puz.id)] = found;
      if (mask === 0x3f) clearedIds.push(String(puz.id));
      boardsRestored++;
    }
  }

  const progress: Progress = {
    ...EMPTY,
    words,
    reveals: {},
    days,
    clearedIds,
    streak: view.getUint16(3, true),
    bestStreak: view.getUint16(5, true),
    lastPlayed: lastIdx === 0xffff ? null : keyFromIndex(lastIdx),
    bonusTotal: view.getUint32(7, true),
    spent: view.getUint32(11, true),
    muted: (flags & 1) !== 0,
    clueMode: (flags & 2) !== 0,
    escalating: (flags & 4) !== 0,
    seenIntro: (flags & 8) !== 0,
    warmupsDone: buf[15],
  };

  return { ok: true, progress, boardsRestored, catalogueMatched };
}

/** A link the player can send themselves — the transfer the board endorsed. */
export function backupLink(p: Progress, file: PuzzleFile, origin: string): string {
  return `${origin.replace(/\/$/, '')}/#restore=${encodeProgress(p, file).slice(CODE_PREFIX.length)}`;
}

/** Pull a code out of a `#restore=` link, if this load came from one. */
export function codeFromHash(hash: string): string | null {
  const m = /[#&]restore=([A-Za-z0-9\-_]+)/.exec(hash);
  return m ? CODE_PREFIX + m[1] : null;
}
