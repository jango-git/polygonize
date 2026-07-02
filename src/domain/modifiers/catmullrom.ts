import type { PathModifier } from "../../document/types.js";
import {
  SAMPLES_PER_SEGMENT,
  cumulativeLengths,
  pointCountForLength,
  sampleAtArc,
} from "./curve.js";
import type { Vector2 } from "../vector2.js";

export function defaultCatmullRomPointCount(verts: Vector2[], closed: boolean, density = 1): number {
  return pointCountForLength(catmullRomOutline(verts, closed), closed ? 3 : 2, density);
}

export function placeAlongCurve(mod: PathModifier): Vector2[] {
  const dense = catmullRomOutline(mod.vertices, mod.closed);
  if (dense.length <= 1) return dense.slice();

  const cum = cumulativeLengths(dense);
  const total = cum[cum.length - 1];
  if (total === 0) return [dense[0]];

  const count = Math.max(mod.closed ? 3 : 2, Math.floor(mod.pointCount));
  const denom = mod.closed ? count : count - 1;
  const out: Vector2[] = [];
  for (let i = 0; i < count; i++) {
    out.push(sampleAtArc(dense, cum, (total * i) / denom));
  }
  return out;
}

export function catmullRomOutline(
  verts: Vector2[],
  closed: boolean,
  samples = SAMPLES_PER_SEGMENT,
): Vector2[] {
  const n = verts.length;
  if (n === 0) return [];
  if (n === 1) return [{ x: verts[0].x, y: verts[0].y }];

  const out: Vector2[] = [];
  const segCount = closed ? n : n - 1;
  for (let i = 0; i < segCount; i++) {
    const p0 = verts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const p1 = verts[i % n];
    const p2 = verts[(i + 1) % n];
    const p3 = verts[closed ? (i + 2) % n : Math.min(n - 1, i + 2)];
    for (let j = 0; j < samples; j++) {
      out.push(interpolate(p0, p1, p2, p3, j / samples));
    }
  }
  out.push(closed ? { x: verts[0].x, y: verts[0].y } : { x: verts[n - 1].x, y: verts[n - 1].y });
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
