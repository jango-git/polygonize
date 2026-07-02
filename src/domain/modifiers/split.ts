import { newModifierUUID } from "../../document/ids.js";
import {
  type BezierAnchor,
  type BezierModifier,
  type Modifier,
  type PathModifier,
} from "../../document/types.js";
import { defaultBezierPointCount } from "./bezier.js";
import { defaultCatmullRomPointCount } from "./catmullrom.js";
import type { Vector2 } from "../vector2.js";

// Split a path/bezier at a control point into independent modifiers that share the
// cut point (a break there), keeping the original's interpolation/kind. An OPEN
// modifier splits into two halves around the point; a CLOSED one has no two-sides,
// so a single cut opens it into one path that starts and ends at the point. Returns
// the replacement modifiers (1 or 2), or [] when the point can't split it (an open
// endpoint, or a circle whose handles are structural).
export function splitModifierAtPoint(modifier: Modifier, index: number): Modifier[] {
  if (modifier.kind === "path") return splitPath(modifier, index);
  if (modifier.kind === "bezier") return splitBezier(modifier, index);
  return [];
}

function splitPath(modifier: PathModifier, index: number): Modifier[] {
  const n = modifier.vertices.length;
  if (index < 0 || index >= n) return [];
  if (modifier.closed)
    return [makePath(modifier, openClosed(modifier.vertices, index, clonePoint))];
  if (index === 0 || index === n - 1) return []; // an endpoint can't split a line
  return [
    makePath(modifier, modifier.vertices.slice(0, index + 1).map(clonePoint)),
    makePath(modifier, modifier.vertices.slice(index).map(clonePoint)),
  ];
}

function splitBezier(modifier: BezierModifier, index: number): Modifier[] {
  const n = modifier.anchors.length;
  if (index < 0 || index >= n) return [];
  if (modifier.closed) return [makeBezier(openClosed(modifier.anchors, index, cloneAnchor))];
  if (index === 0 || index === n - 1) return [];
  return [
    makeBezier(modifier.anchors.slice(0, index + 1).map(cloneAnchor)),
    makeBezier(modifier.anchors.slice(index).map(cloneAnchor)),
  ];
}

// Walk a closed ring once starting at the cut, ending on a duplicate of it, so the
// loop becomes an open path broken at that point.
function openClosed<T>(items: T[], index: number, clone: (item: T) => T): T[] {
  const out: T[] = [];
  for (let i = 0; i <= items.length; i++) out.push(clone(items[(index + i) % items.length]));
  return out;
}

function makePath(modifier: PathModifier, vertices: Vector2[]): PathModifier {
  return {
    uuid: newModifierUUID(),
    kind: "path",
    interpolation: modifier.interpolation,
    vertices,
    closed: false,
    pointCount:
      modifier.interpolation === "polyline"
        ? vertices.length
        : defaultCatmullRomPointCount(vertices, false),
  };
}

function makeBezier(anchors: BezierAnchor[]): BezierModifier {
  const result: BezierModifier = {
    uuid: newModifierUUID(),
    kind: "bezier",
    anchors,
    closed: false,
    pointCount: 2,
  };
  result.pointCount = defaultBezierPointCount(result);
  return result;
}

function clonePoint(p: Vector2): Vector2 {
  return { x: p.x, y: p.y };
}

function cloneAnchor(a: BezierAnchor): BezierAnchor {
  return { x: a.x, y: a.y, hx: a.hx, hy: a.hy };
}
