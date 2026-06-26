import { applyCatmullRom } from "../../domain/modifiers/catmullrom.js";
import { applyCircle } from "../../domain/modifiers/circle.js";
import { applyPolyline } from "../../domain/modifiers/polyline.js";
import { store } from "../store.js";
import type { ConstraintEdge, Modifier, ModifierResult, Point } from "../types.js";
import { recomputeTriangles } from "./recompute.js";

export function evaluatePoints(): void {
  const data = store.data();
  let pts: Point[] = data.seedPoints.slice();
  let edges: ConstraintEdge[] = [];

  const img = data.image;
  const apply = (mod: Modifier): void => {
    const before = pts.length;
    const res = applyModifier(pts, mod);
    if (img) {
      for (let i = before; i < res.points.length; i++) {
        clampToCanvas(res.points[i], img.width, img.height);
      }
    }
    pts = res.points;
    edges = edges.concat(res.edges);
  };

  for (const entry of data.stack) {
    if (entry.type === "modifier") apply(entry.modifier);
    else if (!entry.group.muted) entry.children.forEach(apply);
  }

  data.points = pts;
  data.constraintEdges = edges;
  recomputeTriangles();
}

function clampToCanvas(p: Point, width: number, height: number): void {
  p.x = Math.min(Math.max(p.x, 0), width);
  p.y = Math.min(Math.max(p.y, 0), height);
}

function applyModifier(points: Point[], mod: Modifier): ModifierResult {
  switch (mod.kind) {
    case "polyline":
      return applyPolyline(points, mod);
    case "circle":
      return applyCircle(points, mod);
    case "catmullrom":
      return applyCatmullRom(points, mod);
    default:
      return { points, edges: [] };
  }
}
