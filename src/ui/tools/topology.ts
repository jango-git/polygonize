import { splitModifier, updateModifier } from "../../document/commands/modifiers.js";
import type { Modifier } from "../../document/types.js";
import { defaultAnchorHandle } from "../../domain/modifiers/bezier.js";
import { insertBezierAnchor, insertPathVertex } from "../../domain/modifiers/insert.js";
import type { Preview } from "../../preview/preview.js";
import { refreshHighlight } from "../highlight.js";
import { clearSelectedPoint, getSelectedPoint, setSelectedPoint } from "../pointSelection.js";
import { setSelected } from "../selection.js";
import { GRAB_RADIUS_PX, HANDLE_EPSILON } from "./constants.js";
import type { DragTarget } from "./dragSession.js";
import type { Vector2 } from "./geometry.js";
import { BezierHandle, controlPoints, nearestControl, nearestEndpoint } from "./hitTest.js";

// Topology edits on the currently selected modifier: the Alt / Ctrl / double-click / Delete
// gestures that add, remove, split, or reshape control points. Each owns its full edit -
// the document mutation (through commands), the control-point selection, and the highlight
// refresh - and returns whether it handled the gesture so the controller can fall through
// to another. They never touch the editor mode; drag-initiating extrude takes a callback.

function grabRadiusSq(preview: Preview): number {
  return (GRAB_RADIUS_PX * preview.worldPerPixel()) ** 2;
}

// Double-click a bezier anchor: toggle it between retracted (zero) and default tangent
// handles, so a corner-like point can be turned into a draggable one.
export function toggleBezierHandle(sel: Modifier, point: Vector2, preview: Preview): void {
  if (sel.kind !== "bezier") return;
  const anchorIndex = nearestControl(sel.anchors, point, grabRadiusSq(preview));
  if (anchorIndex < 0) return;

  const anchors = sel.anchors.map((anchor) => ({ ...anchor }));
  const anchor = anchors[anchorIndex];
  if (Math.hypot(anchor.hx, anchor.hy) > HANDLE_EPSILON) {
    anchor.hx = 0;
    anchor.hy = 0;
  } else {
    const handle = defaultAnchorHandle(sel, anchorIndex);
    anchor.hx = handle.hx;
    anchor.hy = handle.hy;
  }
  updateModifier(sel.uuid, { anchors });
  refreshHighlight(preview);
}

// Ctrl/Cmd + click a control point: split the modifier into two at that point. The
// original is replaced by the halves, so its selection no longer resolves.
export function splitAtControlPoint(sel: Modifier, point: Vector2, preview: Preview): boolean {
  if (sel.kind === "circle") return false;
  const controlIndex = nearestControl(controlPoints(sel), point, grabRadiusSq(preview));
  if (controlIndex < 0) return false;
  splitModifier(sel.uuid, controlIndex);
  setSelected(null);
  return true;
}

// Alt + click the curve (not on a control point): insert a new point there.
export function insertOnCurve(sel: Modifier, point: Vector2, preview: Preview): boolean {
  if (sel.kind === "circle") return false;
  const grabSq = grabRadiusSq(preview);
  // A press on an existing control point is a select/drag, not an insert.
  if (nearestControl(controlPoints(sel), point, grabSq) >= 0) return false;

  if (sel.kind === "path") {
    const inserted = insertPathVertex(sel, point, grabSq);
    if (!inserted) return false;
    const pointCount = sel.interpolation === "polyline" ? sel.pointCount + 1 : sel.pointCount;
    updateModifier(sel.uuid, { vertices: inserted.vertices, pointCount });
    setSelectedPoint(sel.uuid, inserted.index);
  } else {
    const inserted = insertBezierAnchor(sel, point, grabSq);
    if (!inserted) return false;
    updateModifier(sel.uuid, { anchors: inserted.anchors });
    setSelectedPoint(sel.uuid, inserted.index);
  }
  refreshHighlight(preview);
  return true;
}

// Alt + drag an open endpoint: append a coincident point at that end and start dragging it,
// leaving the original endpoint in place (a classic extrude). `startDrag` is invoked before
// the append so the append + drag collapse into one undo step.
export function extrudeEndpoint(
  sel: Modifier,
  point: Vector2,
  preview: Preview,
  startDrag: (target: DragTarget) => void,
): boolean {
  const grabSq = grabRadiusSq(preview);
  if (sel.kind === "path") {
    if (sel.closed) return false;
    const end = nearestEndpoint(sel.vertices, point, grabSq);
    if (end < 0) return false;
    const vertices = sel.vertices.map((vertex) => ({ x: vertex.x, y: vertex.y }));
    const at = end === 0 ? 0 : vertices.length;
    vertices.splice(at, 0, { x: vertices[end].x, y: vertices[end].y });
    const pointCount = sel.interpolation === "polyline" ? sel.pointCount + 1 : sel.pointCount;
    startDrag({ kind: "control", index: at });
    updateModifier(sel.uuid, { vertices, pointCount });
    setSelectedPoint(sel.uuid, at);
    refreshHighlight(preview);
    return true;
  }
  if (sel.kind === "bezier") {
    if (sel.closed) return false;
    const end = nearestEndpoint(sel.anchors, point, grabSq);
    if (end < 0) return false;
    const anchors = sel.anchors.map((anchor) => ({ ...anchor }));
    const at = end === 0 ? 0 : anchors.length;
    const source = anchors[end];
    anchors.splice(at, 0, { x: source.x, y: source.y, hx: 0, hy: 0 });
    startDrag({ kind: "bezier", target: { index: at, handle: BezierHandle.Anchor } });
    updateModifier(sel.uuid, { anchors });
    setSelectedPoint(sel.uuid, at);
    refreshHighlight(preview);
    return true;
  }
  return false;
}

// Delete the selected control point of `sel`, if it has one and stays valid without it.
export function deleteControlPoint(sel: Modifier, preview: Preview): boolean {
  const point = getSelectedPoint();
  if (!point || point.modifier !== sel.uuid) return false;
  const count =
    sel.kind === "path" ? sel.vertices.length : sel.kind === "bezier" ? sel.anchors.length : 0;
  if (point.index < 0 || point.index >= count) return false;

  if (sel.kind === "path") {
    // Below the minimum a path/bezier stops being valid; deleting is a no-op rather than
    // wiping the modifier.
    if (sel.vertices.length <= 2) return false;
    const vertices = sel.vertices.filter((_, index) => index !== point.index);
    const pointCount =
      sel.interpolation === "polyline"
        ? Math.max(vertices.length, sel.pointCount - 1)
        : sel.pointCount;
    updateModifier(sel.uuid, { vertices, pointCount });
  } else if (sel.kind === "bezier") {
    if (sel.anchors.length <= 2) return false;
    const anchors = sel.anchors.filter((_, index) => index !== point.index);
    updateModifier(sel.uuid, { anchors });
  } else {
    return false; // circle handles are structural
  }
  clearSelectedPoint();
  refreshHighlight(preview);
  return true;
}
