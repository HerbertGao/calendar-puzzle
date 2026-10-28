export type Cell = [number, number];

export interface PieceDef {
  id: string;
  size: number;
  cells: Cell[];
  orientations: number;
  ascii: string;
}

export interface BoardDef {
  rows: number;
  cols: number;
  blocked: Cell[];
  labels: Record<string, Cell>;
}

export interface PuzzleData {
  board: BoardDef;
  pieces: PieceDef[];
  notes?: string;
}

export interface Placement {
  pieceId: string;
  cells: Cell[];
}

export interface SolveResult {
  placements: Placement[];
  elapsedMs: number;
  solutionIndex: number;
  /** True when the search has finished and no further solutions exist. */
  exhausted: boolean;
}

export interface SolveProgress {
  found: number;
  elapsedMs: number;
  exhausted: boolean;
}
