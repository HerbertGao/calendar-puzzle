import type { Cell } from './types.ts';

function normalize(coords: Cell[]): Cell[] {
  const minR = Math.min(...coords.map(([r]) => r));
  const minC = Math.min(...coords.map(([, c]) => c));
  return coords
    .map(([r, c]): Cell => [r - minR, c - minC])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

function rotate90(coords: Cell[]): Cell[] {
  return coords.map(([r, c]): Cell => [c, -r]);
}

function flipH(coords: Cell[]): Cell[] {
  return coords.map(([r, c]): Cell => [r, -c]);
}

function keyOf(coords: Cell[]): string {
  return coords.map(([r, c]) => `${r},${c}`).join('|');
}

/** All distinct rotations + reflections, normalized to origin. */
export function getOrientations(piece: Cell[]): Cell[][] {
  const seen = new Set<string>();
  const result: Cell[][] = [];
  let cur = piece;
  for (let i = 0; i < 4; i++) {
    for (const variant of [cur, flipH(cur)]) {
      const norm = normalize(variant);
      const key = keyOf(norm);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(norm);
      }
    }
    cur = rotate90(cur);
  }
  return result;
}
