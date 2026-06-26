import { Ferrsign1 } from "ferrsign";
import type { ModifierUUID } from "../document/types.js";

let selected: ModifierUUID | null = null;

export const selectionChanged = new Ferrsign1<ModifierUUID | null>();

export function getSelected(): ModifierUUID | null {
  return selected;
}

export function setSelected(uuid: ModifierUUID | null): void {
  if (selected === uuid) return;
  selected = uuid;
  selectionChanged.emit(uuid);
}

export function toggleSelected(uuid: ModifierUUID): void {
  setSelected(selected === uuid ? null : uuid);
}
