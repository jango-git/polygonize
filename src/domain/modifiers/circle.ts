import {
  newPointUUID,
  type CircleModifier,
  type ConstraintEdge,
  type ModifierResult,
  type Point,
} from "../../document/types.js";

interface Vec {
  x: number;
  y: number;
}

export function applyCircle(points: Point[], mod: CircleModifier): ModifierResult {
  const r = Math.hypot(mod.edge.x - mod.center.x, mod.edge.y - mod.center.y);
  if (r === 0) return { points, edges: [] };

  const n = Math.max(3, Math.floor(mod.pointCount));
  const base = Math.atan2(mod.edge.y - mod.center.y, mod.edge.x - mod.center.x);
  const created: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = base + (2 * Math.PI * i) / n;
    created.push({
      uuid: newPointUUID(),
      x: mod.center.x + r * Math.cos(a),
      y: mod.center.y + r * Math.sin(a),
    });
  }

  const result = points.slice();
  for (const p of created) result.push(p);

  const edges: ConstraintEdge[] = [];
  for (let i = 0; i < n; i++) {
    edges.push([created[i].uuid, created[(i + 1) % n].uuid]);
  }
  return { points: result, edges };
}

export function circleOutline(center: Vec, edge: Vec, segments = 48): Vec[] {
  const r = Math.hypot(edge.x - center.x, edge.y - center.y);
  const base = Math.atan2(edge.y - center.y, edge.x - center.x);
  const out: Vec[] = [];
  for (let i = 0; i < segments; i++) {
    const a = base + (2 * Math.PI * i) / segments;
    out.push({ x: center.x + r * Math.cos(a), y: center.y + r * Math.sin(a) });
  }
  return out;
}

// Circle through three points. Returns center plus an edge point (the first of
// the three, so the radius and base angle stay anchored to it), or null when
// the points are collinear and no finite circle exists.
export function circumcircle(a: Vec, b: Vec, c: Vec): { center: Vec; edge: Vec } | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-9) return null;
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  const center = {
    x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
    y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
  };
  return { center, edge: { x: a.x, y: a.y } };
}
