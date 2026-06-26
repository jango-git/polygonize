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
