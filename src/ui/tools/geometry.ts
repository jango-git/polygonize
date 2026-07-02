// A plain point in image space (world coordinates, Y down). Shared by every tool
// interaction module; structurally compatible with the document's vertex/anchor/center
// shapes, so those can be passed wherever a Vector2 is expected.
export interface Vector2 {
  x: number;
  y: number;
}

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
