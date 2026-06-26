import { getImage, getPoints, getTriangles } from "../document/selectors/document.js";
import { signals } from "../document/signals.js";
import type { Point } from "../document/types.js";
import { getViewSettings, viewSettingsChanged } from "../settings/store.js";
import type { Preview } from "./preview.js";

export function connectPreview(preview: Preview): void {
  signals.image.on(({ image }) => {
    preview.setImageFrame(image);
    preview.setOverlayOpacity(getViewSettings().overlayOpacity);
    syncTriangles(preview);
    preview.rebuildPoints(getPoints());
  });

  signals.points.on(() => {
    preview.rebuildPoints(getPoints());
  });

  signals.triangles.on(() => {
    syncTriangles(preview);
  });

  viewSettingsChanged.on((view) => {
    preview.setOverlayOpacity(view.overlayOpacity);
    preview.setPointsOpacity(view.pointsOpacity);
  });

  preview.setImageFrame(getImage());
  preview.setOverlayOpacity(getViewSettings().overlayOpacity);
  preview.setPointsOpacity(getViewSettings().pointsOpacity);
  syncTriangles(preview);
  preview.rebuildPoints(getPoints());
}

function syncTriangles(preview: Preview): void {
  const map = new Map<string, Point>();
  for (const p of getPoints()) map.set(p.uuid, p);
  preview.rebuildTriangles(getTriangles(), map);
}
