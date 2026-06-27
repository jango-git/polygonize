import {
  newPointUUID,
  type ConstraintEdge,
  type ModifierResult,
  type PathModifier,
  type Point,
} from "../../document/types.js";
import { placeAlongCurve } from "./catmullrom.js";
import { placeAlongPolyline } from "./polyline.js";

interface Vec {
  x: number;
  y: number;
}

export function applyPath(points: Point[], mod: PathModifier): ModifierResult {
  const placed: Vec[] =
    mod.interpolation === "catmullrom" ? placeAlongCurve(mod) : placeAlongPolyline(mod);
  if (placed.length === 0) return { points, edges: [] };

  const created: Point[] = placed.map((p) => ({ uuid: newPointUUID(), x: p.x, y: p.y }));
  const result = points.slice();
  for (const p of created) result.push(p);

  const edges: ConstraintEdge[] = [];
  for (let i = 0; i < created.length - 1; i++) {
    edges.push([created[i].uuid, created[i + 1].uuid]);
  }
  if (mod.closed && created.length > 2) {
    edges.push([created[created.length - 1].uuid, created[0].uuid]);
  }
  return { points: result, edges };
}
