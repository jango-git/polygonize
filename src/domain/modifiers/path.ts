import { type ModifierResult, type PathModifier, type Point } from "../../document/types.js";
import { placeAlongCurve } from "./catmullrom.js";
import { placeAlongPolyline } from "./polyline.js";
import { pointsToResult } from "./result.js";

export function applyPath(points: Point[], modifier: PathModifier): ModifierResult {
  const placed =
    modifier.interpolation === "catmullrom"
      ? placeAlongCurve(modifier)
      : placeAlongPolyline(modifier);
  if (placed.length === 0) return { points, edges: [] };
  return pointsToResult(points, placed, modifier.closed);
}
