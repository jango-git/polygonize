import { Ferrsign0 } from "ferrsign";
import type { ModifierUUID } from "../document/types.js";
import { getSelected, selectionChanged } from "./selection.js";

// A single selected control point inside the currently selected modifier (path
// vertex, bezier anchor, or circle handle). Kept separate from `selection.ts`,
// which tracks the modifier/group level: the canvas highlight and the tool
// controller both read this to draw and edit the point. Cleared whenever the
// selected modifier changes, so the index can never dangle on a stale modifier.

export interface ControlPointRef {
  modifier: ModifierUUID;
  index: number;
}

let selected: ControlPointRef | undefined;

export const pointSelectionChanged = new Ferrsign0();

export function getSelectedPoint(): ControlPointRef | undefined {
  return selected;
}

export function setSelectedPoint(modifier: ModifierUUID, index: number): void {
  if (selected && selected.modifier === modifier && selected.index === index) return;
  selected = { modifier, index };
  pointSelectionChanged.emit();
}

export function clearSelectedPoint(): void {
  if (!selected) return;
  selected = undefined;
  pointSelectionChanged.emit();
}

selectionChanged.on(() => {
  if (selected && selected.modifier !== getSelected()) clearSelectedPoint();
});
