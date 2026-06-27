import type { ColorGrid } from "./colorGrid.js";
import type { ColorSettings } from "../settings/types.js";

type ResultCallback = (grid: ColorGrid) => void;

let worker: Worker | null = null;
let onResult: ResultCallback | null = null;
let currentId = 0;
let requestSentAt = 0;

export function initColorWorker(callback: ResultCallback): void {
  onResult = callback;
  worker = new Worker(new URL("./colorWorker.js", import.meta.url), { type: "module" });
  worker.addEventListener("message", (e: MessageEvent<ColorGrid & { id: number }>) => {
    if (e.data.id !== currentId) return;
    console.log(
      `[colorWorker] round-trip ${(performance.now() - requestSentAt).toFixed(1)}ms ` +
        `(post + compute + transfer back)`,
    );
    onResult?.(e.data);
  });
}

export function sendImageToWorker(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
): void {
  if (!worker) return;

  worker.postMessage({
    type: "setImage",
    imageData: data.buffer.slice(0),
    imageWidth,
    imageHeight,
  });
}

export function requestColors(coords: Float64Array, settings: ColorSettings): void {
  if (!worker || coords.length === 0) return;
  currentId++;
  const id = currentId;
  requestSentAt = performance.now();

  worker.postMessage(
    {
      type: "compute",
      id,
      coordinates: coords.buffer,
      triangleCount: coords.length / 6,
      samplesPerTriangle: settings.samplesPerTriangle,
      strategy: settings.strategy,
    },
    [coords.buffer],
  );
}
