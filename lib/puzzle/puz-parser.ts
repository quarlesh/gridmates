import { CrosswordClue, CrosswordPuzzle, Direction } from './types';

function readNullString(bytes: Uint8Array, offset: number): [string, number] {
  let end = offset;
  while (end < bytes.length && bytes[end] !== 0) end++;
  return [new TextDecoder('latin1').decode(bytes.slice(offset, end)), end + 1];
}

function wordCells(row: number, column: number, length: number, direction: Direction, width: number): string[] {
  return Array.from({ length }, (_, i) => {
    const r = direction === 'ACROSS' ? row : row + i;
    const c = direction === 'ACROSS' ? column + i : column;
    return `${r}-${c}`;
  });
}

export function parsePuz(buffer: any, id = 'puzzle'): CrosswordPuzzle {
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder('latin1');
  // The 12-byte .puz signature includes a trailing NUL byte.
  const signature = decoder.decode(bytes.slice(2, 14)).replace(/\0+$/, '');
  if (signature !== 'ACROSS&DOWN') throw new Error('Not a valid .puz file.');

  // Standard .puz header: 0x2c width, 0x2d height, 0x2e clue count.
  const width = bytes[0x2c];
  const height = bytes[0x2d];
  const clueCount = bytes[0x2e] | (bytes[0x2f] << 8);
  if (!width || !height) throw new Error('Invalid puzzle dimensions.');

  const gridSize = width * height;
  const solutionOffset = 0x34;
  const stateOffset = solutionOffset + gridSize;
  const textOffset = stateOffset + gridSize;

  const solution = decoder.decode(bytes.slice(solutionOffset, solutionOffset + gridSize));
  let cursor = textOffset;
  const strings: string[] = [];
  for (let i = 0; i < clueCount + 3; i++) {
    const [value, next] = readNullString(bytes, cursor);
    strings.push(value);
    cursor = next;
  }

  const title = strings[0] ?? 'Untitled Crossword';
  const author = strings[1] ?? '';
  const copyright = strings[2] ?? '';
  const clueTexts = strings.slice(3, 3 + clueCount);

  const grid = Array.from({ length: gridSize }, (_, i) => solution[i]);
  const cells: CrosswordPuzzle['cells'] = [];
  const clues: CrosswordClue[] = [];

  const isBlock = (r: number, c: number) => grid[r * width + c] === '.';
  const startsAcross = (r: number, c: number) => !isBlock(r, c) && c + 1 < width && !isBlock(r, c + 1) && (c === 0 || isBlock(r, c - 1));
  const startsDown = (r: number, c: number) => !isBlock(r, c) && r + 1 < height && !isBlock(r + 1, c) && (r === 0 || isBlock(r - 1, c));

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      cells.push({ row: r, column: c, isBlock: isBlock(r, c), answer: isBlock(r, c) ? null : grid[r * width + c] });
    }
  }

  // .puz stores clues in clue-number order: for each numbered square,
  // an Across clue (if any) is followed by a Down clue (if any).
  // Build the numbered starts first, then consume the clue strings in that
  // exact order.
  const numberedStarts: Array<{ number: number; row: number; column: number; across: boolean; down: boolean }> = [];
  let number = 0;

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (isBlock(r, c)) continue;
      const across = startsAcross(r, c);
      const down = startsDown(r, c);
      if (!across && !down) continue;
      number++;
      numberedStarts.push({ number, row: r, column: c, across, down });
    }
  }

  let clueIndex = 0;

  for (const start of numberedStarts) {
    const { number, row: r, column: c, across, down } = start;

    if (across) {
      let length = 0;
      while (c + length < width && !isBlock(r, c + length)) length++;
      const answer = grid.slice(r * width + c, r * width + c + length).join('');
      clues.push({
        number,
        direction: 'ACROSS',
        text: clueTexts[clueIndex++] ?? '',
        row: r,
        column: c,
        length,
        answer,
        cells: wordCells(r, c, length, 'ACROSS', width),
      });
    }

    if (down) {
      let length = 0;
      while (r + length < height && !isBlock(r + length, c)) length++;
      const answer = Array.from({ length }, (_, i) => grid[(r + i) * width + c]).join('');
      clues.push({
        number,
        direction: 'DOWN',
        text: clueTexts[clueIndex++] ?? '',
        row: r,
        column: c,
        length,
        answer,
        cells: wordCells(r, c, length, 'DOWN', width),
      });
    }
  }

  return { id, title, author, copyright, width, height, cells, clues };
}
