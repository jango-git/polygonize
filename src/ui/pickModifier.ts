import { getModifiers } from "../document/selectors/document.js";
import { signals } from "../document/signals.js";
import type { Modifier, ModifierUUID } from "../document/types.js";
import type { Preview } from "../preview/preview.js";
import { computeOverlay } from "./highlight.js";
import { getSelected, selectionChanged, setSelected } from "./selection.js";
import { activeToolChanged } from "./tools.js";

const INNER_RADIUS_PX = 32;
const OUTER_RADIUS_PX = 64;

interface Vec {
  x: number;
  y: number;
}

interface PickEntry {
  uuid: ModifierUUID;
  mod: Modifier;
  outline: Vec[];
  closed: boolean;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function attachPickModifier(preview: Preview): void {
  const canvas = preview.domElement;

  let activeKind: string | null = null;
  let entries: PickEntry[] = [];
  let dirty = true;
  let hoverUuid: ModifierUUID | null = null;
  let nearbyKey = "";
  let pending: { x: number; y: number } | null = null;
  let frame = 0;

  const cursorMode = (): boolean => activeKind === null && getSelected() === null;

  const rebuild = (): void => {
    entries = getModifiers().map((mod) => {
      const { outline, closed } = computeOverlay(mod);
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of outline) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      return { uuid: mod.uuid, mod, outline, closed, minX, minY, maxX, maxY };
    });
    dirty = false;
  };

  const clearHover = (): void => {
    if (hoverUuid !== null) {
      hoverUuid = null;
      canvas.style.cursor = "";
      preview.setHoverPath(null, false);
    }
    if (nearbyKey !== "") {
      nearbyKey = "";
      preview.setNearbyPaths([]);
    }
  };

  const recompute = (): void => {
    if (!pending) return;
    const { x, y } = pending;
    pending = null;

    if (!cursorMode()) {
      clearHover();
      return;
    }
    if (dirty) rebuild();
    if (entries.length === 0) {
      clearHover();
      return;
    }

    const p = preview.screenToImage(x, y);
    const wpp = preview.worldPerPixel();
    const innerSq = (INNER_RADIUS_PX * wpp) ** 2;
    const outerSq = (OUTER_RADIUS_PX * wpp) ** 2;

    let best: PickEntry | null = null;
    let bestDist = innerSq;
    const nearby: PickEntry[] = [];
    for (const entry of entries) {
      if (aabbDistSq(p, entry) >= outerSq) continue;

      const d = distToOutlineSq(p, entry.outline, entry.closed);
      if (d >= outerSq) continue;
      nearby.push(entry);
      if (d < bestDist) {
        bestDist = d;
        best = entry;
      }
    }

    if (best && best.uuid !== hoverUuid) {
      hoverUuid = best.uuid;
      preview.setHoverPath(best.outline, best.closed);
      canvas.style.cursor = "pointer";
    } else if (!best && hoverUuid !== null) {
      hoverUuid = null;
      canvas.style.cursor = "";
      preview.setHoverPath(null, false);
    }

    const others = nearby.filter((e) => e.uuid !== best?.uuid);
    const key = others.map((e) => e.uuid).join(",");
    if (key !== nearbyKey) {
      nearbyKey = key;
      preview.setNearbyPaths(others.map((e) => ({ outline: e.outline, closed: e.closed })));
    }
  };

  const schedule = (e: PointerEvent): void => {
    pending = { x: e.clientX, y: e.clientY };
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      recompute();
    });
  };

  canvas.addEventListener("pointermove", schedule);
  canvas.addEventListener("pointerleave", clearHover);
  canvas.addEventListener("click", (e) => {
    if (e.button !== 0 || !cursorMode() || hoverUuid === null) return;
    setSelected(hoverUuid);
    clearHover();
  });

  activeToolChanged.on((kind) => {
    activeKind = kind;
    if (!cursorMode()) clearHover();
  });
  selectionChanged.on(() => {
    if (!cursorMode()) clearHover();
  });
  signals.modifiers.on(() => {
    dirty = true;
  });
}

function aabbDistSq(
  p: Vec,
  box: { minX: number; minY: number; maxX: number; maxY: number },
): number {
  const dx = p.x < box.minX ? box.minX - p.x : p.x > box.maxX ? p.x - box.maxX : 0;
  const dy = p.y < box.minY ? box.minY - p.y : p.y > box.maxY ? p.y - box.maxY : 0;
  return dx * dx + dy * dy;
}

function distToOutlineSq(p: Vec, pts: Vec[], closed: boolean): number {
  if (pts.length === 0) return Infinity;
  if (pts.length === 1) return distSq(p, pts[0]);
  const n = pts.length;
  const segs = closed ? n : n - 1;
  let best = Infinity;
  for (let i = 0; i < segs; i++) {
    const d = segDistSq(p, pts[i], pts[(i + 1) % n]);
    if (d < best) best = d;
  }
  return best;
}

function segDistSq(p: Vec, a: Vec, b: Vec): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  let t = len2 > 0 ? ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = a.x + t * vx - p.x;
  const dy = a.y + t * vy - p.y;
  return dx * dx + dy * dy;
}

function distSq(p: Vec, q: Vec): number {
  const dx = p.x - q.x;
  const dy = p.y - q.y;
  return dx * dx + dy * dy;
}
