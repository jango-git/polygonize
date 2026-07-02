import type { Vector2 } from "../vector2.js";

// Outline builders emit this many samples per control span. Shared by the
// catmull-rom and bezier samplers.
export const SAMPLES_PER_SEGMENT = 16;

// Default point spacing (px) and hard cap used when auto-sizing a curve's point
// count from its arc length.
export const DEFAULT_SPACING_PX = 50;
export const DEFAULT_MAX_POINTS = 128;

// Cumulative arc length along a dense polyline: cum[i] is the distance from
// dense[0] to dense[i], so cum[last] is the total length.
export function cumulativeLengths(dense: Vector2[]): number[] {
  const cum: number[] = [0];
  for (let i = 1; i < dense.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y));
  }
  return cum;
}

// Point on a dense polyline at arc length s, linearly interpolated within the
// span it falls in. Clamps to the endpoints outside [0, total].
export function sampleAtArc(dense: Vector2[], cum: number[], s: number): Vector2 {
  if (s <= 0) return { x: dense[0].x, y: dense[0].y };
  const last = dense.length - 1;
  if (s >= cum[last]) return { x: dense[last].x, y: dense[last].y };
  for (let i = 1; i < dense.length; i++) {
    if (s <= cum[i]) {
      const seg = cum[i] - cum[i - 1];
      const t = seg === 0 ? 0 : (s - cum[i - 1]) / seg;
      const a = dense[i - 1];
      const b = dense[i];
      return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    }
  }
  return { x: dense[last].x, y: dense[last].y };
}

// Auto point count for a curve: one point per DEFAULT_SPACING_PX of arc length
// (scaled by density), clamped to [minCount, DEFAULT_MAX_POINTS].
export function pointCountForLength(dense: Vector2[], minCount: number, density: number): number {
  let length = 0;
  for (let i = 1; i < dense.length; i++) {
    length += Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y);
  }
  const count = Math.round((length / DEFAULT_SPACING_PX) * density);
  return Math.min(DEFAULT_MAX_POINTS, Math.max(minCount, count));
}
