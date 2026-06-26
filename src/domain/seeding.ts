import { newPointUUID, type Point } from "../document/types.js";
import type { DensityMap } from "./featureMap.js";
import type { SeedSettings } from "../settings/types.js";

const UNIFORM_FLOOR = 0.04;
const MAX_PLACEMENT_ATTEMPTS = 16;

export function generateSeedPoints(
  width: number,
  height: number,
  settings: SeedSettings,
  density: DensityMap,
): Point[] {
  const points: Point[] = [];
  const add = (x: number, y: number) => points.push({ uuid: newPointUUID(), x, y });

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

  const target = Math.max(0, Math.floor(settings.pointCount));
  if (target === 0) return points;

  const cdf = buildWeightedCdf(density, settings.edgeSensitivity);
  const minD2 = settings.minDistance * settings.minDistance;

  for (let i = 0; i < target; i++) {
    let placed: { x: number; y: number } | null = null;
    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
      const c = sampleCell(cdf, density.cols, density.rows, width, height);
      if (minD2 <= 0 || farEnough(points, c.x, c.y, minD2)) {
        placed = c;
        break;
      }
      placed = c;
    }
    if (placed) add(placed.x, placed.y);
  }

  return points;
}

interface Cdf {
  cumulative: Float64Array;
  total: number;
}

function buildWeightedCdf(density: DensityMap, sensitivity: number): Cdf {
  const n = density.values.length;
  const cumulative = new Float64Array(n);
  let acc = 0;
  const flat = n === 0;
  const count = flat ? 1 : n;
  const buf = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const d = flat ? 1 : density.values[i];
    const w = Math.pow(d, sensitivity) + UNIFORM_FLOOR;
    acc += w;
    buf[i] = acc;
  }
  if (!flat) cumulative.set(buf);
  return {
    cumulative: flat ? buf : cumulative,
    total: acc,
  };
}

function sampleCell(
  cdf: Cdf,
  cols: number,
  rows: number,
  width: number,
  height: number,
): { x: number; y: number } {
  if (cols === 0 || rows === 0) {
    return { x: Math.random() * width, y: Math.random() * height };
  }
  const r = Math.random() * cdf.total;
  const idx = lowerBound(cdf.cumulative, r);
  const cx = idx % cols;
  const cy = Math.floor(idx / cols);
  const x = ((cx + Math.random()) / cols) * width;
  const y = ((cy + Math.random()) / rows) * height;
  return {
    x: Math.min(width, Math.max(0, x)),
    y: Math.min(height, Math.max(0, y)),
  };
}

function lowerBound(cumulative: Float64Array, value: number): number {
  let lo = 0;
  let hi = cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function farEnough(points: Point[], x: number, y: number, minD2: number): boolean {
  for (const p of points) {
    const dx = p.x - x;
    const dy = p.y - y;
    if (dx * dx + dy * dy < minD2) return false;
  }
  return true;
}
