import { getModifiers } from "../document/selectors/document.js";
import { signals } from "../document/signals.js";
import type { Modifier } from "../document/types.js";
import { catmullRomOutline } from "../domain/modifiers/catmullrom.js";
import { circleOutline } from "../domain/modifiers/circle.js";
import type { Preview } from "../preview/preview.js";
import { getSelected, selectionChanged, setSelected } from "./selection.js";

interface Vec {
  x: number;
  y: number;
}

interface Overlay {
  outline: Vec[];
  closed: boolean;
  handles: Vec[];
}

export function computeOverlay(mod: Modifier): Overlay {
  if (mod.kind === "polyline") {
    return { outline: mod.vertices, closed: mod.closed, handles: mod.vertices };
  }
  if (mod.kind === "catmullrom") {
    return {
      outline: catmullRomOutline(mod.vertices, mod.closed),
      closed: mod.closed,
      handles: mod.vertices,
    };
  }
  return {
    outline: circleOutline(mod.center, mod.edge),
    closed: true,
    handles: [mod.center, mod.edge],
  };
}

export function refreshHighlight(preview: Preview): void {
  const sel = getSelected();
  const mod = sel ? getModifiers().find((m) => m.uuid === sel) : undefined;
  if (!mod) {
    if (sel) setSelected(null);
    preview.setHighlightedPath(null, false);
    return;
  }
  const o = computeOverlay(mod);
  preview.setHighlightedPath(o.outline, o.closed, o.handles);
}

export function attachHighlight(preview: Preview): void {
  selectionChanged.on(() => refreshHighlight(preview));
  signals.modifiers.on(() => refreshHighlight(preview));
}
