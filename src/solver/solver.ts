import puzzleData from '../data/pieces.json';
import { getOrientations } from './orient.ts';
import { DLX } from './dlx.ts';
import type { Cell, Placement, PuzzleData, SolveResult } from './types.ts';

const data = puzzleData as unknown as PuzzleData;

export const ROWS = data.board.rows;
export const COLS = data.board.cols;
export const LABELS = data.board.labels;
export const PIECES = data.pieces;

const BLOCKED = new Set(
  data.board.blocked.map(([r, c]) => `${r},${c}`),
);

export function isBlocked(r: number, c: number): boolean {
  return BLOCKED.has(`${r},${c}`);
}

export function labelAt(r: number, c: number): string | null {
  for (const [label, [lr, lc]] of Object.entries(LABELS)) {
    if (lr === r && lc === c) return label;
  }
  return null;
}

export function cellForLabel(label: string): Cell {
  const c = LABELS[label];
  if (!c) throw new Error(`未知标签: ${label}`);
  return c as Cell;
}

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);
const DAY_LABELS = Array.from({ length: 31 }, (_, i) => `${i + 1}日`);
const WEEKDAY_LABELS = [
  '星期日',
  '星期一',
  '星期二',
  '星期三',
  '星期四',
  '星期五',
  '星期六',
];

export { MONTH_LABELS, DAY_LABELS, WEEKDAY_LABELS };

/** Clamp day for month (non-leap Feb=28 for simplicity of calendar wood puzzle). */
export function daysInMonth(month: number): number {
  if (month === 2) return 28;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

export function todayShanghai(): { month: number; day: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  const month = Number(parts.month);
  let day = Number(parts.day);
  const max = daysInMonth(month);
  if (day > max) day = max;
  const wdMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekday = wdMap[parts.weekday ?? 'Wed'] ?? 3;
  return { month, day, weekday };
}

interface BuiltPlacement {
  pieceId: string;
  cells: Cell[];
  cellBits: number[]; // indices into freeCells
  pieceIndex: number;
}

function buildFreeCells(targets: Set<string>): string[] {
  const free: string[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const key = `${r},${c}`;
      if (!BLOCKED.has(key) && !targets.has(key)) free.push(key);
    }
  }
  return free;
}

function enumeratePlacements(
  freeCells: string[],
): { placements: BuiltPlacement[]; numCells: number; numPieces: number } {
  const cellIndex = new Map(freeCells.map((k, i) => [k, i]));
  const numCells = freeCells.length;
  const numPieces = PIECES.length;
  const placements: BuiltPlacement[] = [];

  PIECES.forEach((piece, pi) => {
    for (const orient of getOrientations(piece.cells as Cell[])) {
      for (let baseR = 0; baseR < ROWS; baseR++) {
        for (let baseC = 0; baseC < COLS; baseC++) {
          const placed: Cell[] = orient.map(([dr, dc]) => [baseR + dr, baseC + dc]);
          const keys = placed.map(([r, c]) => `${r},${c}`);
          if (!keys.every((k) => cellIndex.has(k))) continue;
          placements.push({
            pieceId: piece.id,
            cells: placed,
            cellBits: keys.map((k) => cellIndex.get(k)!),
            pieceIndex: pi,
          });
        }
      }
    }
  });

  return { placements, numCells, numPieces };
}

export class CalendarSolver {
  private targets: Set<string>;
  private allSolutions: Placement[][] = [];
  private cursor = -1;
  private exhausted = false;
  private lastElapsed = 0;
  private batchSize: number;

  constructor(
    month: number,
    day: number,
    weekday: number,
    batchSize = 20,
  ) {
    this.batchSize = batchSize;
    const mLabel = `${month}月`;
    const dLabel = `${day}日`;
    const wLabel = WEEKDAY_LABELS[weekday]!;
    const [mr, mc] = cellForLabel(mLabel);
    const [dr, dc] = cellForLabel(dLabel);
    const [wr, wc] = cellForLabel(wLabel);
    this.targets = new Set([`${mr},${mc}`, `${dr},${dc}`, `${wr},${wc}`]);
  }

  get targetCells(): Set<string> {
    return this.targets;
  }

  private runBatch(limit: number): void {
    const t0 = performance.now();
    const freeCells = buildFreeCells(this.targets);
    if (freeCells.length !== 47) {
      this.exhausted = true;
      this.lastElapsed = performance.now() - t0;
      return;
    }
    const { placements, numCells, numPieces } = enumeratePlacements(freeCells);
    const dlx = new DLX(numCells + numPieces, limit);
    for (const p of placements) {
      const cols = [...p.cellBits, numCells + p.pieceIndex];
      dlx.addRow(cols, { pieceId: p.pieceId, cells: p.cells });
    }
    const sols = dlx.solveAll();
    this.allSolutions = sols.map((sol) =>
      sol.map((m) => ({ pieceId: m.pieceId, cells: m.cells })),
    );
    this.exhausted = sols.length < limit;
    this.lastElapsed = performance.now() - t0;
  }

  /** Find first solution (or reuse if already computed). */
  solveFirst(): SolveResult | null {
    if (this.allSolutions.length === 0 && !this.exhausted) {
      this.runBatch(this.batchSize);
    }
    if (this.allSolutions.length === 0) return null;
    this.cursor = 0;
    return {
      placements: this.allSolutions[0]!,
      elapsedMs: this.lastElapsed,
      solutionIndex: 0,
      exhausted: this.exhausted && this.allSolutions.length === 1,
    };
  }

  /** Next distinct solution in the precomputed batch. */
  nextSolution(): SolveResult | null {
    if (this.allSolutions.length === 0 && !this.exhausted) {
      this.runBatch(this.batchSize);
    }
    if (this.cursor + 1 >= this.allSolutions.length) {
      return null;
    }
    this.cursor++;
    return {
      placements: this.allSolutions[this.cursor]!,
      elapsedMs: this.lastElapsed,
      solutionIndex: this.cursor,
      exhausted:
        this.exhausted && this.cursor === this.allSolutions.length - 1,
    };
  }

  get solutionCount(): number {
    return this.allSolutions.length;
  }

  get currentIndex(): number {
    return this.cursor;
  }
}

/** One-shot solve for testing. */
export function solveDate(
  month: number,
  day: number,
  weekday: number,
): SolveResult | null {
  const s = new CalendarSolver(month, day, weekday, 1);
  return s.solveFirst();
}
