import { lookupColor, type ColorGrid } from "../../domain/colorGrid.js";
import { requestColors } from "../../domain/colorWorkerClient.js";
import { DeltaOperation, signals } from "../signals.js";
import { store } from "../store.js";
import { type Color, type Point } from "../types.js";

const GRAY: Color = { r: 128, g: 128, b: 128 };

let colorGrid: ColorGrid | null = null;

export function resetColorGrid(): void {
  colorGrid = null;
}

export function applyColorGrid(grid: ColorGrid): void {
  colorGrid = grid;
  const data = store.data();
  const positions = data.renderPositions;
  const colors = data.renderColors;

  for (let t = 0; t < data.triangleCount; t++) {
    const po = t * 9;
    const cx = (positions[po] + positions[po + 3] + positions[po + 6]) / 3;
    const cy = (positions[po + 1] + positions[po + 4] + positions[po + 7]) / 3;
    const color = lookupColor(grid, cx, cy);
    const co = t * 3;
    colors[co] = color.r;
    colors[co + 1] = color.g;
    colors[co + 2] = color.b;
  }

  signals.triangles.emit({ op: DeltaOperation.UPDATE });
}

/**
 * Build the render buffers from a freshly computed point set and triangle index triples
 * (indices into `points`). Triangles live only as flat buffers - no per-triangle
 * objects or UUIDs. Assigns provisional colors and kicks off the async color pass.
 */
export function buildGeometry(points: Point[], triangleIndices: Uint32Array): void {
  const data = store.data();
  data.points = points;

  const triCount = (triangleIndices.length / 3) | 0;
  // `coords` (xy, f64) is transferred to the color worker; the render buffers
  // (xyz positions + rgb colors) stay on the main thread for the preview.
  const coords = new Float64Array(triCount * 6);
  const renderPositions = new Float32Array(triCount * 9);
  const renderColors = new Uint8Array(triCount * 3);

  for (let t = 0; t < triCount; t++) {
    const pa = points[triangleIndices[t * 3]];
    const pb = points[triangleIndices[t * 3 + 1]];
    const pc = points[triangleIndices[t * 3 + 2]];

    const o = t * 6;
    coords[o] = pa.x;
    coords[o + 1] = pa.y;
    coords[o + 2] = pb.x;
    coords[o + 3] = pb.y;
    coords[o + 4] = pc.x;
    coords[o + 5] = pc.y;

    const po = t * 9;
    renderPositions[po] = pa.x;
    renderPositions[po + 1] = pa.y;
    renderPositions[po + 3] = pb.x;
    renderPositions[po + 4] = pb.y;
    renderPositions[po + 6] = pc.x;
    renderPositions[po + 7] = pc.y;

    const centX = (pa.x + pb.x + pc.x) / 3;
    const centY = (pa.y + pb.y + pc.y) / 3;
    const color = colorGrid ? lookupColor(colorGrid, centX, centY) : GRAY;

    const co = t * 3;
    renderColors[co] = color.r;
    renderColors[co + 1] = color.g;
    renderColors[co + 2] = color.b;
  }

  data.renderPositions = renderPositions;
  data.renderColors = renderColors;
  data.triangleCount = triCount;
  requestColors(coords, data.colorSettings);
}

/**
 * Recompute colors for the existing geometry without re-triangulating. Used when only
 * color settings change. Rebuilds the worker coords from the render position buffer.
 */
export function recomputeColors(): void {
  const data = store.data();
  const positions = data.renderPositions;
  const count = data.triangleCount;

  const coords = new Float64Array(count * 6);
  for (let t = 0; t < count; t++) {
    const po = t * 9;
    const o = t * 6;
    coords[o] = positions[po];
    coords[o + 1] = positions[po + 1];
    coords[o + 2] = positions[po + 3];
    coords[o + 3] = positions[po + 4];
    coords[o + 4] = positions[po + 6];
    coords[o + 5] = positions[po + 7];
  }

  requestColors(coords, data.colorSettings);
}
