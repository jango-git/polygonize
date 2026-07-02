import { traceEdges } from "../../domain/pipelineWorkerClient.js";
import { getTraceSettings } from "../../settings/store.js";
import { newModifierUUID } from "../ids.js";
import { store } from "../store.js";
import { type Modifier, type PathModifier } from "../types.js";
import { setTracedGroup } from "./groupCommands.js";

/**
 * Trace the current image into editable polyline path modifiers (one per contour),
 * overwriting the managed "Traced contours" group. Non-destructive elsewhere: the result
 * is a starting point the user corrects by hand.
 */
export async function traceImageEdges(): Promise<void> {
  if (!store.data().image) return;

  const polylines = await traceEdges(getTraceSettings());

  const mods: Modifier[] = polylines.map((poly): PathModifier => ({
    uuid: newModifierUUID(),
    kind: "path",
    interpolation: "polyline",
    vertices: poly.points,
    closed: poly.closed,
    // Polyline vertices map 1:1 to resolved points (see domain/modifiers/polyline.ts).
    pointCount: poly.points.length,
  }));

  setTracedGroup(mods);
}
