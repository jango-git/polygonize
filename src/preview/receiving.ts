import {
  getImage,
  getPoints,
  getRenderColors,
  getRenderPositions,
  getTriangleCount,
} from "../document/selectors/document.js";
import { DeltaOperation, signals } from "../document/signals.js";
import { getViewSettings, viewSettingsChanged } from "../settings/store.js";
import type { Preview } from "./preview.js";

// Wires the document signals and view settings to the preview. Flow is one way:
// the preview only receives, it never reads back into the model.
export function connectPreview(preview: Preview): void {
  signals.image.on(({ image }) => {
    preview.setImageFrame(image);
    preview.setOverlayOpacity(getViewSettings().overlayOpacity);
    syncTriangleGeometry(preview);
    preview.rebuildPoints(getPoints());
  });

  signals.points.on(() => {
    preview.rebuildPoints(getPoints());
  });

  signals.triangles.on(({ op: operation }) => {
    // Color-worker results only recolor the existing triangle set - update colors
    // in place. Geometry changes (REPLACED) rebuild positions + colors.
    if (operation === DeltaOperation.UPDATE) {
      preview.setTriangleColors(getRenderColors(), getTriangleCount());
    } else {
      syncTriangleGeometry(preview);
    }
  });

  viewSettingsChanged.on((viewSettings) => {
    preview.setOverlayOpacity(viewSettings.overlayOpacity);
    preview.setPointsOpacity(viewSettings.pointsOpacity);
    preview.setSpikeOpacity(viewSettings.spikeOpacity);
  });

  syncInitialState(preview);
}

// Push the already-loaded document and current settings into a freshly connected
// preview, so it reflects an autoloaded project without waiting for the next edit.
function syncInitialState(preview: Preview): void {
  const viewSettings = getViewSettings();
  preview.setImageFrame(getImage());
  preview.setOverlayOpacity(viewSettings.overlayOpacity);
  preview.setPointsOpacity(viewSettings.pointsOpacity);
  preview.setSpikeOpacity(viewSettings.spikeOpacity);
  syncTriangleGeometry(preview);
  preview.rebuildPoints(getPoints());
}

function syncTriangleGeometry(preview: Preview): void {
  preview.setTriangleGeometry(getRenderPositions(), getRenderColors(), getTriangleCount());
}
