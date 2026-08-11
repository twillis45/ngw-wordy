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

  it('fingerprints two different catalogues differently', () => {
    const shifted: PuzzleFile = { ...file, puzzles: file.puzzles.slice(1) };
    expect(fingerprint(file)).not.toBe(fingerprint(shifted));
  });
});
