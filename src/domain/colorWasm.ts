// Thin facade over the Rust/wasm color pipeline (per-triangle sampling + lookup grid).
// The glue under src/generated/ is produced by scripts/build-wasm.mjs. Runs inside the
// color web worker (see colorWorker.ts).
import init, {
  compute as wasmCompute,
  reset_image as wasmResetImage,
  set_image as wasmSetImage,
} from "../generated/color.js";
import type { ColorGrid } from "./colorGrid.js";
import type { ColorSettings } from "../settings/types.js";

let ready = false;

export async function initColorWasm(): Promise<void> {
  if (ready) return;
  await init();
  ready = true;
}

/** Cache the RGBA source image in wasm state (uploaded once, sampled per compute). */
export function setColorImage(rgba: Uint8ClampedArray, width: number, height: number): void {
  // Pass a Uint8Array view (no copy here) - the glue's slice helper expects Uint8Array.
  wasmSetImage(new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength), width, height);
}

/** Drop the cached image (canvas cleared or replaced). */
export function resetColorImage(): void {
  wasmResetImage();
}

/**
 * Sample triangle colors and build the spatial lookup grid. `coords` is `[ax, ay, bx, by,
 * cx, cy, ...]` (6 per triangle). The returned typed arrays are fresh copies (the wasm
 * result is freed here), so the worker may transfer their buffers.
 */
export function computeColorGrid(coords: Float64Array, settings: ColorSettings): ColorGrid {
  const result = wasmCompute(
    coords,
    coords.length / 6,
    Math.max(1, Math.floor(settings.samplesPerTriangle)),
    settings.strategy === "median" ? 1 : 0,
  );
  // Getters copy into fresh JS typed arrays, so they stay valid after free().
  const grid: ColorGrid = {
    cols: result.cols,
    rows: result.rows,
    cellW: result.cell_w,
    cellH: result.cell_h,
    entries: result.entries,
    cellIndex: result.cell_index,
  };
  result.free();
  return grid;
}
