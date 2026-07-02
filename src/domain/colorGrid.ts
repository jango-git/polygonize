import type { Color } from "../document/types.js";

export interface ColorGrid {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  entries: Float32Array;
  cellIndex: Int32Array;
}

const GRAY: Color = { r: 128, g: 128, b: 128 };

export function lookupColor(grid: ColorGrid, cx: number, cy: number): Color {
  const { cols, rows, cellWidth, cellHeight, entries, cellIndex } = grid;
  const col = Math.min(Math.max(Math.floor(cx / cellWidth), 0), cols - 1);
  const row = Math.min(Math.max(Math.floor(cy / cellHeight), 0), rows - 1);

  let bestDist = Infinity;
  let bestRed = GRAY.r,
    bestGreen = GRAY.g,
    bestBlue = GRAY.b;

  const minCell = Math.min(cellWidth, cellHeight);
  const maxRing = Math.max(cols, rows);

  for (let ring = 0; ring <= maxRing; ring++) {
    if (bestDist !== Infinity) {
      const ringMin = (ring - 1) * minCell;
      if (ringMin > 0 && ringMin * ringMin > bestDist) break;
    }

    const rowStart = row - ring,
      rowEnd = row + ring;
    const colStart = col - ring,
      colEnd = col + ring;
    for (let rowIndex = rowStart; rowIndex <= rowEnd; rowIndex++) {
      if (rowIndex < 0 || rowIndex >= rows) continue;
      const edgeRow = rowIndex === rowStart || rowIndex === rowEnd;
      for (let colIndex = colStart; colIndex <= colEnd; colIndex++) {
        if (colIndex < 0 || colIndex >= cols) continue;

        if (!edgeRow && colIndex !== colStart && colIndex !== colEnd) continue;
        const i = rowIndex * cols + colIndex;
        const start = cellIndex[i * 2];
        const count = cellIndex[i * 2 + 1];
        for (let k = 0; k < count; k++) {
          const o = (start + k) * 5;
          const dx = cx - entries[o];
          const dy = cy - entries[o + 1];
          const d = dx * dx + dy * dy;
          if (d < bestDist) {
            bestDist = d;
            bestRed = entries[o + 2];
            bestGreen = entries[o + 3];
            bestBlue = entries[o + 4];
          }
        }
      }
    }
  }

  if (bestDist === Infinity) return { ...GRAY };
  return { r: bestRed, g: bestGreen, b: bestBlue };
}
