// Color web worker. Off-thread, it samples each triangle's color from the source image
// and builds the spatial lookup grid. The heavy work lives in the `color` wasm crate; this
// worker just marshals messages to/from it (see domain/colorWasm.ts).
import { computeColorGrid, initColorWasm, setColorImage } from "./colorWasm.js";
import type { ColorSettings } from "../settings/types.js";

declare function postMessage(message: unknown, transfer?: Transferable[]): void;

interface SetImageMessage {
  type: "setImage";
  imageData: ArrayBuffer;
  imageWidth: number;
  imageHeight: number;
}

interface ComputeMessage {
  type: "compute";
  id: number;
  coordinates: ArrayBuffer;
  triangleCount: number;
  samplesPerTriangle: number;
  strategy: ColorSettings["strategy"];
}

// Process messages strictly in order, after the wasm module is initialized. Each handler
// chains onto the previous promise so a `compute` never runs before its preceding
// `setImage` (or before init) completes.
let queue: Promise<void> = initColorWasm();

self.addEventListener("message", (event: Event) => {
  const message = (event as MessageEvent<SetImageMessage | ComputeMessage>).data;
  queue = queue.then(() => handle(message));
});

function handle(message: SetImageMessage | ComputeMessage): void {
  if (message.type === "setImage") {
    setColorImage(
      new Uint8ClampedArray(message.imageData),
      message.imageWidth,
      message.imageHeight,
    );
    return;
  }

  const coordinates = new Float64Array(message.coordinates);
  const grid = computeColorGrid(coordinates, {
    samplesPerTriangle: message.samplesPerTriangle,
    strategy: message.strategy,
  });
  postMessage({ id: message.id, ...grid }, [grid.entries.buffer, grid.cellIndex.buffer]);
}
