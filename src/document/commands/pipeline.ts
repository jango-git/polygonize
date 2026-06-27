import { getEdgeDensity } from "../../domain/featureMap.js";
import { applyCircle } from "../../domain/modifiers/circle.js";
import { applyPath } from "../../domain/modifiers/path.js";
import { generateSeedPoints } from "../../domain/seeding.js";
import { store } from "../store.js";
import type { ConstraintEdge, Modifier, ModifierResult, Point } from "../types.js";
import { recomputeTriangles } from "./recompute.js";

export function evaluatePoints(): void {
  const data = store.data();
  const image = data.image;
  let modifierPoints: Point[] = [];
  let edges: ConstraintEdge[] = [];

  const apply = (mod: Modifier): void => {
    const before = modifierPoints.length;
    const result = applyModifier(modifierPoints, mod);
    if (image) {
      for (let index = before; index < result.points.length; index++) {
        clampToCanvas(result.points[index], image.width, image.height);
      }
    }
    modifierPoints = result.points;
    edges = edges.concat(result.edges);
  };

  for (const entry of data.stack) {
    if (entry.type === "modifier") apply(entry.modifier);
    else if (!entry.group.muted) entry.children.forEach(apply);
  }

  if (image) {
    const generated = generateSeedPoints(
      image.width,
      image.height,
      data.seedSettings,
      getEdgeDensity(),
      data.seed,
      modifierPoints,
    );
    data.points = modifierPoints.concat(generated);
  } else {
    data.points = modifierPoints.slice();
  }
  data.constraintEdges = edges;
  recomputeTriangles();
}

function clampToCanvas(p: Point, width: number, height: number): void {
  p.x = Math.min(Math.max(p.x, 0), width);
  p.y = Math.min(Math.max(p.y, 0), height);
}

function applyModifier(points: Point[], mod: Modifier): ModifierResult {
  switch (mod.kind) {
    case "path":
      return applyPath(points, mod);
    case "circle":
      return applyCircle(points, mod);
    default:
      return { points, edges: [] };
  }
}
