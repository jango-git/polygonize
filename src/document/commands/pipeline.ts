import { applyBezier } from "../../domain/modifiers/bezier.js";
import { applyCircle } from "../../domain/modifiers/circle.js";
import { applyPath } from "../../domain/modifiers/path.js";
import { groupColorHex } from "../../domain/groupColor.js";
import * as pipelineWorker from "../../domain/pipelineWorkerClient.js";
import { DeltaOperation, signals } from "../signals.js";
import { store } from "../store.js";
import {
  type ConstraintEdge,
  type Modifier,
  type ModifierResult,
  type Point,
  type PointUUID,
} from "../types.js";
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

  // Group index counts group entries in stack order (loose modifiers excluded),
  // matching `groupIndexOf*` and the panel - so the point tint lines up with the
  // spine and the path overlay. Muted groups still consume an index (they keep a
  // stable color when unmuted) but contribute no points.
  let groupIndex = 0;
  for (const entry of data.stack) {
    if (entry.type === "modifier") {
      apply(entry.modifier);
    } else {
      const tint = groupColorHex(groupIndex);
      groupIndex += 1;
      if (entry.group.muted) continue;
      const start = modifierPoints.length;
      entry.children.forEach(apply);
      for (let i = start; i < modifierPoints.length; i++) modifierPoints[i].tint = tint;
    }
  }

  for (const point of modifierPoints) point.origin = "modifier";

  const indexOf = new Map<PointUUID, number>();
  for (let i = 0; i < modifierPoints.length; i++) {
    const u = modifierPoints[i].uuid;
    if (u !== undefined) indexOf.set(u, i);
  }
  const edgeIndices = toEdgeIndices(edges, indexOf);
  const modifierXY = toXY(modifierPoints);

  data.constraintEdges = edges;

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

// Derived signals fire when a run completes (geometry is in the render buffers). Structural
// signals (`modifiers`) are emitted synchronously by the callers that mutate the stack.
function emitDerived(): void {
  signals.points.emit({ op: DeltaOperation.REPLACED });
  signals.triangles.emit({ op: DeltaOperation.REPLACED });
  signals.document.emit();
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

function toEdgeIndices(edges: ConstraintEdge[], indexOf: Map<PointUUID, number>): Uint32Array {
  const out: number[] = [];
  for (const [a, b] of edges) {
    const ia = indexOf.get(a);
    const ib = indexOf.get(b);
    if (ia === undefined || ib === undefined || ia === ib) continue;
    out.push(ia, ib);
  }
  return Uint32Array.from(out);
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
