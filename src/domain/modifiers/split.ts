import {
  newModifierUUID,
  type BezierAnchor,
  type BezierModifier,
  type Modifier,
  type PathModifier,
} from "../../document/types.js";
import { defaultBezierPointCount } from "./bezier.js";
import { defaultCatmullRomPointCount } from "./catmullrom.js";

interface Vec {
  x: number;
  y: number;
}

// Split a path/bezier at a control point into independent modifiers that share the
// cut point (a break there), keeping the original's interpolation/kind. An OPEN
// modifier splits into two halves around the point; a CLOSED one has no two-sides,
// so a single cut opens it into one path that starts and ends at the point. Returns
// the replacement modifiers (1 or 2), or [] when the point can't split it (an open
// endpoint, or a circle whose handles are structural).
export function splitModifierAtPoint(mod: Modifier, index: number): Modifier[] {
  if (mod.kind === "path") return splitPath(mod, index);
  if (mod.kind === "bezier") return splitBezier(mod, index);
  return [];
}

function splitPath(mod: PathModifier, index: number): Modifier[] {
  const n = mod.vertices.length;
  if (index < 0 || index >= n) return [];
  if (mod.closed) return [makePath(mod, openClosed(mod.vertices, index, clonePoint))];
  if (index === 0 || index === n - 1) return []; // an endpoint can't split a line
  return [
    makePath(mod, mod.vertices.slice(0, index + 1).map(clonePoint)),
    makePath(mod, mod.vertices.slice(index).map(clonePoint)),
  ];
}

function splitBezier(mod: BezierModifier, index: number): Modifier[] {
  const n = mod.anchors.length;
  if (index < 0 || index >= n) return [];
  if (mod.closed) return [makeBezier(openClosed(mod.anchors, index, cloneAnchor))];
  if (index === 0 || index === n - 1) return [];
  return [
    makeBezier(mod.anchors.slice(0, index + 1).map(cloneAnchor)),
    makeBezier(mod.anchors.slice(index).map(cloneAnchor)),
  ];
}

// Walk a closed ring once starting at the cut, ending on a duplicate of it, so the
// loop becomes an open path broken at that point.
function openClosed<T>(items: T[], index: number, clone: (item: T) => T): T[] {
  const out: T[] = [];
  for (let i = 0; i <= items.length; i++) out.push(clone(items[(index + i) % items.length]));
  return out;
}

function makePath(mod: PathModifier, vertices: Vec[]): PathModifier {
  return {
    uuid: newModifierUUID(),
    kind: "path",
    interpolation: mod.interpolation,
    vertices,
    closed: false,
    pointCount:
      mod.interpolation === "polyline"
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

function clonePoint(p: Vec): Vec {
  return { x: p.x, y: p.y };
}

function cloneAnchor(a: BezierAnchor): BezierAnchor {
  return { x: a.x, y: a.y, hx: a.hx, hy: a.hy };
}
