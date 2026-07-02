import { newGroupUUID } from "../ids.js";
import { signals } from "../signals.js";
import { TRACED_GROUP_NAME } from "../stack.js";
import { store } from "../store.js";
import { type GroupUUID, type Modifier, type StackEntry } from "../types.js";
import { commitStructural, commitViewOnly } from "./commit.js";
import { findGroup, insertEntry, orderSignature } from "./stackTree.js";

// Replace (or create) the reserved "Traced contours" group with a fresh set of modifiers,
// in one pipeline run. Re-tracing overwrites the same managed group instead of stacking
// duplicates; an empty result removes it. The group's position / collapsed / muted state
// is preserved across overwrites. Used by image tracing.
export function setTracedGroup(modifiers: Modifier[]): void {
  const stack = store.data().stack;
  const existing = stack.find(
    (entry): entry is Extract<StackEntry, { type: "group" }> =>
      entry.type === "group" && entry.group.name === TRACED_GROUP_NAME,
  );

  if (modifiers.length === 0) {
    if (!existing) return;
    stack.splice(stack.indexOf(existing), 1);
  } else if (existing) {
    existing.children = modifiers;
  } else {
    stack.push({
      type: "group",
      group: { uuid: newGroupUUID(), name: TRACED_GROUP_NAME, collapsed: true, muted: false },
      children: modifiers,
    });
  }

  commitStructural();
}

export function addGroup(name = "Group"): GroupUUID {
  // The traced-contours name is reserved for the managed group; de-reserve a manual one.
  const safe = name === TRACED_GROUP_NAME ? `${name} (copy)` : name;
  const uuid = newGroupUUID();
  store.data().stack.push({
    type: "group",
    group: { uuid, name: safe, collapsed: true, muted: false },
    children: [],
  });
  commitViewOnly();
  return uuid;
}

export function renameGroup(uuid: GroupUUID, name: string): void {
  // Reserved for the managed traced-contours group: can't manually take this name.
  if (name === TRACED_GROUP_NAME) return;
  const group = findGroup(uuid);
  if (!group) return;
  group.group.name = name;
  // The group color is derived from its name, so renaming must recompute the
  // modifier-point tint (the panel spine and path overlays already refresh on
  // `modifiers`). commitStructural re-runs the pipeline, which emits the document signal.
  commitStructural();
}

export function setGroupCollapsed(uuid: GroupUUID, collapsed: boolean): void {
  const group = findGroup(uuid);
  if (!group) return;
  group.group.collapsed = collapsed;
  commitViewOnly();
}

// Expand one group and collapse every other group in a single edit. Used when a
// folder is opened from its caret: opening a folder focuses it and tucks the rest
// away (selection/activation is handled by the caller).
export function expandGroupSolo(uuid: GroupUUID): void {
  let changed = false;
  for (const entry of store.data().stack) {
    if (entry.type !== "group") continue;
    const collapsed = entry.group.uuid !== uuid;
    if (entry.group.collapsed !== collapsed) {
      entry.group.collapsed = collapsed;
      changed = true;
    }
  }
  if (!changed) return;
  commitViewOnly();
}

// Collapse every group. A view-only edit (collapsed is normalized out of undo
// history), so it creates no undo step.
export function collapseAllGroups(): void {
  let changed = false;
  for (const entry of store.data().stack) {
    if (entry.type === "group" && !entry.group.collapsed) {
      entry.group.collapsed = true;
      changed = true;
    }
  }
  if (!changed) return;
  commitViewOnly();
  // Fired after the panel has re-rendered so its scroll-to-top lands on fresh DOM.
  signals.groupsCollapsed.emit();
}

export function setGroupMuted(uuid: GroupUUID, muted: boolean): void {
  const group = findGroup(uuid);
  if (!group) return;
  group.group.muted = muted;
  commitStructural();
}

// Mute every other group and unmute this one, isolating the group so only its
// modifiers reach the pipeline. A second click on an already-soloed group (it alone
// unmuted, all others muted) reverses it and unmutes every group again. One edit,
// one re-evaluation, like setGroupMuted.
export function soloGroup(uuid: GroupUUID): void {
  const groups = store
    .data()
    .stack.filter(
      (entry): entry is Extract<StackEntry, { type: "group" }> => entry.type === "group",
    );
  const target = groups.find((entry) => entry.group.uuid === uuid);
  if (!target) return;
  const soloed =
    !target.group.muted && groups.every((entry) => entry.group.uuid === uuid || entry.group.muted);
  let changed = false;
  for (const entry of groups) {
    const muted = soloed ? false : entry.group.uuid !== uuid;
    if (entry.group.muted !== muted) {
      entry.group.muted = muted;
      changed = true;
    }
  }
  if (!changed) return;
  commitStructural();
}

// Ungroup: remove the group container but keep its modifiers, spliced back in as loose
// top-level entries at the group's position.
export function removeGroup(uuid: GroupUUID): void {
  const stack = store.data().stack;
  const i = stack.findIndex((entry) => entry.type === "group" && entry.group.uuid === uuid);
  if (i < 0) return;
  const entry = stack[i];
  if (entry.type !== "group") return;
  const loose: StackEntry[] = entry.children.map((modifier) => ({
    type: "modifier",
    modifier,
  }));
  stack.splice(i, 1, ...loose);
  commitStructural();
}

// Delete a group together with every modifier inside it.
export function removeGroupDeep(uuid: GroupUUID): void {
  const stack = store.data().stack;
  const i = stack.findIndex((entry) => entry.type === "group" && entry.group.uuid === uuid);
  if (i < 0) return;
  stack.splice(i, 1);
  commitStructural();
}

// Pull every loose (top-level, ungrouped) modifier into the given group, preserving order.
export function absorbLooseModifiers(uuid: GroupUUID): void {
  const stack = store.data().stack;
  const group = findGroup(uuid);
  if (!group) return;
  const loose: Modifier[] = [];
  for (let i = stack.length - 1; i >= 0; i--) {
    const entry = stack[i];
    if (entry.type === "modifier") {
      loose.unshift(entry.modifier);
      stack.splice(i, 1);
    }
  }
  if (loose.length === 0) return;
  group.children.push(...loose);
  commitStructural();
}

// Sort the top-level stack entries (and each group's children) by their display
// label. The label resolver and string comparator are supplied by the caller so
// i18n and locale-aware collation (alphabets differ across locales) stay in the
// UI layer. Reordering changes evaluation order, so the pipeline is re-run.
export function sortStack(
  labelOf: (entry: StackEntry) => string,
  compare: (a: string, b: string) => number,
): void {
  const stack = store.data().stack;
  if (stack.length === 0) return;
  const before = orderSignature(stack);

  stack.sort((a, b) => compare(labelOf(a), labelOf(b)));
  for (const entry of stack) {
    if (entry.type !== "group") continue;
    entry.children.sort((a, b) =>
      compare(
        labelOf({ type: "modifier", modifier: a }),
        labelOf({ type: "modifier", modifier: b }),
      ),
    );
  }

  if (orderSignature(stack) === before) return;
  commitStructural();
}

// Delete everything: all groups (with their modifiers) and all loose modifiers.
export function clearStack(): void {
  const stack = store.data().stack;
  if (stack.length === 0) return;
  stack.length = 0;
  commitStructural();
}

// Delete only loose (top-level, ungrouped) modifiers; groups and their contents stay.
export function clearLooseModifiers(): void {
  const stack = store.data().stack;
  const kept = stack.filter((entry) => entry.type !== "modifier");
  if (kept.length === stack.length) return;
  stack.length = 0;
  stack.push(...kept);
  commitStructural();
}

export function moveGroup(uuid: GroupUUID, beforeUUID: string | null): void {
  const stack = store.data().stack;
  const i = stack.findIndex((entry) => entry.type === "group" && entry.group.uuid === uuid);
  if (i < 0) return;
  const [entry] = stack.splice(i, 1);
  insertEntry(stack, entry, beforeUUID);
  commitStructural();
}
