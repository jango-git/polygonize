import { type BezierAnchor, type BezierModifier, type PathModifier } from "../../document/types.js";
import { bezierOutline, defaultAnchorHandle } from "./bezier.js";
import { catmullRomOutline } from "./catmullrom.js";
import type { Vector2 } from "../vector2.js";

// Dense sampling used to map a click on a curved outline back to the control-point
// span it falls in. Denser than the render sampling so the nearest-sample probe is
// accurate. Outline functions emit this many samples per segment, in order, so
// `floor(sampleIndex / INSERT_SAMPLES)` is the segment index.
const INSERT_SAMPLES = 32;

function projectOnSegment(p: Vector2, a: Vector2, b: Vector2): { distSq: number; point: Vector2 } {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  let t = len2 > 0 ? ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const x = a.x + t * vx;
  const y = a.y + t * vy;
  return { distSq: (x - p.x) ** 2 + (y - p.y) ** 2, point: { x, y } };
}

// Nearest sample on a sampled outline, returning the insertion index (span + 1)
// and the on-curve position. Null if nothing is within maxDistSq.
function nearestSpan(
  dense: Vector2[],
  p: Vector2,
  segCount: number,
  maxDistSq: number,
): { index: number; point: Vector2 } | null {
  let bestIndex = -1;
  let bestDist = maxDistSq;
  for (let i = 0; i < dense.length; i++) {
    const d = (dense[i].x - p.x) ** 2 + (dense[i].y - p.y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestIndex = i;
    }
  }
  if (bestIndex < 0) return null;
  // The trailing closing point lands one past the last span; clamp it back.
  const span = Math.min(segCount - 1, Math.floor(bestIndex / INSERT_SAMPLES));
  return { index: span + 1, point: { x: dense[bestIndex].x, y: dense[bestIndex].y } };
}

// Insert a vertex on a path at the click, if within maxDistSq of the outline.
// Polyline projects onto its straight segments; catmull-rom snaps to the nearest
// curve sample and inserts a control vertex in that span (the curve refits through
// it). Returns the new vertices and the inserted index.
export function insertPathVertex(
  mod: PathModifier,
  p: Vector2,
  maxDistSq: number,
): { vertices: Vector2[]; index: number } | null {
  const verts = mod.vertices;
  const n = verts.length;
  if (n < 2) return null;
  const segCount = mod.closed ? n : n - 1;

  if (mod.interpolation === "polyline") {
    let best: { distSq: number; index: number; point: Vector2 } | null = null;
    for (let i = 0; i < segCount; i++) {
      const r = projectOnSegment(p, verts[i], verts[(i + 1) % n]);
      if (r.distSq <= maxDistSq && (!best || r.distSq < best.distSq)) {
        best = { distSq: r.distSq, index: i + 1, point: r.point };
      }
    }
    if (!best) return null;
    const vertices = verts.map((v) => ({ x: v.x, y: v.y }));
    vertices.splice(best.index, 0, best.point);
    return { vertices, index: best.index };
  }

  const hit = nearestSpan(
    catmullRomOutline(verts, mod.closed, INSERT_SAMPLES),
    p,
    segCount,
    maxDistSq,
  );
  if (!hit) return null;
  const vertices = verts.map((v) => ({ x: v.x, y: v.y }));
  vertices.splice(hit.index, 0, hit.point);
  return { vertices, index: hit.index };
}

// Insert a bezier anchor on the curve at the click. A single symmetric handle
// can't reproduce a De Casteljau split exactly, so the new anchor sits on the
// curve with a neighbor-aligned tangent (a slight reshape near the insertion).
export function insertBezierAnchor(
  mod: BezierModifier,
  p: Vector2,
  maxDistSq: number,
): { anchors: BezierAnchor[]; index: number } | null {
  const n = mod.anchors.length;
  if (n < 2) return null;
  const segCount = mod.closed ? n : n - 1;
  const hit = nearestSpan(bezierOutline(mod, INSERT_SAMPLES), p, segCount, maxDistSq);
  if (!hit) return null;

  const anchors: BezierAnchor[] = mod.anchors.map((a) => ({ ...a }));
  anchors.splice(hit.index, 0, { x: hit.point.x, y: hit.point.y, hx: 0, hy: 0 });
  const handle = defaultAnchorHandle({ ...mod, anchors }, hit.index);
  anchors[hit.index].hx = handle.hx;
  anchors[hit.index].hy = handle.hy;
  return { anchors, index: hit.index };
}
