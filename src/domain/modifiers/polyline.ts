import {
  newPointUUID,
  type ConstraintEdge,
  type ModifierResult,
  type Point,
  type PolylineModifier,
} from "../../document/types.js";

interface Vec {
  x: number;
  y: number;
}

export function applyPolyline(points: Point[], mod: PolylineModifier): ModifierResult {
  const placed = placeAlongPolyline(mod);
  if (placed.length === 0) return { points, edges: [] };

  const created: Point[] = placed.map((p) => ({ uuid: newPointUUID(), x: p.x, y: p.y }));
  const result = points.slice();
  for (const p of created) result.push(p);

  const edges: ConstraintEdge[] = [];
  for (let i = 0; i < created.length - 1; i++) {
    edges.push([created[i].uuid, created[i + 1].uuid]);
  }
  if (mod.closed && created.length > 2) {
    edges.push([created[created.length - 1].uuid, created[0].uuid]);
  }
  return { points: result, edges };
}

function placeAlongPolyline(mod: PolylineModifier): Vec[] {
  const verts = mod.vertices;
  const n = verts.length;
  if (n === 0) return [];
  if (n === 1) return [{ x: verts[0].x, y: verts[0].y }];

  const segCount = mod.closed ? n : n - 1;
  const segLen: number[] = [];
  let total = 0;
  for (let i = 0; i < segCount; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segLen.push(len);
    total += len;
  }
  if (total === 0) return verts.map((v) => ({ x: v.x, y: v.y }));

  const corners: number[] = [0];
  let acc = 0;
  for (let i = 0; i < segCount; i++) {
    acc += segLen[i];
    if (!mod.closed || i < segCount - 1) corners.push(acc);
  }

  const count = Math.floor(mod.pointCount);
  const extra = count - corners.length;

  let positions: number[];
  if (extra >= 2) {
    positions = [];
    const denom = mod.closed ? count : count - 1;
    for (let i = 0; i < count; i++) positions.push((total * i) / denom);
  } else {
    positions = corners.slice();
    for (let j = 0; j < extra; j++) positions.push((total * (j + 0.5)) / extra);
  }

  positions.sort((a, b) => a - b);
  const eps = 1e-6;
  const ordered: Vec[] = [];
  let last = -Infinity;
  for (const s of positions) {
    if (s - last <= eps) continue;
    last = s;
    ordered.push(pointAtArc(verts, segLen, s));
  }
  return ordered;
}

function pointAtArc(verts: Vec[], segLen: number[], s: number): Vec {
  const n = verts.length;
  let acc = 0;
  for (let i = 0; i < segLen.length; i++) {
    if (s <= acc + segLen[i] || i === segLen.length - 1) {
      const t = segLen[i] === 0 ? 0 : (s - acc) / segLen[i];
      const a = verts[i];
      const b = verts[(i + 1) % n];
      return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    }
    acc += segLen[i];
  }
  return { x: verts[0].x, y: verts[0].y };
}
