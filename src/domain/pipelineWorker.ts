// Pipeline web worker. Off-thread, it runs the heavy geometry pipeline (Sobel density +
// Bridson seeding + constrained Delaunay) that lives in the `pipeline` wasm crate; this
// worker just marshals messages to/from it (see domain/pipelineWasm.ts). The crate caches
// the density map and base interior field in its own (worker-local) state, so every entry
// point that touches that cache - setImage, generate, triangulateOnly, traceEdges - must
// run here together.
import {
  generate as wasmGenerate,
  initPipeline,
  setImage as wasmSetImage,
  traceEdges as wasmTraceEdges,
  triangulateOnly as wasmTriangulateOnly,
} from "./pipelineWasm.js";
import type { SeedSettings, TraceSettings } from "../settings/types.js";

declare function postMessage(message: unknown, transfer?: Transferable[]): void;

interface SetImageMessage {
  type: "setImage";
  imageData: ArrayBuffer;
  width: number;
  height: number;
}

interface GenerateMessage {
  type: "generate";
  id: number;
  modifierXY: ArrayBuffer;
  edges: ArrayBuffer;
  seed: number;
  settings: SeedSettings;
  width: number;
  height: number;
}

interface TriangulateMessage {
  type: "triangulate";
  id: number;
  pointsXY: ArrayBuffer;
  edges: ArrayBuffer;
}

interface TraceMessage {
  type: "trace";
  id: number;
  settings: TraceSettings;
}

type IncomingMessage = SetImageMessage | GenerateMessage | TriangulateMessage | TraceMessage;

// Process messages strictly in order, after the wasm module is initialized. Each handler
// chains onto the previous promise so a `generate` never runs before its preceding
// `setImage` (or before init) completes.
let queue: Promise<void> = initPipeline();

self.addEventListener("message", (event: Event) => {
  const message = (event as MessageEvent<IncomingMessage>).data;
  queue = queue.then(() => handle(message));
});

function handle(message: IncomingMessage): void {
  switch (message.type) {
    case "setImage": {
      wasmSetImage(new Uint8ClampedArray(message.imageData), message.width, message.height);
      return;
    }
    case "generate": {
      const result = wasmGenerate(
        new Float32Array(message.modifierXY),
        new Uint32Array(message.edges),
        message.seed,
        message.settings,
        message.width,
        message.height,
      );
      postMessage(
        {
          id: message.id,
          generated: result.generated,
          triangles: result.triangles,
          borderCount: result.borderCount,
        },
        [result.generated.buffer, result.triangles.buffer],
      );
      return;
    }
    case "triangulate": {
      const triangles = wasmTriangulateOnly(
        new Float32Array(message.pointsXY),
        new Uint32Array(message.edges),
      );
      postMessage({ id: message.id, triangles }, [triangles.buffer]);
      return;
    }
    case "trace": {
      const polylines = wasmTraceEdges(message.settings);
      postMessage({ id: message.id, polylines });
      return;
    }
  }
}
