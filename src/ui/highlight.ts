import { getModifiers, groupIndexOfModifier } from "../document/selectors/document.js";
import { signals } from "../document/signals.js";
import type { BezierModifier, Modifier, ModifierUUID } from "../document/types.js";
import { groupColorHex } from "../domain/groupColor.js";
import { bezierOutline } from "../domain/modifiers/bezier.js";
import { catmullRomOutline } from "../domain/modifiers/catmullrom.js";
import { circleOutline } from "../domain/modifiers/circle.js";
import type { Preview } from "../preview/preview.js";
import { focusRequested, getSelected, selectionChanged, setSelected } from "./selection.js";

interface Vec {
  x: number;
  y: number;
}

const HANDLE_EPS = 1e-3;

// Tangent whiskers for a bezier: anchor -> each (symmetric) handle end, with a
// dot at every end. Retracted handles (~zero length) are skipped so they do not
// clutter the view or shadow the anchor during hit-testing.
export function bezierWhiskers(mod: BezierModifier): { segments: [Vec, Vec][]; dots: Vec[] } {
  const segments: [Vec, Vec][] = [];
  const dots: Vec[] = [];
  for (const a of mod.anchors) {
    if (Math.hypot(a.hx, a.hy) <= HANDLE_EPS) continue;
    const out = { x: a.x + a.hx, y: a.y + a.hy };
    const inn = { x: a.x - a.hx, y: a.y - a.hy };
    segments.push([{ x: a.x, y: a.y }, out], [{ x: a.x, y: a.y }, inn]);
    dots.push(out, inn);
  }
  return { segments, dots };
}

interface Overlay {
  outline: Vec[];
  closed: boolean;
  handles: Vec[];
}

export function computeOverlay(mod: Modifier): Overlay {
  if (mod.kind === "path") {
    return {
      outline:
        mod.interpolation === "catmullrom"
          ? catmullRomOutline(mod.vertices, mod.closed)
          : mod.vertices,
      closed: mod.closed,
      handles: mod.vertices,
    };
  }
  if (mod.kind === "bezier") {
    return {
      outline: bezierOutline(mod),
      closed: mod.closed,
      handles: mod.anchors.map((a) => ({ x: a.x, y: a.y })),
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
    preview.setHandleWhiskers([], []);
    return;
  }
  const o = computeOverlay(mod);
  const color = modifierColor(mod.uuid);
  preview.setHighlightedPath(o.outline, o.closed, o.handles, color);
  if (mod.kind === "bezier") {
    const w = bezierWhiskers(mod);
    preview.setHandleWhiskers(w.segments, w.dots, color);
  } else {
    preview.setHandleWhiskers([], []);
  }
}

// Overlay color for a modifier: its group's accent, or undefined (the preview's
// default modifier color) when loose. Returning undefined lets callers lean on
// the setters' default parameter.
export function modifierColor(uuid: ModifierUUID): number | undefined {
  const index = groupIndexOfModifier(uuid);
  return index === null ? undefined : groupColorHex(index);
}

export function attachHighlight(preview: Preview): void {
  selectionChanged.on(() => refreshHighlight(preview));
  signals.modifiers.on(() => refreshHighlight(preview));
  focusRequested.on((uuid) => {
    const mod = getModifiers().find((m) => m.uuid === uuid);
    if (!mod) return;
    const { outline } = computeOverlay(mod);
    if (outline.length === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of outline) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    preview.focusOnBounds(minX, minY, maxX, maxY);
  });
}
