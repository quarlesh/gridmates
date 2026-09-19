import fs from 'node:fs/promises';
import path from 'node:path';
import { parsePuz } from './puz-parser';

export async function loadPuzzle(filename = 'ucs260913.puz') {
  const file = await fs.readFile(path.join(process.cwd(), 'puzzles', filename));
  return parsePuz(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), filename);
}
