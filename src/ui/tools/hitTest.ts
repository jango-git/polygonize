import type { BezierModifier, Modifier } from "../../document/types.js";
import { GRAB_RADIUS_PX } from "./constants.js";
import type { Vector2 } from "./geometry.js";

// Which part of a bezier anchor a drag grabbed: the anchor position itself, or one of its
// two tangent handles. Replaces the old "anchor" | "out" | "in" string literals.
export enum BezierHandle {
  Anchor = "anchor",
  Outgoing = "outgoing",
  Incoming = "incoming",
}

export interface BezierTarget {
  index: number;
  handle: BezierHandle;
}

// The control points of a modifier in index order (the order the selected-point index and
// the overlay handles both use): circle center + edge, bezier anchors, or path vertices.
export function controlPoints(modifier: Modifier): Vector2[] {
  if (modifier.kind === "circle") return [modifier.center, modifier.edge];
  if (modifier.kind === "bezier") return modifier.anchors;
  return modifier.vertices;
}

// Hit-test for editing a bezier. Extended handle ends take priority over the anchor (so
// you grab the whisker, not the point); a handle within the grab radius of its own anchor
// is treated as retracted and ignored, keeping the anchor draggable. Returns undefined
// when nothing is within reach.
export function bezierHitTest(
  modifier: BezierModifier,
  point: Vector2,
  worldPerPixel: number,
): BezierTarget | undefined {
  const radius = GRAB_RADIUS_PX * worldPerPixel;
  const radiusSq = radius * radius;
  const distanceSq = (x: number, y: number): number => (x - point.x) ** 2 + (y - point.y) ** 2;

  let closest: BezierTarget | undefined;
  let closestDistanceSq = radiusSq;
  modifier.anchors.forEach((anchor, index) => {
    if (Math.hypot(anchor.hx, anchor.hy) <= radius) return;
    const outgoingDistanceSq = distanceSq(anchor.x + anchor.hx, anchor.y + anchor.hy);
    if (outgoingDistanceSq < closestDistanceSq) {
      closestDistanceSq = outgoingDistanceSq;
      closest = { index, handle: BezierHandle.Outgoing };
    }
    const incomingDistanceSq = distanceSq(anchor.x - anchor.hx, anchor.y - anchor.hy);
    if (incomingDistanceSq < closestDistanceSq) {
      closestDistanceSq = incomingDistanceSq;
      closest = { index, handle: BezierHandle.Incoming };
    }
  });
  if (closest) return closest;

  closestDistanceSq = radiusSq;
  modifier.anchors.forEach((anchor, index) => {
    const anchorDistanceSq = distanceSq(anchor.x, anchor.y);
    if (anchorDistanceSq < closestDistanceSq) {
      closestDistanceSq = anchorDistanceSq;
      closest = { index, handle: BezierHandle.Anchor };
    }
  });
  return closest;
}

// Index of the nearest control point within maxDistanceSq, or -1 if none is close enough.
export function nearestControl(controls: Vector2[], point: Vector2, maxDistanceSq: number): number {
  let bestIndex = -1;
  let bestDistanceSq = maxDistanceSq;
  controls.forEach((control, index) => {
    const candidateDistanceSq = (control.x - point.x) ** 2 + (control.y - point.y) ** 2;
    if (candidateDistanceSq < bestDistanceSq) {
      bestDistanceSq = candidateDistanceSq;
      bestIndex = index;
    }
  });
  return bestIndex;
}

// Index of the nearest open endpoint (first or last control point) within maxDistanceSq,
// or -1. Used by the Alt-drag extrude, which only grabs the ends of an open path/curve.
export function nearestEndpoint(points: Vector2[], point: Vector2, maxDistanceSq: number): number {
  const count = points.length;
  if (count < 2) return -1;
  let bestIndex = -1;
  let bestDistanceSq = maxDistanceSq;
  for (const index of [0, count - 1]) {
    const candidate = points[index];
    const candidateDistanceSq = (candidate.x - point.x) ** 2 + (candidate.y - point.y) ** 2;
    if (candidateDistanceSq < bestDistanceSq) {
      bestDistanceSq = candidateDistanceSq;
      bestIndex = index;
    }
  }
  return bestIndex;
}
