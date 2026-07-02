import { type ModifierResult, type Point } from "../../document/types.js";
import type { Vector2 } from "../vector2.js";

// Turn placed positions into modifier points appended to `base`, plus the chain
// of constraint edges linking them in order, emitted as index pairs into the
// accumulated point list. Points are only appended (never reordered), so the
// index of a placed point is `base.length + i` and stays valid for the run. A
// closed run (>2 points) adds the wrap edge back to the first, forming a ring.
// Shared by the path, bezier and circle modifiers.
export function pointsToResult(base: Point[], placed: Vector2[], closed: boolean): ModifierResult {
  const offset = base.length;
  const points = base.slice();
  for (const p of placed) points.push({ x: p.x, y: p.y });

  const edges: [number, number][] = [];
  for (let i = 0; i < placed.length - 1; i++) {
    edges.push([offset + i, offset + i + 1]);
  }
  if (closed && placed.length > 2) {
    edges.push([offset + placed.length - 1, offset]);
  }
  return { points, edges };
}
