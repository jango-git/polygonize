import { clone } from "../clone.js";
import { collectActiveModifiers, collectModifiers } from "../stack.js";
import { store } from "../store.js";
import {
  DOCUMENT_VERSION,
  type GroupUUID,
  type ImageRef,
  type Modifier,
  type ModifierUUID,
  type PersistedDocument,
  type Point,
  type StackEntry,
} from "../types.js";

export function serializeDocument(): PersistedDocument {
  const data = store.data();
  return clone({
    version: DOCUMENT_VERSION,
    image: data.image,
    seed: data.seed,
    seedSettings: data.seedSettings,
    colorSettings: data.colorSettings,
    stack: data.stack,
  });
}

export function getPoints(): Point[] {
  return clone(store.data().points);
}

// Render buffers are read-only typed arrays consumed by the preview each frame -
// returned by reference (no clone) to keep the drag path allocation-free.
export function getRenderPositions(): Float32Array {
  return store.data().renderPositions;
}

export function getRenderColors(): Uint8Array {
  return store.data().renderColors;
}

export function getTriangleCount(): number {
  return store.data().triangleCount;
}

export function getImage(): ImageRef | null {
  return clone(store.data().image);
}

export function getStack(): StackEntry[] {
  return clone(store.data().stack);
}

export function getModifiers(): Modifier[] {
  return clone(collectModifiers(store.data().stack));
}

// Only the modifiers that actually render (loose + non-muted groups). Used by the
// cursor pick/hover so muted (hidden) groups are not selectable on the canvas.
export function getActiveModifiers(): Modifier[] {
  return clone(collectActiveModifiers(store.data().stack));
}

// Name of the group a modifier belongs to. This is the key `groupColor` derives a
// color from, so the spine, the preview overlay, and the point tint all resolve to
// one color per group. Returns null when the modifier is loose (no group) or gone.
export function groupNameOfModifier(uuid: ModifierUUID): string | null {
  for (const entry of store.data().stack) {
    if (entry.type !== "group") continue;
    if (entry.children.some((m) => m.uuid === uuid)) return entry.group.name;
  }
  return null;
}

export function groupNameOfGroup(uuid: GroupUUID): string | null {
  for (const entry of store.data().stack) {
    if (entry.type === "group" && entry.group.uuid === uuid) return entry.group.name;
  }
  return null;
}
