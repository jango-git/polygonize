import { newPointUUID, type Point } from "../document/types.js";
import type { DensityMap } from "./featureMap.js";
import type { SeedSettings } from "../settings/types.js";

const MAX_CANDIDATES = 30;
const MAX_INTERIOR = 20_000;

export function generateSeedPoints(
  width: number,
  height: number,
  settings: SeedSettings,
  density: DensityMap,
): Point[] {
  const points: Point[] = [];
  const add = (x: number, y: number): number => {
    const idx = points.length;
    points.push({ uuid: newPointUUID(), x, y });
    return idx;
  };

  add(0, 0);
  add(width, 0);
  add(width, height);
  add(0, height);

  const per = Math.max(0, Math.floor(settings.borderPerSide));
  for (let i = 1; i <= per; i++) {
    const tx = (width * i) / (per + 1);
    const ty = (height * i) / (per + 1);
    add(tx, 0);
    add(tx, height);
    add(0, ty);
    add(width, ty);
  }

  const minR = Math.max(1, settings.minRadius);
  const maxR = Math.max(minR + 1, settings.maxRadius);

  const cellSize = minR / Math.SQRT2;
  const gridCols = Math.ceil(width / cellSize) + 2;
  const gridRows = Math.ceil(height / cellSize) + 2;
  const grid = new Int32Array(gridCols * gridRows).fill(-1);

  const insertIntoGrid = (idx: number): void => {
    const p = points[idx];
    const cx = Math.floor(p.x / cellSize);
    const cy = Math.floor(p.y / cellSize);
    const gi = cy * gridCols + cx;
    if (gi >= 0 && gi < grid.length) grid[gi] = idx;
  };

  for (let i = 0; i < points.length; i++) insertIntoGrid(i);

  const radiusAt = (x: number, y: number): number => {
    const sobel = sampleDensity(density, x / width, y / height);
    return minR + (1 - sobel) * (maxR - minR);
  };

  const searchCells = Math.ceil(maxR / cellSize);
  const tooClose = (x: number, y: number, r: number): boolean => {
    const cx = Math.floor(x / cellSize);
    const cy = Math.floor(y / cellSize);
    const r2 = r * r;
    for (let dy = -searchCells; dy <= searchCells; dy++) {
      const ny = cy + dy;
      if (ny < 0 || ny >= gridRows) continue;
      for (let dx = -searchCells; dx <= searchCells; dx++) {
        const nx = cx + dx;
        if (nx < 0 || nx >= gridCols) continue;
        const pidx = grid[ny * gridCols + nx];
        if (pidx < 0) continue;
        const p = points[pidx];
        const ddx = p.x - x;
        const ddy = p.y - y;
        if (ddx * ddx + ddy * ddy < r2) return true;
      }
    }
    return false;
  };

  const borderCount = points.length;
  const active: number[] = Array.from({ length: borderCount }, (_, i) => i);

  while (active.length > 0 && points.length - borderCount < MAX_INTERIOR) {
    const ai = Math.floor(Math.random() * active.length);
    const pi = active[ai];
    const p = points[pi];
    const r = radiusAt(p.x, p.y);

    let placed = false;
    for (let k = 0; k < MAX_CANDIDATES; k++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = r + Math.random() * r;
      const qx = p.x + Math.cos(angle) * dist;
      const qy = p.y + Math.sin(angle) * dist;

      if (qx < 0 || qx > width || qy < 0 || qy > height) continue;

      const rq = radiusAt(qx, qy);
      if (tooClose(qx, qy, rq)) continue;

      const qi = add(qx, qy);
      insertIntoGrid(qi);
      active.push(qi);
      placed = true;
      break;
    }

    if (!placed) {
      active[ai] = active[active.length - 1];
      active.pop();
    }
  }

  return points;
}

function sampleDensity(density: DensityMap, u: number, v: number): number {
  if (density.cols === 0 || density.rows === 0) return 0;
  const x = Math.max(0, Math.min(density.cols - 1, u * (density.cols - 1)));
  const y = Math.max(0, Math.min(density.rows - 1, v * (density.rows - 1)));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, density.cols - 1);
  const y1 = Math.min(y0 + 1, density.rows - 1);
  const fx = x - x0;
  const fy = y - y0;
  const v00 = density.values[y0 * density.cols + x0];
  const v10 = density.values[y0 * density.cols + x1];
  const v01 = density.values[y1 * density.cols + x0];
  const v11 = density.values[y1 * density.cols + x1];
  return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
}
