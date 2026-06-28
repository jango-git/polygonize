import {
  newPointUUID,
  type BezierAnchor,
  type BezierModifier,
  type ConstraintEdge,
  type ModifierResult,
  type Point,
} from "../../document/types.js";

interface Vec {
  x: number;
  y: number;
}

const SAMPLES_PER_SEGMENT = 16;
const DEFAULT_SPACING_PX = 50;
const DEFAULT_MAX_POINTS = 128;

// Control polygon of segment i -> i+1: anchors carry one symmetric tangent, so
// the outgoing handle is anchor + (hx, hy) and the incoming handle of the next
// anchor is its mirror, anchor - (hx, hy).
function segmentControls(mod: BezierModifier, i: number): [Vec, Vec, Vec, Vec] {
  const a = mod.anchors;
  const n = a.length;
  const A = a[i];
  const B = a[(i + 1) % n];
  return [
    { x: A.x, y: A.y },
    { x: A.x + A.hx, y: A.y + A.hy },
    { x: B.x - B.hx, y: B.y - B.hy },
    { x: B.x, y: B.y },
  ];
}

function cubic(p0: Vec, p1: Vec, p2: Vec, p3: Vec, t: number): Vec {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

export function bezierOutline(mod: BezierModifier, samples = SAMPLES_PER_SEGMENT): Vec[] {
  const a = mod.anchors;
  const n = a.length;
  if (n === 0) return [];
  if (n === 1) return [{ x: a[0].x, y: a[0].y }];

  const out: Vec[] = [];
  const segCount = mod.closed ? n : n - 1;
  for (let i = 0; i < segCount; i++) {
    const [p0, p1, p2, p3] = segmentControls(mod, i);
    for (let j = 0; j < samples; j++) {
      out.push(cubic(p0, p1, p2, p3, j / samples));
    }
  }
  const end = mod.closed ? a[0] : a[n - 1];
  out.push({ x: end.x, y: end.y });
  return out;
}

export function defaultBezierPointCount(mod: BezierModifier, density = 1): number {
  const dense = bezierOutline(mod);
  let length = 0;
  for (let i = 1; i < dense.length; i++) {
    length += Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y);
  }
  const min = mod.closed ? 3 : 2;
  const count = Math.round((length / DEFAULT_SPACING_PX) * density);
  return Math.min(DEFAULT_MAX_POINTS, Math.max(min, count));
}

export function placeAlongBezier(mod: BezierModifier): Vec[] {
  const dense = bezierOutline(mod);
  if (dense.length <= 1) return dense.slice();

  const cum: number[] = [0];
  for (let i = 1; i < dense.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y));
  }
  const total = cum[cum.length - 1];
  if (total === 0) return [dense[0]];

  const count = Math.max(mod.closed ? 3 : 2, Math.floor(mod.pointCount));
  const denom = mod.closed ? count : count - 1;
  const out: Vec[] = [];
  for (let i = 0; i < count; i++) {
    out.push(sampleAtArc(dense, cum, (total * i) / denom));
  }
  return out;
}

export function applyBezier(points: Point[], mod: BezierModifier): ModifierResult {
  const placed = placeAlongBezier(mod);
  if (placed.length === 0) return { points, edges: [] };

  const created: Point[] = placed.map((p) => ({ uuid: newPointUUID(), x: p.x, y: p.y }));
  const result = points.slice();
  for (const p of created) result.push(p);

  const edges: ConstraintEdge[] = [];
  for (let i = 0; i < created.length - 1; i++) {
    edges.push([created[i].uuid!, created[i + 1].uuid!]);
  }
  if (mod.closed && created.length > 2) {
    edges.push([created[created.length - 1].uuid!, created[0].uuid!]);
  }
  return { points: result, edges };
}

const DEFAULT_HANDLE_LEN = 40;

function neighborAnchor(mod: BezierModifier, index: number, dir: number): BezierAnchor | null {
  const n = mod.anchors.length;
  const j = index + dir;
  if (mod.closed) return mod.anchors[((j % n) + n) % n];
  if (j < 0 || j >= n) return null;
  return mod.anchors[j];
}

// A sensible outgoing handle for an anchor whose tangents are retracted: aligned
// with the curve (neighbor-to-neighbor direction) and scaled to ~1/3 of the
// nearer neighbor distance, so toggling a point gives draggable, smooth handles.
export function defaultAnchorHandle(
  mod: BezierModifier,
  index: number,
): { hx: number; hy: number } {
  const cur = mod.anchors[index];
  const prev = neighborAnchor(mod, index, -1);
  const next = neighborAnchor(mod, index, 1);

  let dx = 0;
  let dy = 0;
  if (prev && next) {
    dx = next.x - prev.x;
    dy = next.y - prev.y;
  } else if (next) {
    dx = next.x - cur.x;
    dy = next.y - cur.y;
  } else if (prev) {
    dx = cur.x - prev.x;
    dy = cur.y - prev.y;
  }

  const dPrev = prev ? Math.hypot(cur.x - prev.x, cur.y - prev.y) : Infinity;
  const dNext = next ? Math.hypot(cur.x - next.x, cur.y - next.y) : Infinity;
  const near = Math.min(dPrev, dNext);
  const handleLen = Number.isFinite(near) && near > 0 ? near / 3 : DEFAULT_HANDLE_LEN;

  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { hx: handleLen, hy: 0 };
  return { hx: (dx / len) * handleLen, hy: (dy / len) * handleLen };
}

function sampleAtArc(dense: Vec[], cum: number[], s: number): Vec {
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
