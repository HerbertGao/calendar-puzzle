import puzzleData from '../data/pieces.json';
import { getOrientations } from './orient.ts';
import { DLX } from './dlx.ts';
import type { Cell, Placement, PuzzleData, SolveProgress, SolveResult } from './types.ts';

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

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Day count for the free combination mode. February is always 28, matching the wooden puzzle. */
export function daysInMonth(month: number): number {
  if (month === 2) return 28;
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30;
  return 31;
}

/** Real Gregorian month length. February 29 is included only in leap years. */
export function daysInRealMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return daysInMonth(month);
}

/** Weekday of a Gregorian date. 0 = Sunday … 6 = Saturday. */
export function weekdayOf(year: number, month: number, day: number): number {
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  let y = year;
  if (month < 3) y -= 1;
  const n =
    y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) +
    offsets[month - 1]! +
    day;
  return ((n % 7) + 7) % 7;
}

export function todayShanghai(): {
  year: number;
  month: number;
  day: number;
  weekday: number;
} {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const wdMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekday = wdMap[parts.weekday ?? ''] ?? weekdayOf(year, month, day);
  return { year, month, day, weekday };
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
  private searchExhausted = false;
  private lastElapsed = 0;

  constructor(month: number, day: number, weekday: number) {
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

  get solutionCount(): number {
    return this.allSolutions.length;
  }

  get currentIndex(): number {
    return this.cursor;
  }

  /** True when enumeration finished and every solution has been collected. */
  get exhausted(): boolean {
    return this.searchExhausted;
  }

  get elapsedMs(): number {
    return this.lastElapsed;
  }

  private buildDlx(maxSolutions: number): DLX | null {
    const freeCells = buildFreeCells(this.targets);
    if (freeCells.length !== 47) return null;
    const { placements, numCells, numPieces } = enumeratePlacements(freeCells);
    const dlx = new DLX(numCells + numPieces, maxSolutions);
    for (const p of placements) {
      const cols = [...p.cellBits, numCells + p.pieceIndex];
      dlx.addRow(cols, { pieceId: p.pieceId, cells: p.cells });
    }
    return dlx;
  }

  private resultAt(index: number): SolveResult {
    return {
      placements: this.allSolutions[index]!,
      elapsedMs: this.lastElapsed,
      solutionIndex: index,
      exhausted: this.searchExhausted,
    };
  }

  private progress(exhausted: boolean): SolveProgress {
    this.searchExhausted = exhausted;
    return {
      found: this.allSolutions.length,
      elapsedMs: this.lastElapsed,
      exhausted,
    };
  }

  /**
   * Enumerate every solution, yielding between short slices so the page stays responsive.
   * `onProgress` may fire many times; `exhausted` is true only on the final result.
   */
  async enumerate(
    onProgress?: (progress: SolveProgress) => void,
    isCancelled?: () => boolean,
  ): Promise<SolveProgress> {
    const t0 = performance.now();
    this.allSolutions = [];
    this.cursor = -1;
    this.searchExhausted = false;
    this.lastElapsed = 0;

    const touch = (exhausted: boolean): SolveProgress => {
      this.lastElapsed = performance.now() - t0;
      return this.progress(exhausted);
    };

    const dlx = this.buildDlx(Number.POSITIVE_INFINITY);
    if (!dlx) {
      const done = touch(true);
      onProgress?.(done);
      return done;
    }

    let reportedFirst = false;
    const result = await dlx.solveAllAsync({
      yieldEveryMs: 16,
      isCancelled,
      onSolution: (sol) => {
        this.allSolutions.push(
          sol.map((m) => ({ pieceId: m.pieceId, cells: m.cells })),
        );
        if (!reportedFirst) {
          reportedFirst = true;
          this.lastElapsed = performance.now() - t0;
          onProgress?.(this.progress(false));
        }
      },
      onSlice: () => {
        this.lastElapsed = performance.now() - t0;
        onProgress?.(this.progress(false));
      },
    });

    if (result.cancelled) return touch(false);
    const done = touch(true);
    onProgress?.(done);
    return done;
  }

  /** Synchronous search, capped at `limit` (default: a single solution). */
  solveFirst(limit = 1): SolveResult | null {
    const t0 = performance.now();
    this.allSolutions = [];
    this.cursor = -1;
    this.searchExhausted = false;
    const dlx = this.buildDlx(limit);
    if (!dlx) {
      this.searchExhausted = true;
      this.lastElapsed = performance.now() - t0;
      return null;
    }
    const sols = dlx.solveAll();
    this.allSolutions = sols.map((sol) =>
      sol.map((m) => ({ pieceId: m.pieceId, cells: m.cells })),
    );
    this.searchExhausted = sols.length < limit;
    this.lastElapsed = performance.now() - t0;
    if (this.allSolutions.length === 0) return null;
    this.cursor = 0;
    return this.resultAt(0);
  }

  solutionAt(index: number): SolveResult | null {
    if (index < 0 || index >= this.allSolutions.length) return null;
    this.cursor = index;
    return this.resultAt(index);
  }

  nextSolution(): SolveResult | null {
    if (this.cursor + 1 >= this.allSolutions.length) return null;
    this.cursor++;
    return this.resultAt(this.cursor);
  }

  prevSolution(): SolveResult | null {
    if (this.cursor <= 0) return null;
    this.cursor--;
    return this.resultAt(this.cursor);
  }
}

/** One-shot solve for testing. */
export function solveDate(
  month: number,
  day: number,
  weekday: number,
): SolveResult | null {
  const s = new CalendarSolver(month, day, weekday);
  return s.solveFirst(1);
}
