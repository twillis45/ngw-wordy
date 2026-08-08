import fs from 'node:fs/promises';
import path from 'node:path';
import Game from '@/components/Game';
import type { PuzzleFile } from '@/lib/game';

/**
 * Puzzles are read at build time and inlined into the payload. No API route,
 * no client fetch — the game is playable the instant the page paints, and
 * offline once the PWA cache warms.
 */
export default async function Page() {
  const file = path.join(process.cwd(), 'public', 'data', 'puzzles.json');
  const data = JSON.parse(await fs.readFile(file, 'utf8')) as PuzzleFile;
  return <Game data={data} />;
}
