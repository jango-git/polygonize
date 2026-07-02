import {
  type BezierAnchor,
  type BezierModifier,
  type ModifierResult,
  type Point,
} from "../../document/types.js";
import {
  SAMPLES_PER_SEGMENT,
  cumulativeLengths,
  pointCountForLength,
  sampleAtArc,
} from "./curve.js";
import { pointsToResult } from "./result.js";
import type { Vector2 } from "../vector2.js";

// Control polygon of segment i -> i+1: anchors carry one symmetric tangent, so
// the outgoing handle is anchor + (hx, hy) and the incoming handle of the next
// anchor is its mirror, anchor - (hx, hy).
function segmentControls(
  modifier: BezierModifier,
  i: number,
): [Vector2, Vector2, Vector2, Vector2] {
  const anchors = modifier.anchors;
  const n = anchors.length;
  const A = anchors[i];
  const B = anchors[(i + 1) % n];
  return [
    { x: A.x, y: A.y },
    { x: A.x + A.hx, y: A.y + A.hy },
    { x: B.x - B.hx, y: B.y - B.hy },
    { x: B.x, y: B.y },
  ];
}

function cubic(p0: Vector2, p1: Vector2, p2: Vector2, p3: Vector2, t: number): Vector2 {
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

export function bezierOutline(modifier: BezierModifier, samples = SAMPLES_PER_SEGMENT): Vector2[] {
  const anchors = modifier.anchors;
  const n = anchors.length;
  if (n === 0) return [];
  if (n === 1) return [{ x: anchors[0].x, y: anchors[0].y }];

  const out: Vector2[] = [];
  const segmentCount = modifier.closed ? n : n - 1;
  for (let i = 0; i < segmentCount; i++) {
    const [p0, p1, p2, p3] = segmentControls(modifier, i);
    for (let j = 0; j < samples; j++) {
      out.push(cubic(p0, p1, p2, p3, j / samples));
    }
  }
  const end = modifier.closed ? anchors[0] : anchors[n - 1];
  out.push({ x: end.x, y: end.y });
  return out;
}

export function defaultBezierPointCount(modifier: BezierModifier, density = 1): number {
  return pointCountForLength(bezierOutline(modifier), modifier.closed ? 3 : 2, density);
}

export function placeAlongBezier(modifier: BezierModifier): Vector2[] {
  const dense = bezierOutline(modifier);
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

export function applyBezier(points: Point[], modifier: BezierModifier): ModifierResult {
  const placed = placeAlongBezier(modifier);
  if (placed.length === 0) return { points, edges: [] };
  return pointsToResult(points, placed, modifier.closed);
}

const DEFAULT_HANDLE_LENGTH = 40;

function neighborAnchor(
  modifier: BezierModifier,
  index: number,
  direction: number,
): BezierAnchor | undefined {
  const n = modifier.anchors.length;
  const j = index + direction;
  if (modifier.closed) return modifier.anchors[((j % n) + n) % n];
  if (j < 0 || j >= n) return undefined;
  return modifier.anchors[j];
}

// A sensible outgoing handle for an anchor whose tangents are retracted: aligned
// with the curve (neighbor-to-neighbor direction) and scaled to ~1/3 of the
// nearer neighbor distance, so toggling a point gives draggable, smooth handles.
export function defaultAnchorHandle(
  modifier: BezierModifier,
  index: number,
): { hx: number; hy: number } {
  const current = modifier.anchors[index];
  const prev = neighborAnchor(modifier, index, -1);
  const next = neighborAnchor(modifier, index, 1);

  let dx = 0;
  let dy = 0;
  if (prev && next) {
    dx = next.x - prev.x;
    dy = next.y - prev.y;
  } else if (next) {
    dx = next.x - current.x;
    dy = next.y - current.y;
  } else if (prev) {
    dx = current.x - prev.x;
    dy = current.y - prev.y;
  }

  const distancePrev = prev ? Math.hypot(current.x - prev.x, current.y - prev.y) : Infinity;
  const distanceNext = next ? Math.hypot(current.x - next.x, current.y - next.y) : Infinity;
  const near = Math.min(distancePrev, distanceNext);
  const handleLength = Number.isFinite(near) && near > 0 ? near / 3 : DEFAULT_HANDLE_LENGTH;

  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return { hx: handleLength, hy: 0 };
  return { hx: (dx / length) * handleLength, hy: (dy / length) * handleLength };
}
