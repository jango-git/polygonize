import { store } from "../store.js";
import {
  collectModifiers,
  DOCUMENT_VERSION,
  type GroupUUID,
  type ImageRef,
  type Modifier,
  type ModifierUUID,
  type PersistedDocument,
  type Point,
  type StackEntry,
} from "../types.js";

const clone = <T>(value: T): T =>
  typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

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

// Index of a group among the stack's group entries (ignoring loose modifiers),
// in stack order. This is the index that `groupColor` keys on, and the same
// order the panel renders groups in - so the spine, the preview overlay, and the
// point tint all resolve to one color per group. Returns null when the modifier
// is loose (no group) or the group is gone.
export function groupIndexOfModifier(uuid: ModifierUUID): number | null {
  let index = 0;
  for (const entry of store.data().stack) {
    if (entry.type !== "group") continue;
    if (entry.children.some((m) => m.uuid === uuid)) return index;
    index += 1;
  }
  return null;
}

export function groupIndexOfGroup(uuid: GroupUUID): number | null {
  let index = 0;
  for (const entry of store.data().stack) {
    if (entry.type !== "group") continue;
    if (entry.group.uuid === uuid) return index;
    index += 1;
  }
  return null;
}
