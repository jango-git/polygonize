// Canonical 2D point lives in the domain layer (used by modifiers + preview too);
// re-exported here so tool modules keep importing it alongside the other geometry
// helpers.
export type { Vector2 } from "../../domain/vector2.js";
import type { Vector2 } from "../../domain/vector2.js";

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Axis-aligned bounds of a point set. An empty input yields an inverted (Infinity) box, so
// callers frame something meaningful only after guarding against an empty outline.
export function bounds(points: Vector2[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, minY, maxX, maxY };
}
