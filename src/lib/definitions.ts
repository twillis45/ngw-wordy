'use client';

import { withBase } from './basePath';

/**
 * Definitions, hybrid.
 *
 *   1. A bundled floor: Webster's Unabridged, filtered at build time to only
 *      the words the puzzle set can produce. Public domain, works offline,
 *      and Victorian — it defines "linker" as a torch made of tow and pitch.
 *   2. A modern upgrade: fetched per word on demand and cached, so the reading
 *      is contemporary whenever there's a connection.
 *
 * The floor is what makes this safe to depend on: the network can be absent or
 * the API can vanish and the feature degrades to archaic-but-present rather
 * than broken. The upgrade is what makes it good.
 *
 * The bundled file is ~390KB — larger than the puzzles — so it is NOT inlined
 * into the page. It is fetched once after first paint and cached by the service
 * worker.
 */

/** Bundled entry: [definition] or [definition, lemma] when a base form was used. */
export type Entry = [definition: string, lemma?: string];
export type Definitions = Record<string, Entry>;

export type Source = 'modern' | 'archaic';

export type Resolved = {
  word: string;
  definition: string;
  partOfSpeech?: string;
  /** Set when the bundled definition came from a base form. */
  lemma?: string;
  source: Source;
};

/* ── Bundled floor ────────────────────────────────────────────────────── */

let bundled: Definitions | null = null;
let bundledInFlight: Promise<Definitions> | null = null;

export function loadDefinitions(): Promise<Definitions> {
  if (bundled) return Promise.resolve(bundled);
  if (bundledInFlight) return bundledInFlight;

  bundledInFlight = fetch(withBase('/data/definitions.json'))
    .then((r) => (r.ok ? r.json() : {}))
    .then((data: Definitions) => {
      bundled = data;
      return data;
    })
    .catch(() => {
      // Offline on a first visit, or the asset is missing. Definitions are an
      // enhancement — the game must not care.
      bundled = {};
      return bundled;
    })
    .finally(() => {
      bundledInFlight = null;
    });

  return bundledInFlight;
}

export function lookup(defs: Definitions | null, word: string): Entry | null {
  if (!defs) return null;
  return defs[word] ?? null;
}

/* ── Modern upgrade ───────────────────────────────────────────────────── */

const API = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const CACHE_KEY = 'ngw-wordy/defs-modern/v1';
/** Cap so a long-lived browser can't grow this without bound. */
const CACHE_MAX = 600;

type CachedModern = {
  d: string;
  p?: string;
  /** null records a confirmed miss, so we don't re-ask every time. */
  miss?: true;
};

type ModernCache = Record<string, CachedModern>;

function readCache(): ModernCache {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeCache(cache: ModernCache) {
  if (typeof window === 'undefined') return;
  try {
    const keys = Object.keys(cache);
    if (keys.length > CACHE_MAX) {
      // Insertion order is preserved for string keys, so the oldest are first.
      const trimmed: ModernCache = {};
      for (const k of keys.slice(keys.length - CACHE_MAX)) trimmed[k] = cache[k];
      cache = trimmed;
    }
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* quota or private mode — the cache is an optimisation, never required */
  }
}

/**
 * Pull the first usable sense out of a dictionaryapi.dev payload.
 *
 * Pure and defensive on purpose: this parses a third-party shape we don't
 * control, so every level is checked rather than trusted.
 */
export function parseModern(payload: unknown): CachedModern | null {
  if (!Array.isArray(payload)) return null;

  for (const entry of payload) {
    const meanings = (entry as { meanings?: unknown })?.meanings;
    if (!Array.isArray(meanings)) continue;

    for (const meaning of meanings) {
      const m = meaning as {
        partOfSpeech?: unknown;
        definitions?: unknown;
      };
      if (!Array.isArray(m.definitions)) continue;

      for (const d of m.definitions) {
        const text = (d as { definition?: unknown })?.definition;
        if (typeof text !== 'string' || text.trim().length < 3) continue;
        return {
          d: text.trim(),
          p: typeof m.partOfSpeech === 'string' ? m.partOfSpeech : undefined,
        };
      }
    }
  }
  return null;
}

/**
 * Resolve the best available definition for a word.
 *
 * Returns immediately from cache when possible. When a modern definition has
 * to be fetched, the caller gets the bundled floor first (via `fallback`) and
 * this promise resolves later with the upgrade — so the sheet shows something
 * instantly and improves in place rather than showing a spinner.
 */
export async function resolveModern(word: string): Promise<Resolved | null> {
  const cache = readCache();
  const hit = cache[word];
  if (hit?.miss) return null;
  if (hit) {
    return { word, definition: hit.d, partOfSpeech: hit.p, source: 'modern' };
  }

  // navigator.onLine is unreliable in general but a decent early exit: false
  // is trustworthy, true only means "an interface exists".
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return null;
  }

  try {
    const res = await fetch(`${API}${encodeURIComponent(word)}`);
    if (!res.ok) {
      // 404 is a definitive "no such word" — remember it.
      if (res.status === 404) writeCache({ ...cache, [word]: { d: '', miss: true } });
      return null;
    }
    const parsed = parseModern(await res.json());
    if (!parsed) return null;

    writeCache({ ...cache, [word]: parsed });
    return {
      word,
      definition: parsed.d,
      partOfSpeech: parsed.p,
      source: 'modern',
    };
  } catch {
    // Offline, blocked, or the API is down. The bundled floor already covered
    // the player; a failed upgrade is a non-event.
    return null;
  }
}

/** The bundled floor as a Resolved, so both sources share one shape. */
export function fromBundled(word: string, entry: Entry): Resolved {
  return {
    word,
    definition: entry[0],
    lemma: entry[1],
    source: 'archaic',
  };
}
