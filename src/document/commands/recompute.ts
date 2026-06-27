import { lookupColor, type ColorGrid } from "../../domain/colorGrid.js";
import { requestColors } from "../../domain/colorWorkerClient.js";
import { triangulate } from "../../domain/triangulation.js";
import { DeltaOperation, signals } from "../signals.js";
import { store } from "../store.js";
import { newTriangleUUID, type Color, type Point, type PointUUID } from "../types.js";

const GRAY: Color = { r: 128, g: 128, b: 128 };

let colorGrid: ColorGrid | null = null;

export function resetColorGrid(): void {
  colorGrid = null;
}

export function applyColorGrid(grid: ColorGrid): void {
  const startTime = performance.now();
  colorGrid = grid;
  const data = store.data();
  const byUUID = new Map<PointUUID, Point>();
  for (const p of data.points) byUUID.set(p.uuid, p);

  for (const tri of data.triangles) {
    const pa = byUUID.get(tri.a);
    const pb = byUUID.get(tri.b);
    const pc = byUUID.get(tri.c);
    if (!pa || !pb || !pc) continue;
    const cx = (pa.x + pb.x + pc.x) / 3;
    const cy = (pa.y + pb.y + pc.y) / 3;
    tri.color = lookupColor(grid, cx, cy);
  }

  console.log(
    `[applyColorGrid] ${data.triangles.length} lookups in ${(performance.now() - startTime).toFixed(1)}ms`,
  );
  signals.triangles.emit({ op: DeltaOperation.UPDATE });
}

export function recomputeTriangles(): void {
  const startTime = performance.now();
  const data = store.data();
  const byUUID = new Map<PointUUID, Point>();
  for (const p of data.points) byUUID.set(p.uuid, p);

  const triangulateStart = performance.now();
  const indices = triangulate(data.points, data.constraintEdges);
  const triangulateTime = performance.now() - triangulateStart;

  const mapStart = performance.now();
  const coords = new Float64Array(indices.length * 6);

  data.triangles = indices.map(({ a, b, c }, t) => {
    const pa = byUUID.get(a) ?? { x: 0, y: 0 };
    const pb = byUUID.get(b) ?? { x: 0, y: 0 };
    const pc = byUUID.get(c) ?? { x: 0, y: 0 };

    const o = t * 6;
    coords[o] = pa.x;
    coords[o + 1] = pa.y;
    coords[o + 2] = pb.x;
    coords[o + 3] = pb.y;
    coords[o + 4] = pc.x;
    coords[o + 5] = pc.y;

    const centX = (pa.x + pb.x + pc.x) / 3;
    const centY = (pa.y + pb.y + pc.y) / 3;
    const color = colorGrid ? lookupColor(colorGrid, centX, centY) : { ...GRAY };

    return { uuid: newTriangleUUID(), a, b, c, color };
  });

  const mapTime = performance.now() - mapStart;

  requestColors(coords, store.data().colorSettings);

  console.log(
    `[recompute] ${data.points.length} pts -> ${indices.length} tris: ` +
      `triangulate ${triangulateTime.toFixed(1)}ms | map ${mapTime.toFixed(1)}ms | ` +
      `total ${(performance.now() - startTime).toFixed(1)}ms`,
  );
}
