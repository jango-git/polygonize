import { traceEdges } from "../../domain/pipelineWasm.js";
import { getTraceSettings } from "../../settings/store.js";
import { type Modifier, newModifierUUID, type PathModifier } from "../types.js";
import { store } from "../store.js";
import { setTracedGroup } from "./modifiers.js";

/**
 * Trace the current image into editable polyline path modifiers (one per contour),
 * overwriting the managed "Traced contours" group. Non-destructive elsewhere: the result
 * is a starting point the user corrects by hand.
 */
export function traceImageEdges(): void {
  if (!store.data().image) return;

  const polylines = traceEdges(getTraceSettings());

  const mods: Modifier[] = polylines.map(
    (poly): PathModifier => ({
      uuid: newModifierUUID(),
      kind: "path",
      interpolation: "polyline",
      vertices: poly.points,
      closed: poly.closed,
      // Polyline vertices map 1:1 to resolved points (see domain/modifiers/polyline.ts).
      pointCount: poly.points.length,
    }),
  );

  setTracedGroup(mods);
}
