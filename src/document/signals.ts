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
};
