import { groupColorHex } from "../../domain/groupColor.js";
import { applyBezier } from "../../domain/modifiers/bezier.js";
import { applyCircle } from "../../domain/modifiers/circle.js";
import { applyPath } from "../../domain/modifiers/path.js";
import * as pipelineWorker from "../../domain/pipelineWorkerClient.js";
import { store } from "../store.js";
import { type Modifier, type ModifierResult, type Point } from "../types.js";
import { emitDerived } from "./derived.js";
import { buildGeometry } from "./recompute.js";

// The pipeline runs in a worker, so a run resolves asynchronously. `evaluatePoints` keeps a
// synchronous signature (callers fire it and move on) and drives a single drain loop:
// rapid edits bump `pendingToken`, and each run reads the latest stack state at its start,
// so edits arriving mid-run are coalesced into the next run. At most one worker request is
// in flight at a time, so the loop runs at the worker's throughput.
//
// Every completed run renders. We deliberately do NOT drop a result just because a newer
// edit is already pending: under continuous input `pendingToken` advances every frame while
// a run takes far longer, so dropping superseded results would starve rendering entirely
// (nothing drawn until the input stops). A just-finished run is the latest input as of its
// start - showing it now beats waiting ~one more run for a newer one. Runs are sequential
// and each reads newer state, so frames stay monotonic.
let pendingToken = 0;
let draining = false;

export function evaluatePoints(): void {
  pendingToken++;
  if (!draining) void drain();
}

async function drain(): Promise<void> {
  draining = true;
  try {
    let served = 0;
    while (served !== pendingToken) {
      served = pendingToken;
      await runOnce();
    }
  } finally {
    draining = false;
  }
}

async function runOnce(): Promise<void> {
  const data = store.data();
  const image = data.image;
  let modifierPoints: Point[] = [];
  let edges: [number, number][] = [];

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

  // Each group's point tint is derived from its name (see groupColor), matching the
  // panel spine and the path overlay. Muted groups contribute no points.
  for (const entry of data.stack) {
    if (entry.type === "modifier") {
      apply(entry.modifier);
    } else {
      if (entry.group.muted) continue;
      const tint = groupColorHex(entry.group.name);
      const start = modifierPoints.length;
      entry.children.forEach(apply);
      for (let i = start; i < modifierPoints.length; i++) modifierPoints[i].tint = tint;
    }
  }

  for (const point of modifierPoints) point.origin = "modifier";

  const edgeIndices = toEdgeIndices(edges);
  const modifierXY = toXY(modifierPoints);

  if (image) {
    const { generated, triangles, borderCount } = await pipelineWorker.generate(
      modifierXY,
      edgeIndices,
      data.seed,
      data.seedSettings,
      image.width,
      image.height,
    );
    const generatedPoints = toPoints(generated, borderCount);
    buildGeometry(modifierPoints.concat(generatedPoints), triangles);
  } else {
    const triangles =
      modifierPoints.length >= 3
        ? await pipelineWorker.triangulateOnly(modifierXY, edgeIndices)
        : new Uint32Array(0);
    buildGeometry(modifierPoints.slice(), triangles);
  }

  emitDerived();
}

function toXY(points: Point[]): Float32Array {
  const out = new Float32Array(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    out[2 * i] = points[i].x;
    out[2 * i + 1] = points[i].y;
  }
  return out;
}

function toPoints(xy: Float32Array, borderCount: number): Point[] {
  // Generated points carry no identity - they exist only for the points overlay.
  // The first `borderCount` are border nodes (WASM emits them as a leading block);
  // tagging their origin drives the overlay color (border = orange, interior = white).
  const out: Point[] = new Array(xy.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = { x: xy[2 * i], y: xy[2 * i + 1], origin: i < borderCount ? "border" : "interior" };
  }
  return out;
}

function toEdgeIndices(edges: [number, number][]): Uint32Array {
  const out = new Uint32Array(edges.length * 2);
  for (let i = 0; i < edges.length; i++) {
    out[2 * i] = edges[i][0];
    out[2 * i + 1] = edges[i][1];
  }
  return out;
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
    case "bezier":
      return applyBezier(points, mod);
    default:
      return { points, edges: [] };
  }
}
