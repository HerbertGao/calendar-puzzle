/**
 * Knuth's Algorithm X with Dancing Links (DLX).
 * Primary columns must be covered exactly once.
 * Secondary columns (piece-use) are also exact-once here.
 */

export interface DLXRowMeta {
  pieceId: string;
  cells: [number, number][];
}

class Node {
  L: Node = this;
  R: Node = this;
  U: Node = this;
  D: Node = this;
  C!: Column;
  row = -1;
}

class Column extends Node {
  size = 0;
  name: string;
  constructor(name: string) {
    super();
    this.C = this;
    this.name = name;
  }
}

interface Frame {
  phase: 0 | 1 | 2;
  col: Column | null;
  row: Node | null;
}

const FRAME_CAP = 64;

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
      // Background tabs may not fire rAF; don't stall the search there.
      setTimeout(resolve, 50);
      return;
    }
    setTimeout(resolve, 0);
  });
}

export interface DLXAsyncOptions {
  /** Search budget per turn before yielding to the event loop. */
  yieldEveryMs?: number;
  onSolution?: (solution: DLXRowMeta[], index: number) => void;
  onSlice?: (found: number) => void;
  isCancelled?: () => boolean;
}

export interface DLXAsyncResult {
  found: number;
  exhausted: boolean;
  cancelled: boolean;
}

export class DLX {
  private header: Column;
  private columns: Column[];
  private rowMeta: DLXRowMeta[];
  private solution: number[] = [];
  private found: DLXRowMeta[] | null = null;
  private solutions: DLXRowMeta[][] = [];
  private maxSolutions: number;
  private stop = false;
  private frames: Frame[] = Array.from({ length: FRAME_CAP }, () => ({
    phase: 0 as const,
    col: null,
    row: null,
  }));
  private sp = 0;
  private onSolution: ((solution: DLXRowMeta[], index: number) => void) | null = null;

  constructor(numCols: number, maxSolutions = 1) {
    this.header = new Column('H');
    this.columns = [];
    this.rowMeta = [];
    this.maxSolutions = maxSolutions;

    let prev: Column = this.header;
    for (let i = 0; i < numCols; i++) {
      const col = new Column(String(i));
      this.columns.push(col);
      col.L = prev;
      col.R = this.header;
      prev.R = col;
      this.header.L = col;
      prev = col;
    }
  }

  addRow(colIndices: number[], meta: DLXRowMeta): void {
    const rowIdx = this.rowMeta.length;
    this.rowMeta.push(meta);
    let first: Node | null = null;
    let prev: Node | null = null;
    for (const ci of colIndices) {
      const col = this.columns[ci]!;
      const node = new Node();
      node.C = col;
      node.row = rowIdx;
      // vertical
      node.U = col.U;
      node.D = col;
      col.U.D = node;
      col.U = node;
      col.size++;
      // horizontal
      if (!first) {
        first = node;
        prev = node;
      } else {
        node.L = prev!;
        node.R = first;
        prev!.R = node;
        first.L = node;
        prev = node;
      }
    }
  }

  private cover(col: Column): void {
    col.R.L = col.L;
    col.L.R = col.R;
    for (let i = col.D; i !== col; i = i.D) {
      for (let j = i.R; j !== i; j = j.R) {
        j.D.U = j.U;
        j.U.D = j.D;
        j.C.size--;
      }
    }
  }

  private uncover(col: Column): void {
    for (let i = col.U; i !== col; i = i.U) {
      for (let j = i.L; j !== i; j = j.L) {
        j.C.size++;
        j.D.U = j;
        j.U.D = j;
      }
    }
    col.R.L = col;
    col.L.R = col;
  }

  private beginSearch(): void {
    this.solutions = [];
    this.found = null;
    this.stop = false;
    this.solution = [];
    this.sp = 1;
    const root = this.frames[0]!;
    root.phase = 0;
    root.col = null;
    root.row = null;
  }

  /**
   * One explicit-stack step of Algorithm X.
   * Phase 0 chooses a column, phase 1 tries the next row, phase 2 backtracks.
   * Returns false when the stack is empty (search finished).
   */
  private step(): boolean {
    const frame = this.frames[this.sp - 1]!;

    if (frame.phase === 0) {
      if (this.stop) {
        this.sp--;
        return this.sp > 0;
      }
      if (this.header.R === this.header) {
        const sol = this.solution.map((r) => this.rowMeta[r]!);
        this.solutions.push(sol);
        if (this.solutions.length === 1) this.found = sol;
        this.onSolution?.(sol, this.solutions.length - 1);
        if (this.solutions.length >= this.maxSolutions) this.stop = true;
        this.sp--;
        return this.sp > 0;
      }

      // Choose column with fewest options (MRV). Ties keep the leftmost column.
      let col: Column | null = null;
      let minSize = Infinity;
      for (let c = this.header.R as Column; c !== this.header; c = c.R as Column) {
        if (c.size < minSize) {
          minSize = c.size;
          col = c;
          if (minSize === 0) break;
        }
      }
      if (!col || minSize === 0) {
        this.sp--;
        return this.sp > 0;
      }
      this.cover(col);
      frame.col = col;
      frame.row = col.D;
      frame.phase = 1;
      return true;
    }

    if (frame.phase === 1) {
      const col = frame.col!;
      const row = frame.row!;
      if (row === col || this.stop) {
        this.uncover(col);
        this.sp--;
        return this.sp > 0;
      }
      this.solution.push(row.row);
      for (let j = row.R; j !== row; j = j.R) this.cover(j.C);
      frame.phase = 2;
      if (this.sp >= FRAME_CAP) {
        throw new Error('DLX 搜索栈溢出');
      }
      const child = this.frames[this.sp]!;
      child.phase = 0;
      child.col = null;
      child.row = null;
      this.sp++;
      return true;
    }

    const row = frame.row!;
    for (let j = row.L; j !== row; j = j.L) this.uncover(j.C);
    this.solution.pop();
    frame.row = row.D;
    frame.phase = 1;
    return true;
  }

  /** Run until the search finishes or `deadline` (ms timestamp) is reached. */
  private runSlice(deadline: number): boolean {
    const timed = deadline < Number.POSITIVE_INFINITY;
    let steps = 0;
    while (this.sp > 0) {
      if (timed && (steps++ & 1023) === 0 && performance.now() >= deadline) {
        return false;
      }
      this.step();
    }
    return true;
  }

  solveAll(): DLXRowMeta[][] {
    this.onSolution = null;
    this.beginSearch();
    this.runSlice(Number.POSITIVE_INFINITY);
    return this.solutions;
  }

  /**
   * Enumerate solutions in time slices so the caller can paint and stay responsive.
   * `exhausted` is true only when the search finished without hitting `maxSolutions`.
   */
  async solveAllAsync(options?: DLXAsyncOptions): Promise<DLXAsyncResult> {
    this.onSolution = options?.onSolution ?? null;
    this.beginSearch();
    const yieldEveryMs = options?.yieldEveryMs ?? 16;
    const isCancelled = options?.isCancelled;
    try {
      while (this.sp > 0) {
        if (isCancelled?.()) {
          return { found: this.solutions.length, exhausted: false, cancelled: true };
        }
        const done = this.runSlice(performance.now() + yieldEveryMs);
        options?.onSlice?.(this.solutions.length);
        if (done) break;
        await yieldToMain();
      }
    } finally {
      this.onSolution = null;
    }
    return {
      found: this.solutions.length,
      exhausted: this.solutions.length < this.maxSolutions,
      cancelled: false,
    };
  }

  solveOne(): DLXRowMeta[] | null {
    this.maxSolutions = 1;
    this.solveAll();
    return this.found;
  }
}
