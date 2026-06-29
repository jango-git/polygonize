import { Ferrsign1 } from "ferrsign";
import type { GroupUUID, ModifierUUID } from "../document/types.js";

export type Selection =
  { type: "modifier"; uuid: ModifierUUID } | { type: "group"; uuid: GroupUUID };

let selected: Selection | null = null;

// Payload carries the modifier-view of the selection (uuid or null): canvas
// highlight/picking only care about modifiers, and a group selection reads as
// null to them. The event still fires on any selection change (incl. group),
// so panel re-renders pick up the active-group highlight.
export const selectionChanged = new Ferrsign1<ModifierUUID | null>();

// Fired when the user picks a modifier in the stack panel and the preview should
// frame it. Kept separate from selectionChanged so selecting via a canvas click
// (where the modifier is already in view) does not move the camera.
export const focusRequested = new Ferrsign1<ModifierUUID>();

function sameSelection(a: Selection | null, b: Selection | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.type === b.type && a.uuid === b.uuid;
}

function commit(next: Selection | null): void {
  if (sameSelection(selected, next)) return;
  selected = next;
  selectionChanged.emit(getSelected());
}

export function getSelection(): Selection | null {
  return selected;
}

export function getSelected(): ModifierUUID | null {
  return selected?.type === "modifier" ? selected.uuid : null;
}

export function getSelectedGroup(): GroupUUID | null {
  return selected?.type === "group" ? selected.uuid : null;
}

export function setSelected(uuid: ModifierUUID | null): void {
  commit(uuid === null ? null : { type: "modifier", uuid });
}

export function toggleSelected(uuid: ModifierUUID): void {
  commit(getSelected() === uuid ? null : { type: "modifier", uuid });
}

export function toggleGroup(uuid: GroupUUID): void {
  commit(getSelectedGroup() === uuid ? null : { type: "group", uuid });
}

export function setSelectedGroup(uuid: GroupUUID): void {
  commit({ type: "group", uuid });
}
