import type { ColorGrid } from "./colorGrid.js";
import type { ColorSettings } from "../settings/types.js";

type ResultCallback = (grid: ColorGrid) => void;

let worker: Worker | undefined;
let onResult: ResultCallback | undefined;

// One compute is in flight at a time; newer requests overwrite the pending one. This keeps
// the worker from backing up under continuous input (a drag fires `requestColors` every
// rendered frame) and means every returned grid is the latest available - so it is always
// applied, never dropped. Dropping completed grids would starve color updates entirely
// while the input keeps coming (only the final one would ever show). See the same reasoning
// in commands/pipeline.ts.
let inFlight = false;
let pending: { coords: Float64Array; settings: ColorSettings } | undefined;

export function initColorWorker(callback: ResultCallback): void {
  onResult = callback;
  worker = new Worker(new URL("./colorWorker.js", import.meta.url), { type: "module" });
  worker.addEventListener("message", (e: MessageEvent<ColorGrid>) => {
    inFlight = false;
    onResult?.(e.data);
    flush();
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
  // Keep only the most recent request; a not-yet-sent pending one is already superseded.
  pending = { coords, settings };
  if (!inFlight) flush();
}

function flush(): void {
  if (!worker || !pending) return;
  const { coords, settings } = pending;
  pending = undefined;
  inFlight = true;
  worker.postMessage({ type: "compute", coordinates: coords.buffer, settings }, [coords.buffer]);
}
