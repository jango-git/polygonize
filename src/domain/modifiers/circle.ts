import { type CircleModifier, type ModifierResult, type Point } from "../../document/types.js";
import { pointsToResult } from "./result.js";
import type { Vector2 } from "../vector2.js";

export function applyCircle(points: Point[], modifier: CircleModifier): ModifierResult {
  const r = Math.hypot(modifier.edge.x - modifier.center.x, modifier.edge.y - modifier.center.y);
  if (r === 0) return { points, edges: [] };

  const n = Math.max(3, Math.floor(modifier.pointCount));
  const base = Math.atan2(modifier.edge.y - modifier.center.y, modifier.edge.x - modifier.center.x);
  const placed: Vector2[] = [];
  for (let i = 0; i < n; i++) {
    const a = base + (2 * Math.PI * i) / n;
    placed.push({ x: modifier.center.x + r * Math.cos(a), y: modifier.center.y + r * Math.sin(a) });
  }
  return pointsToResult(points, placed, true);
}

export function circleOutline(center: Vector2, edge: Vector2, segments = 48): Vector2[] {
  const r = Math.hypot(edge.x - center.x, edge.y - center.y);
  const base = Math.atan2(edge.y - center.y, edge.x - center.x);
  const out: Vector2[] = [];
  for (let i = 0; i < segments; i++) {
    const a = base + (2 * Math.PI * i) / segments;
    out.push({ x: center.x + r * Math.cos(a), y: center.y + r * Math.sin(a) });
  }
  return out;
}

// Circle through three points. Returns center plus an edge point (the first of
// the three, so the radius and base angle stay anchored to it), or undefined when
// the points are collinear and no finite circle exists.
export function circumcircle(
  a: Vector2,
  b: Vector2,
  c: Vector2,
): { center: Vector2; edge: Vector2 } | undefined {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-9) return undefined;
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  const center = {
    x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
    y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
  };
  return { center, edge: { x: a.x, y: a.y } };
}
