export type Direction = 'ACROSS' | 'DOWN';

export interface CrosswordCell {
  row: number;
  column: number;
  isBlock: boolean;
  answer: string | null;
}

export interface CrosswordClue {
  number: number;
  direction: Direction;
  text: string;
  row: number;
  column: number;
  length: number;
  answer: string;
  cells: string[];
}

export interface CrosswordPuzzle {
  id: string;
  title: string;
  author: string;
  copyright: string;
  width: number;
  height: number;
  cells: CrosswordCell[];
  clues: CrosswordClue[];
}
