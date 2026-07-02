import { type ModifierResult, type PathModifier, type Point } from "../../document/types.js";
import { placeAlongCurve } from "./catmullrom.js";
import { placeAlongPolyline } from "./polyline.js";
import { pointsToResult } from "./result.js";

export function applyPath(points: Point[], mod: PathModifier): ModifierResult {
  const placed =
    mod.interpolation === "catmullrom" ? placeAlongCurve(mod) : placeAlongPolyline(mod);
  if (placed.length === 0) return { points, edges: [] };
  return pointsToResult(points, placed, mod.closed);
}
