import type { Color } from "../document/types.js";

export interface ColorGrid {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  entries: Float32Array;
  cellIndex: Int32Array;
}

const GRAY: Color = { r: 128, g: 128, b: 128 };

export function lookupColor(grid: ColorGrid, cx: number, cy: number): Color {
  const { cols, rows, cellW, cellH, entries, cellIndex } = grid;
  const col = Math.min(Math.max(Math.floor(cx / cellW), 0), cols - 1);
  const row = Math.min(Math.max(Math.floor(cy / cellH), 0), rows - 1);

  let bestDist = Infinity;
  let br = 128,
    bg = 128,
    bb = 128;

  const minCell = Math.min(cellW, cellH);
  const maxR = Math.max(cols, rows);

  for (let r = 0; r <= maxR; r++) {
    if (bestDist !== Infinity) {
      const ringMin = (r - 1) * minCell;
      if (ringMin > 0 && ringMin * ringMin > bestDist) break;
    }

    const r0 = row - r,
      r1 = row + r;
    const c0 = col - r,
      c1 = col + r;
    for (let rr = r0; rr <= r1; rr++) {
      if (rr < 0 || rr >= rows) continue;
      const edgeRow = rr === r0 || rr === r1;
      for (let cc = c0; cc <= c1; cc++) {
        if (cc < 0 || cc >= cols) continue;

        if (!edgeRow && cc !== c0 && cc !== c1) continue;
        const i = rr * cols + cc;
        const start = cellIndex[i * 2];
        const count = cellIndex[i * 2 + 1];
        for (let k = 0; k < count; k++) {
          const o = (start + k) * 5;
          const dx = cx - entries[o];
          const dy = cy - entries[o + 1];
          const d = dx * dx + dy * dy;
          if (d < bestDist) {
            bestDist = d;
            br = entries[o + 2];
            bg = entries[o + 3];
            bb = entries[o + 4];
          }
        }
      }
    }
  }

  if (bestDist === Infinity) return { ...GRAY };
  return { r: br, g: bg, b: bb };
}
