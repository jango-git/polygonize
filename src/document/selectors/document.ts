import { store } from "../store.js";
import {
  collectModifiers,
  type DocumentData,
  type ImageRef,
  type Modifier,
  type Point,
  type StackEntry,
  type Triangle,
} from "../types.js";

const clone = <T>(value: T): T =>
  typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

export function getDocument(): DocumentData {
  return clone(store.data());
}

export function getPoints(): Point[] {
  return clone(store.data().points);
}

export function getTriangles(): Triangle[] {
  return clone(store.data().triangles);
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
