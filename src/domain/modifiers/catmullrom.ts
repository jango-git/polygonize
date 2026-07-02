import type { PathModifier } from "../../document/types.js";
import {
  SAMPLES_PER_SEGMENT,
  cumulativeLengths,
  pointCountForLength,
  sampleAtArc,
} from "./curve.js";
import type { Vector2 } from "../vector2.js";

export function defaultCatmullRomPointCount(
  vertices: Vector2[],
  closed: boolean,
  density = 1,
): number {
  return pointCountForLength(catmullRomOutline(vertices, closed), closed ? 3 : 2, density);
}

export function placeAlongCurve(modifier: PathModifier): Vector2[] {
  const dense = catmullRomOutline(modifier.vertices, modifier.closed);
  if (dense.length <= 1) return dense.slice();

  const cumulative = cumulativeLengths(dense);
  const total = cumulative[cumulative.length - 1];
  if (total === 0) return [dense[0]];

  const count = Math.max(modifier.closed ? 3 : 2, Math.floor(modifier.pointCount));
  const denominator = modifier.closed ? count : count - 1;
  const out: Vector2[] = [];
  for (let i = 0; i < count; i++) {
    out.push(sampleAtArc(dense, cumulative, (total * i) / denominator));
  }
  return out;
}

export function catmullRomOutline(
  vertices: Vector2[],
  closed: boolean,
  samples = SAMPLES_PER_SEGMENT,
): Vector2[] {
  const n = vertices.length;
  if (n === 0) return [];
  if (n === 1) return [{ x: vertices[0].x, y: vertices[0].y }];

  const out: Vector2[] = [];
  const segmentCount = closed ? n : n - 1;
  for (let i = 0; i < segmentCount; i++) {
    const p0 = vertices[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const p1 = vertices[i % n];
    const p2 = vertices[(i + 1) % n];
    const p3 = vertices[closed ? (i + 2) % n : Math.min(n - 1, i + 2)];
    for (let j = 0; j < samples; j++) {
      out.push(interpolate(p0, p1, p2, p3, j / samples));
    }
  }
  out.push(
    closed
      ? { x: vertices[0].x, y: vertices[0].y }
      : { x: vertices[n - 1].x, y: vertices[n - 1].y },
  );
  return out;
}

function interpolate(p0: Vector2, p1: Vector2, p2: Vector2, p3: Vector2, t: number): Vector2 {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}
