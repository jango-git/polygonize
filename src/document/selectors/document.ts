import { store } from "../store.js";
import {
  collectModifiers,
  DOCUMENT_VERSION,
  type ImageRef,
  type Modifier,
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
