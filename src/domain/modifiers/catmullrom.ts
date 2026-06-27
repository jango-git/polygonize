import type { PathModifier } from "../../document/types.js";

interface Vec {
  x: number;
  y: number;
}

const SAMPLES_PER_SEGMENT = 16;

const DEFAULT_SPACING_PX = 50;
const DEFAULT_MAX_POINTS = 128;

export function defaultCatmullRomPointCount(verts: Vec[], closed: boolean, density = 1): number {
  const dense = catmullRomOutline(verts, closed);
  let length = 0;
  for (let i = 1; i < dense.length; i++) {
    length += Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y);
  }
  const min = closed ? 3 : 2;
  const count = Math.round((length / DEFAULT_SPACING_PX) * density);
  return Math.min(DEFAULT_MAX_POINTS, Math.max(min, count));
}

export function placeAlongCurve(mod: PathModifier): Vec[] {
  const dense = catmullRomOutline(mod.vertices, mod.closed);
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

export function catmullRomOutline(
  verts: Vec[],
  closed: boolean,
  samples = SAMPLES_PER_SEGMENT,
): Vec[] {
  const n = verts.length;
  if (n === 0) return [];
  if (n === 1) return [{ x: verts[0].x, y: verts[0].y }];

  const out: Vec[] = [];
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

function interpolate(p0: Vec, p1: Vec, p2: Vec, p3: Vec, t: number): Vec {
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
