'use client';

import { withBase } from './basePath';

/**
 * Definitions, loaded on demand.
 *
 * The file is ~390KB — larger than the puzzles — so it is NOT bundled into the
 * page or inlined at build time. It is fetched once after first paint and then
 * cached by the service worker, so it costs nothing on the critical path and
 * still works offline on later visits.
 *
 * Entries are [definition] for a direct hit, or [definition, lemma] when the
 * definition came from a base form — so the UI can say "from acorn" rather
 * than silently defining a different word.
 */
export type Entry = [definition: string, lemma?: string];
export type Definitions = Record<string, Entry>;

let cache: Definitions | null = null;
let inFlight: Promise<Definitions> | null = null;

export function loadDefinitions(): Promise<Definitions> {
  if (cache) return Promise.resolve(cache);
  if (inFlight) return inFlight;

  inFlight = fetch(withBase('/data/definitions.json'))
    .then((r) => (r.ok ? r.json() : {}))
    .then((data: Definitions) => {
      cache = data;
      return data;
    })
    .catch(() => {
      // Offline on a first visit, or the asset is missing. Definitions are an
      // enhancement — the game must not care.
      cache = {};
      return cache;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export function lookup(defs: Definitions | null, word: string): Entry | null {
  if (!defs) return null;
  return defs[word] ?? null;
}
