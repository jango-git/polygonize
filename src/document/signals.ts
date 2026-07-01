import { Ferrsign0, Ferrsign1 } from "ferrsign";
import type { ImageRef } from "./types.js";

export enum DeltaOperation {
  ADD = "ADD",
  REMOVE = "REMOVE",
  REPLACED = "REPLACED",
  UPDATE = "UPDATE",
}

export const signals = {
  points: new Ferrsign1<{ op: DeltaOperation }>(),
  triangles: new Ferrsign1<{ op: DeltaOperation }>(),
  image: new Ferrsign1<{ image: ImageRef | null }>(),
  modifiers: new Ferrsign0(),
  document: new Ferrsign0(),
  // Every group was just collapsed at once (the "collapse all" gesture from a tool
  // switch or an empty-canvas click). The panel scrolls back to the top in response;
  // distinct from `modifiers`, which also fires for ordinary edits that should not scroll.
  groupsCollapsed: new Ferrsign0(),
  // The entire document source was replaced wholesale (undo/redo, project load, image
  // swap). Any in-progress interaction (a half-drawn modifier, an active drag) refers to
  // state that no longer exists and must be abandoned. Distinct from `modifiers` on
  // purpose: `modifiers` also fires for ordinary incremental edits, so listeners that
  // only care about a full replacement can subscribe here without false positives.
  sourceReplaced: new Ferrsign0(),
};
