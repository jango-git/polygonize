import { sendImageToWorker } from "../../domain/colorWorkerClient.js";
import { getPixelData, loadPixels, measureImage } from "../../domain/imageSource.js";
import * as pipelineWorker from "../../domain/pipelineWorkerClient.js";
import type { ColorSettings, SeedSettings } from "../../settings/types.js";
import { clearHistory } from "../history.js";
import { DeltaOperation, signals } from "../signals.js";
import { collectModifiers } from "../stack.js";
import { emptyDocument, store } from "../store.js";
import { type DocumentData, type ImageRef, type StackEntry } from "../types.js";
import { migrateDocument, type LegacyProjectSettings } from "./migrate.js";
import { normalizeDocument } from "./normalize.js";
import { evaluatePoints } from "./pipeline.js";
import { resetColorGrid } from "./recompute.js";

export async function setImage(src: string): Promise<void> {
  const { width, height } = await measureImage(src);
  const image: ImageRef = { src, width, height };

  await loadPixels(image);
  resetColorGrid();
  pipelineWorker.setImage(getPixelData().data, width, height);
  sendImageToWorker(getPixelData().data, width, height);

  const data = store.data();
  // Swap only the image; the rest of the project (stack, seed, color settings) stays,
  // so loading a new image re-runs the existing modifiers on it rather than resetting.
  // Modifier coordinates are absolute image pixels, so when the new image has different
  // dimensions we rescale the stack by the per-axis size ratio - each modifier keeps its
  // relative position on the canvas instead of drifting off at stale pixel coordinates.
  const previous = data.image;
  if (
    previous &&
    previous.width > 0 &&
    previous.height > 0 &&
    (previous.width !== width || previous.height !== height)
  ) {
    rescaleStack(data.stack, width / previous.width, height / previous.height);
  }
  data.image = image;

  signals.image.emit({ image });
  signals.modifiers.emit();
  signals.sourceReplaced.emit();
  // Derived signals (points/triangles/document) fire when the pipeline worker returns.
  evaluatePoints();
  // History snapshots omit the image (see history.ts treats it as invariant within a
  // session), so start a fresh undo baseline for the new image instead of letting undo
  // cross the swap. The project content itself is preserved above.
  clearHistory();
}

// Scale every modifier's coordinates in place by independent per-axis factors. Anchor and
// vertex positions are absolute; a bezier handle (hx, hy) is a delta vector, but it lives
// in the same pixel space so it scales the same way.
function rescaleStack(stack: StackEntry[], scaleX: number, scaleY: number): void {
  const scalePoint = (p: { x: number; y: number }): void => {
    p.x *= scaleX;
    p.y *= scaleY;
  };
  for (const mod of collectModifiers(stack)) {
    switch (mod.kind) {
      case "path":
        mod.vertices.forEach(scalePoint);
        break;
      case "circle":
        scalePoint(mod.center);
        scalePoint(mod.edge);
        break;
      case "bezier":
        for (const anchor of mod.anchors) {
          anchor.x *= scaleX;
          anchor.y *= scaleY;
          anchor.hx *= scaleX;
          anchor.hy *= scaleY;
        }
        break;
    }
  }
}

export async function restoreDocument(
  doc: Partial<DocumentData>,
  fileSettings?: LegacyProjectSettings,
): Promise<void> {
  store.replace(normalizeDocument(migrateDocument(doc, fileSettings)));
  const data = store.data();
  if (data.image) {
    await loadPixels(data.image);
    resetColorGrid();
    pipelineWorker.setImage(getPixelData().data, data.image.width, data.image.height);
    sendImageToWorker(getPixelData().data, data.image.width, data.image.height);
  }
  emitRestored(data);
  // A loaded/imported document starts a fresh history baseline.
  clearHistory();
}

/** Source fields restored by the in-session undo/redo history (image is unchanged). */
export interface RestoredSource {
  seed: number;
  seedSettings: SeedSettings;
  colorSettings: ColorSettings;
  stack: StackEntry[];
}

// Restore a trusted source snapshot from undo/redo. The image is unchanged (history is
// cleared whenever it changes), so the worker pixel caches stay valid and we skip the
// costly reload/setImage. The snapshot is already current-version and validated, so it
// bypasses normalizeDocument (which would, among other things, force every group
// collapsed). Geometry is recomputed from the restored source.
export function restoreSource(source: RestoredSource): void {
  const image = store.data().image;
  store.replace({
    ...emptyDocument(),
    image,
    seed: source.seed,
    seedSettings: source.seedSettings,
    colorSettings: source.colorSettings,
    stack: source.stack,
  });
  signals.modifiers.emit();
  signals.sourceReplaced.emit();
  // Deliberately NOT emitting signals.image: the image is unchanged, and that signal
  // resets the preview camera (setImageFrame -> resetView). Geometry and points refresh
  // through the pipeline run below (signals.points / signals.triangles), which leaves the
  // camera where the user left it. evaluatePoints handles the no-image case too.
  evaluatePoints();
}

function emitRestored(data: DocumentData): void {
  signals.image.emit({ image: data.image });
  signals.modifiers.emit();
  signals.sourceReplaced.emit();
  if (data.image) {
    // Derived signals fire when the pipeline worker returns.
    evaluatePoints();
  } else {
    signals.points.emit({ op: DeltaOperation.REPLACED });
    signals.triangles.emit({ op: DeltaOperation.REPLACED });
  }
}
