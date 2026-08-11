import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  CODE_PREFIX,
  backupLink,
  codeFromHash,
  decodeProgress,
  encodeProgress,
  fingerprint,
  puzzleFromHash,
} from './backup';
import { EMPTY, type Progress } from './storage';
import type { PuzzleFile } from './game';

const file = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'public/data/puzzles.json'), 'utf8')
) as PuzzleFile;

/** A player who is well into the catalogue — the case v1 could not carry. */
function heavyPlayer(): Progress {
  const words: Record<string, string[]> = {};
  const clearedIds: string[] = [];
  const days: Record<string, true> = {};
  file.puzzles.forEach((p, i) => {
    if (i % 3 === 0) {
      words[String(p.id)] = [...p.grid];
      clearedIds.push(String(p.id));
    } else if (i % 3 === 1) {
      words[String(p.id)] = p.grid.slice(0, 2); // half-solved
    }
  });
  for (let d = 1; d <= 300; d += 1) {
    days[`2026-${String(Math.ceil(d / 28)).padStart(2, '0')}-${String((d % 28) + 1).padStart(2, '0')}`] =
      true;
  }
  return {
    ...EMPTY,
    words,
    clearedIds,
    days,
    streak: 180,
    bestStreak: 221,
    lastPlayed: '2026-08-11',
    bonusTotal: 900,
    spent: 312,
    muted: false,
    clueMode: true,
    escalating: true,
    seenIntro: true,
    warmupsDone: 8,
  };
}

describe('backup codes', () => {
  it('round-trips everything the board ranked as worth carrying', () => {
    const p = heavyPlayer();
    const out = decodeProgress(encodeProgress(p, file), file);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const r = out.progress;
    expect(r.streak).toBe(180);
    expect(r.bestStreak).toBe(221);
    expect(r.lastPlayed).toBe('2026-08-11');
    expect(r.bonusTotal).toBe(900);
    expect(r.spent).toBe(312);
    expect(r.warmupsDone).toBe(8);
    // Settings rank ABOVE the streak for the accessibility seats: a config that
    // does not survive makes the new phone unplayable on arrival.
    expect(r.muted).toBe(false);
    expect(r.clueMode).toBe(true);
    expect(r.escalating).toBe(true);
    expect(r.seenIntro).toBe(true);
    expect(Object.keys(r.days).length).toBe(Object.keys(p.days).length);
    expect(r.clearedIds.sort()).toEqual(p.clearedIds.sort());
  });

  it('carries a half-solved board back mid-solve', () => {
    const p = heavyPlayer();
    const partial = file.puzzles[1];
    const out = decodeProgress(encodeProgress(p, file), file);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.progress.words[String(partial.id)]).toEqual(partial.grid.slice(0, 2));
  });

  it('stays small enough to put in a link, however far in the player is', () => {
    // v1 was btoa(JSON.stringify(progress)) — 38,000 chars for this player, which
    // is the whole reason this module exists. The size is fixed by the catalogue,
    // not by progress, so a completionist's code is no bigger than a beginner's.
    const heavy = encodeProgress(heavyPlayer(), file).length;
    const fresh = encodeProgress(EMPTY, file).length;
    // Only the played-day span varies with progress; the board bytes are fixed
    // by the catalogue, so a completionist is barely larger than a beginner.
    expect(heavy - fresh).toBeLessThan(80);
    expect(heavy).toBeLessThan(1000);
  });

  it('refuses a code from another catalogue rather than marking wrong boards cleared', () => {
    // Board state is positional. If the catalogue is rebuilt and boards move,
    // applying those bits would clear puzzles the player never played.
    const code = encodeProgress(heavyPlayer(), file);
    const shifted: PuzzleFile = { ...file, puzzles: file.puzzles.slice(1) };
    const out = decodeProgress(code, shifted);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.catalogueMatched).toBe(false);
    expect(out.boardsRestored).toBe(0);
    expect(out.progress.clearedIds).toEqual([]);
    // ...but the things that do NOT depend on catalogue order still come back,
    // and those are what the board ranked first.
    expect(out.progress.streak).toBe(180);
    expect(out.progress.bestStreak).toBe(221);
    expect(Object.keys(out.progress.days).length).toBeGreaterThan(0);
    expect(out.progress.escalating).toBe(true);
  });

  it('reports how much came back so the caller can say it', () => {
    const out = decodeProgress(encodeProgress(heavyPlayer(), file), file);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.catalogueMatched).toBe(true);
    expect(out.boardsRestored).toBeGreaterThan(100);
  });

  it('rejects junk without throwing', () => {
    for (const junk of ['', 'hello', CODE_PREFIX, `${CODE_PREFIX}!!!!`, 'wordy1:abc']) {
      const out = decodeProgress(junk, file);
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.reason.length).toBeGreaterThan(10);
    }
  });

  it('makes a link the player can send themselves, and reads it back', () => {
    const p = heavyPlayer();
    const link = backupLink(p, file, 'https://wordy.example/');
    expect(link).toContain('#restore=');
    const recovered = codeFromHash(new URL(link).hash);
    expect(recovered).toBe(encodeProgress(p, file));
    const out = decodeProgress(recovered!, file);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.progress.streak).toBe(180);
  });

  it('ignores a hash that is not a restore link', () => {
    expect(codeFromHash('')).toBeNull();
    expect(codeFromHash('#settings')).toBeNull();
  });

  it('carries display settings, which rank above the streak', () => {
    // The accessibility seats rated a display config ABOVE the streak in what
    // must survive: a board that arrives unreadable on the new phone is not a
    // degraded experience, it is an unusable one.
    const code = encodeProgress(heavyPlayer(), file, { text: 'larger', reading: 'relaxed' });
    const out = decodeProgress(code, file);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.display).toEqual({ text: 'larger', reading: 'relaxed' });
    // ...and the flags they share a byte with are undamaged.
    expect(out.progress.escalating).toBe(true);
    expect(out.progress.muted).toBe(false);
    expect(out.progress.clueMode).toBe(true);
    expect(out.progress.seenIntro).toBe(true);
  });

  it('defaults display settings when the code carries none', () => {
    const out = decodeProgress(encodeProgress(heavyPlayer(), file), file);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.display).toEqual({ text: 'default', reading: 'default' });
  });

  it('survives a stale catalogue with settings intact', () => {
    // The whole point of the fingerprint fallback: the board list is dropped,
    // but the things ranked 1, 2 and 4 all still arrive.
    const code = encodeProgress(heavyPlayer(), file, { text: 'large', reading: 'relaxed' });
    const shifted: PuzzleFile = { ...file, puzzles: file.puzzles.slice(1) };
    const out = decodeProgress(code, shifted);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.catalogueMatched).toBe(false);
    expect(out.display).toEqual({ text: 'large', reading: 'relaxed' });
    expect(out.progress.streak).toBe(180);
  });

  it('fingerprints two different catalogues differently', () => {
    const shifted: PuzzleFile = { ...file, puzzles: file.puzzles.slice(1) };
    expect(fingerprint(file)).not.toBe(fingerprint(shifted));
  });
});

describe('play links', () => {
  it('reads the board number a shared card points at', () => {
    expect(puzzleFromHash('#play=137')).toBe(137);
    expect(puzzleFromHash('#restore=abc&play=42')).toBe(42);
  });

  it('ignores anything that is not a plain positive number', () => {
    // The number came off a link somebody may have retyped. Coercing junk
    // would land the reader on a board nobody was talking about.
    for (const h of ['', '#play=', '#play=0', '#play=-3', '#play=abc', '#restore=xyz', '#play=1e9'])
      expect(puzzleFromHash(h)).toBeNull();
  });
});
