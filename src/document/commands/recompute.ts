import { lookupColor, type ColorGrid } from "../../domain/colorGrid.js";
import { requestColors } from "../../domain/colorWorkerClient.js";
import { DeltaOperation, signals } from "../signals.js";
import { store } from "../store.js";
import { type Color, type Point } from "../types.js";

const GRAY: Color = { r: 128, g: 128, b: 128 };

let colorGrid: ColorGrid | undefined;

export function resetColorGrid(): void {
  colorGrid = undefined;
}

export function applyColorGrid(grid: ColorGrid): void {
  colorGrid = grid;
  const data = store.data();
  const positions = data.renderPositions;
  const colors = data.renderColors;

  for (let t = 0; t < data.triangleCount; t++) {
    const positionOffset = t * 9;
    const cx =
      (positions[positionOffset] + positions[positionOffset + 3] + positions[positionOffset + 6]) /
      3;
    const cy =
      (positions[positionOffset + 1] +
        positions[positionOffset + 4] +
        positions[positionOffset + 7]) /
      3;
    const color = lookupColor(grid, cx, cy);
    const colorOffset = t * 3;
    colors[colorOffset] = color.r;
    colors[colorOffset + 1] = color.g;
    colors[colorOffset + 2] = color.b;
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

  const triangleCount = (triangleIndices.length / 3) | 0;
  // `coordinates` (xy, f64) is transferred to the color worker; the render buffers
  // (xyz positions + rgb colors) stay on the main thread for the preview.
  const coordinates = new Float64Array(triangleCount * 6);
  const renderPositions = new Float32Array(triangleCount * 9);
  const renderColors = new Uint8Array(triangleCount * 3);

  for (let t = 0; t < triangleCount; t++) {
    const pa = points[triangleIndices[t * 3]];
    const pb = points[triangleIndices[t * 3 + 1]];
    const pc = points[triangleIndices[t * 3 + 2]];

    const coordinateOffset = t * 6;
    coordinates[coordinateOffset] = pa.x;
    coordinates[coordinateOffset + 1] = pa.y;
    coordinates[coordinateOffset + 2] = pb.x;
    coordinates[coordinateOffset + 3] = pb.y;
    coordinates[coordinateOffset + 4] = pc.x;
    coordinates[coordinateOffset + 5] = pc.y;

    const positionOffset = t * 9;
    renderPositions[positionOffset] = pa.x;
    renderPositions[positionOffset + 1] = pa.y;
    renderPositions[positionOffset + 3] = pb.x;
    renderPositions[positionOffset + 4] = pb.y;
    renderPositions[positionOffset + 6] = pc.x;
    renderPositions[positionOffset + 7] = pc.y;

    const centerX = (pa.x + pb.x + pc.x) / 3;
    const centerY = (pa.y + pb.y + pc.y) / 3;
    const color = colorGrid ? lookupColor(colorGrid, centerX, centerY) : GRAY;

    const colorOffset = t * 3;
    renderColors[colorOffset] = color.r;
    renderColors[colorOffset + 1] = color.g;
    renderColors[colorOffset + 2] = color.b;
  }

  data.renderPositions = renderPositions;
  data.renderColors = renderColors;
  data.triangleCount = triangleCount;
  requestColors(coordinates, data.colorSettings);
}

/**
 * Recompute colors for the existing geometry without re-triangulating. Used when only
 * color settings change. Rebuilds the worker coordinates from the render position buffer.
 */
export function recomputeColors(): void {
  const data = store.data();
  const positions = data.renderPositions;
  const count = data.triangleCount;

  const coordinates = new Float64Array(count * 6);
  for (let t = 0; t < count; t++) {
    const positionOffset = t * 9;
    const coordinateOffset = t * 6;
    coordinates[coordinateOffset] = positions[positionOffset];
    coordinates[coordinateOffset + 1] = positions[positionOffset + 1];
    coordinates[coordinateOffset + 2] = positions[positionOffset + 3];
    coordinates[coordinateOffset + 3] = positions[positionOffset + 4];
    coordinates[coordinateOffset + 4] = positions[positionOffset + 6];
    coordinates[coordinateOffset + 5] = positions[positionOffset + 7];
  }

  requestColors(coordinates, data.colorSettings);
}
