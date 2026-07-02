import { getStack } from "../document/selectors/document.js";
import type { GroupUUID } from "../document/types.js";
import { getSelection } from "./selection.js";

// The active group is derived from the selection (the two are coupled): a
// selected group is active; a selected modifier activates its parent group; a
// root modifier or empty selection means no active group (new modifiers land in
// the root). Returns undefined if the selection no longer resolves to a live group.
export function getActiveGroup(): GroupUUID | undefined {
  const sel = getSelection();
  if (!sel) return undefined;
  const stack = getStack();
  if (sel.type === "group") {
    return stack.some((e) => e.type === "group" && e.group.uuid === sel.uuid)
      ? sel.uuid
      : undefined;
  }
  for (const entry of stack) {
    if (entry.type === "group" && entry.children.some((m) => m.uuid === sel.uuid)) {
      return entry.group.uuid;
    }
  }
  return undefined;
}
