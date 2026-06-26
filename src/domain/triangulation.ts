import Constrainautor from "@kninnug/constrainautor";
import Delaunator from "delaunator";
import type { ConstraintEdge, Point, PointUUID } from "../document/types.js";

export interface TriangleIndices {
  a: PointUUID;
  b: PointUUID;
  c: PointUUID;
}

export function triangulate(
  points: Point[],
  constraintEdges: readonly ConstraintEdge[] = [],
): TriangleIndices[] {
  if (points.length < 3) return [];

  const coords = new Float64Array(points.length * 2);
  const indexOf = new Map<PointUUID, number>();
  for (let i = 0; i < points.length; i++) {
    coords[2 * i] = points[i].x;
    coords[2 * i + 1] = points[i].y;
    indexOf.set(points[i].uuid, i);
  }

  const delaunay = new Delaunator(coords);
  if (delaunay.triangles.length >= 3 && constraintEdges.length) {
    applyConstraints(delaunay, indexOf, constraintEdges);
  }

  const { triangles } = delaunay;
  const result: TriangleIndices[] = [];
  for (let i = 0; i < triangles.length; i += 3) {
    result.push({
      a: points[triangles[i]].uuid,
      b: points[triangles[i + 1]].uuid,
      c: points[triangles[i + 2]].uuid,
    });
  }
  return result;
}

function applyConstraints(
  delaunay: Delaunator<ArrayLike<number>>,
  indexOf: Map<PointUUID, number>,
  constraintEdges: readonly ConstraintEdge[],
): void {
  const con = new Constrainautor(delaunay);
  let failed = 0;
  for (const [a, b] of constraintEdges) {
    const ia = indexOf.get(a);
    const ib = indexOf.get(b);
    if (ia === undefined || ib === undefined || ia === ib) continue;
    try {
      con.constrainOne(ia, ib);
    } catch {
      failed += 1;
    }
  }
  if (failed > 0) {
    console.warn(
      `Triangulation: ${failed} constraint edge(s) could not be enforced ` +
        "(overlapping modifiers or points on a line).",
    );
  }
}
