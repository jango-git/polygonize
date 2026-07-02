import type { PathModifier } from "../../document/types.js";
import type { Vector2 } from "../vector2.js";

export function placeAlongPolyline(modifier: PathModifier): Vector2[] {
  const vertices = modifier.vertices;
  const n = vertices.length;
  if (n === 0) return [];
  if (n === 1) return [{ x: vertices[0].x, y: vertices[0].y }];

  const segmentCount = modifier.closed ? n : n - 1;
  const segmentLengths: number[] = [];
  let total = 0;
  for (let i = 0; i < segmentCount; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    segmentLengths.push(length);
    total += length;
  }
  if (total === 0) return vertices.map((v) => ({ x: v.x, y: v.y }));

  const corners: number[] = [0];
  let acc = 0;
  for (let i = 0; i < segmentCount; i++) {
    acc += segmentLengths[i];
    if (!modifier.closed || i < segmentCount - 1) corners.push(acc);
  }

  const count = Math.floor(modifier.pointCount);
  const extra = count - corners.length;

  let positions: number[];
  if (extra >= 2) {
    positions = [];
    const denominator = modifier.closed ? count : count - 1;
    for (let i = 0; i < count; i++) positions.push((total * i) / denominator);
  } else {
    positions = corners.slice();
    for (let j = 0; j < extra; j++) positions.push((total * (j + 0.5)) / extra);
  }

  positions.sort((a, b) => a - b);
  const eps = 1e-6;
  const ordered: Vector2[] = [];
  let last = -Infinity;
  for (const s of positions) {
    if (s - last <= eps) continue;
    last = s;
    ordered.push(pointAtArc(vertices, segmentLengths, s));
  }
  return ordered;
}

function pointAtArc(vertices: Vector2[], segmentLengths: number[], s: number): Vector2 {
  const n = vertices.length;
  let acc = 0;
  for (let i = 0; i < segmentLengths.length; i++) {
    if (s <= acc + segmentLengths[i] || i === segmentLengths.length - 1) {
      const t = segmentLengths[i] === 0 ? 0 : (s - acc) / segmentLengths[i];
      const a = vertices[i];
      const b = vertices[(i + 1) % n];
      return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    }
    acc += segmentLengths[i];
  }
  return { x: vertices[0].x, y: vertices[0].y };
}
