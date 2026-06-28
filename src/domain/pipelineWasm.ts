// Thin facade over the Rust/wasm point-generation pipeline (Sobel + Bridson + CDT).
// The glue under src/generated/ is produced by scripts/build-wasm.mjs.
import init, {
  generate as wasmGenerate,
  reset_image as wasmResetImage,
  set_image as wasmSetImage,
  triangulate_only as wasmTriangulateOnly,
} from "../generated/pipeline.js";
import type { SeedSettings } from "../settings/types.js";

let ready = false;

export async function initPipeline(): Promise<void> {
  if (ready) return;
  await init();
  ready = true;
}

/** Compute and cache the Sobel edge-density map for an RGBA image. */
export function setImage(rgba: Uint8ClampedArray, width: number, height: number): void {
  // Pass a Uint8Array view (no copy) - the glue's slice helper expects Uint8Array.
  wasmSetImage(new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength), width, height);
}

/** Drop cached density + interior (image cleared or replaced). */
export function resetImage(): void {
  wasmResetImage();
}

export interface GeneratedGeometry {
  /** Generated points (border + interior) as [x, y, ...]. */
  generated: Float32Array;
  /** Triangle index triples over the union `modifiers ++ generated`. */
  triangles: Uint32Array;
  /** Count of leading `generated` points that are border nodes (the rest are interior). */
  borderCount: number;
}

/**
 * Run Bridson seeding + constrained Delaunay over the union of the given modifier
 * points and the generated interior. `edges` are index pairs into the modifier block.
 */
export function generate(
  modifierXY: Float32Array,
  edges: Uint32Array,
  seed: number,
  settings: SeedSettings,
  width: number,
  height: number,
): GeneratedGeometry {
  const result = wasmGenerate(
    modifierXY,
    edges,
    seed >>> 0,
    Math.max(0, Math.floor(settings.borderPerSide)),
    settings.minRadius,
    settings.maxRadius,
    width,
    height,
  );
  const generated = result.generated_xy;
  const triangles = result.triangles;
  const borderCount = result.border_count;
  result.free();
  return { generated, triangles, borderCount };
}

/** Triangulate a bare point set (no seeding) - used when there is no image. */
export function triangulateOnly(pointsXY: Float32Array, edges: Uint32Array): Uint32Array {
  return wasmTriangulateOnly(pointsXY, edges);
}
