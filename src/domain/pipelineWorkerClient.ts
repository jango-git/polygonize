// Main-thread client for the pipeline web worker (domain/pipelineWorker.ts). `setImage` is
// fire-and-forget (the worker's in-order queue guarantees it lands before the next
// `generate`); the request/response calls return a promise resolved by message id.
import type { SeedSettings, TraceSettings } from "../settings/types.js";
import type { GeneratedGeometry, TracedPolyline } from "./pipelineWasm.js";

let worker: Worker | undefined;
let nextId = 1;
const pending = new Map<number, (data: unknown) => void>();

export function initPipelineWorker(): void {
  worker = new Worker(new URL("./pipelineWorker.js", import.meta.url), { type: "module" });
  worker.addEventListener("message", (e: MessageEvent<{ id: number }>) => {
    const resolve = pending.get(e.data.id);
    if (!resolve) return;
    pending.delete(e.data.id);
    resolve(e.data);
  });
}

function request<T>(message: Record<string, unknown>, transfer: Transferable[]): Promise<T> {
  const id = nextId++;
  return new Promise<T>((resolve) => {
    pending.set(id, resolve as (data: unknown) => void);
    worker?.postMessage({ ...message, id }, transfer);
  });
}

/** Compute and cache the Sobel edge-density map for an RGBA image (fire-and-forget). */
export function setImage(data: Uint8ClampedArray, width: number, height: number): void {
  // Copy the pixels: the source buffer is shared with the color worker, so it cannot be
  // transferred (which would detach it). The copy is transferred to avoid a second clone.
  const imageData = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  worker?.postMessage({ type: "setImage", imageData, width, height }, [imageData]);
}

export async function generate(
  modifierXY: Float32Array,
  edges: Uint32Array,
  seed: number,
  settings: SeedSettings,
  width: number,
  height: number,
): Promise<GeneratedGeometry> {
  return request<GeneratedGeometry>(
    {
      type: "generate",
      modifierXY: modifierXY.buffer,
      edges: edges.buffer,
      seed,
      settings,
      width,
      height,
    },
    [modifierXY.buffer, edges.buffer],
  );
}

export async function triangulateOnly(
  pointsXY: Float32Array,
  edges: Uint32Array,
): Promise<Uint32Array> {
  const result = await request<{ triangles: Uint32Array }>(
    { type: "triangulate", pointsXY: pointsXY.buffer, edges: edges.buffer },
    [pointsXY.buffer, edges.buffer],
  );
  return result.triangles;
}

export async function traceEdges(settings: TraceSettings): Promise<TracedPolyline[]> {
  const result = await request<{ polylines: TracedPolyline[] }>({ type: "trace", settings }, []);
  return result.polylines;
}
