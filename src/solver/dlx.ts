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

export class DLX {
  private header: Column;
  private columns: Column[];
  private rowMeta: DLXRowMeta[];
  private solution: number[] = [];
  private found: DLXRowMeta[] | null = null;
  private solutions: DLXRowMeta[][] = [];
  private maxSolutions: number;
  private stop = false;

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

  private search(): void {
    if (this.stop) return;
    if (this.header.R === this.header) {
      const sol = this.solution.map((r) => this.rowMeta[r]!);
      this.solutions.push(sol);
      if (this.solutions.length === 1) this.found = sol;
      if (this.solutions.length >= this.maxSolutions) this.stop = true;
      return;
    }

    // Choose column with fewest options (MRV)
    let col: Column | null = null;
    let minSize = Infinity;
    for (let c = this.header.R as Column; c !== this.header; c = c.R as Column) {
      if (c.size < minSize) {
        minSize = c.size;
        col = c;
        if (minSize === 0) break;
      }
    }
    if (!col || minSize === 0) return;

    this.cover(col);
    for (let r = col.D; r !== col && !this.stop; r = r.D) {
      this.solution.push(r.row);
      for (let j = r.R; j !== r; j = j.R) this.cover(j.C);
      this.search();
      for (let j = r.L; j !== r; j = j.L) this.uncover(j.C);
      this.solution.pop();
    }
    this.uncover(col);
  }

  solveAll(): DLXRowMeta[][] {
    this.solutions = [];
    this.found = null;
    this.stop = false;
    this.solution = [];
    this.search();
    return this.solutions;
  }

  solveOne(): DLXRowMeta[] | null {
    this.maxSolutions = 1;
    this.solveAll();
    return this.found;
  }
}
