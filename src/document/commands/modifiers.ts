import { signals } from "../signals.js";
import { store } from "../store.js";
import {
  entryUUID,
  newGroupUUID,
  TRACED_GROUP_NAME,
  type BezierModifier,
  type CircleModifier,
  type GroupUUID,
  type Modifier,
  type ModifierUUID,
  type PathModifier,
  type StackEntry,
} from "../types.js";
import { splitModifierAtPoint } from "../../domain/modifiers/split.js";
import { evaluatePoints } from "./pipeline.js";

export function addModifier(mod: Modifier, target: GroupUUID | null = null): void {
  const group = target ? findGroup(target) : undefined;
  if (group) {
    group.children.push(mod);
    if (group.group.collapsed) group.group.collapsed = false;
  } else {
    store.data().stack.push({ type: "modifier", modifier: mod });
  }
  signals.modifiers.emit();
  evaluatePoints();
}

type ModifierPatch =
  | Partial<Omit<PathModifier, "uuid" | "kind">>
  | Partial<Omit<CircleModifier, "uuid" | "kind">>
  | Partial<Omit<BezierModifier, "uuid" | "kind">>;

export function updateModifier(uuid: ModifierUUID, patch: ModifierPatch): void {
  const mod = findModifier(uuid);
  if (!mod) return;
  Object.assign(mod, patch);
  evaluatePoints();
}

export function removeModifier(uuid: ModifierUUID): void {
  if (!detachModifier(uuid)) return;
  signals.modifiers.emit();
  evaluatePoints();
}

// Split a modifier at one of its control points into independent modifiers (a break
// at that point), replacing the original in place so the result keeps its group and
// stack position. A no-op when the point can't split it (see splitModifierAtPoint).
export function splitModifier(uuid: ModifierUUID, index: number): void {
  const stack = store.data().stack;
  let split = false;
  for (let i = 0; i < stack.length && !split; i++) {
    const entry = stack[i];
    if (entry.type === "modifier") {
      if (entry.modifier.uuid !== uuid) continue;
      const parts = splitModifierAtPoint(entry.modifier, index);
      if (parts.length === 0) return;
      stack.splice(i, 1, ...parts.map((modifier) => ({ type: "modifier" as const, modifier })));
      split = true;
    } else {
      const j = entry.children.findIndex((m) => m.uuid === uuid);
      if (j < 0) continue;
      const parts = splitModifierAtPoint(entry.children[j], index);
      if (parts.length === 0) return;
      entry.children.splice(j, 1, ...parts);
      split = true;
    }
  }
  if (!split) return;
  signals.modifiers.emit();
  evaluatePoints();
}

// Replace (or create) the reserved "Traced contours" group with a fresh set of modifiers,
// in one pipeline run. Re-tracing overwrites the same managed group instead of stacking
// duplicates; an empty result removes it. The group's position / collapsed / muted state
// is preserved across overwrites. Used by image tracing.
export function setTracedGroup(mods: Modifier[]): void {
  const stack = store.data().stack;
  const existing = stack.find(
    (e): e is Extract<StackEntry, { type: "group" }> =>
      e.type === "group" && e.group.name === TRACED_GROUP_NAME,
  );

  if (mods.length === 0) {
    if (!existing) return;
    stack.splice(stack.indexOf(existing), 1);
  } else if (existing) {
    existing.children = mods;
  } else {
    stack.push({
      type: "group",
      group: { uuid: newGroupUUID(), name: TRACED_GROUP_NAME, collapsed: true, muted: false },
      children: mods,
    });
  }

  signals.modifiers.emit();
  evaluatePoints();
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
  signals.modifiers.emit();
  signals.document.emit();
  return uuid;
}

export function renameGroup(uuid: GroupUUID, name: string): void {
  // Reserved for the managed traced-contours group: can't manually take this name.
  if (name === TRACED_GROUP_NAME) return;
  const group = findGroup(uuid);
  if (!group) return;
  group.group.name = name;
  signals.modifiers.emit();
  // The group color is derived from its name, so renaming must recompute the
  // modifier-point tint (the panel spine and path overlays already refresh on
  // `modifiers`). evaluatePoints emits the document signal when it completes.
  evaluatePoints();
}

export function setGroupCollapsed(uuid: GroupUUID, collapsed: boolean): void {
  const group = findGroup(uuid);
  if (!group) return;
  group.group.collapsed = collapsed;
  signals.modifiers.emit();
  signals.document.emit();
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
  signals.modifiers.emit();
  signals.document.emit();
}

export function setGroupMuted(uuid: GroupUUID, muted: boolean): void {
  const group = findGroup(uuid);
  if (!group) return;
  group.group.muted = muted;
  signals.modifiers.emit();
  evaluatePoints();
}

// Ungroup: remove the group container but keep its modifiers, spliced back in as loose
// top-level entries at the group's position.
export function removeGroup(uuid: GroupUUID): void {
  const stack = store.data().stack;
  const i = stack.findIndex((e) => e.type === "group" && e.group.uuid === uuid);
  if (i < 0) return;
  const entry = stack[i];
  if (entry.type !== "group") return;
  const loose: StackEntry[] = entry.children.map((modifier) => ({
    type: "modifier",
    modifier,
  }));
  stack.splice(i, 1, ...loose);
  signals.modifiers.emit();
  evaluatePoints();
}

// Delete a group together with every modifier inside it.
export function removeGroupDeep(uuid: GroupUUID): void {
  const stack = store.data().stack;
  const i = stack.findIndex((e) => e.type === "group" && e.group.uuid === uuid);
  if (i < 0) return;
  stack.splice(i, 1);
  signals.modifiers.emit();
  evaluatePoints();
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
  signals.modifiers.emit();
  evaluatePoints();
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
  signals.modifiers.emit();
  evaluatePoints();
}

function orderSignature(stack: StackEntry[]): string {
  const parts: string[] = [];
  for (const entry of stack) {
    parts.push(entryUUID(entry));
    if (entry.type === "group") {
      for (const mod of entry.children) parts.push(mod.uuid);
    }
  }
  return parts.join("|");
}

// Delete everything: all groups (with their modifiers) and all loose modifiers.
export function clearStack(): void {
  const stack = store.data().stack;
  if (stack.length === 0) return;
  stack.length = 0;
  signals.modifiers.emit();
  evaluatePoints();
}

// Delete only loose (top-level, ungrouped) modifiers; groups and their contents stay.
export function clearLooseModifiers(): void {
  const stack = store.data().stack;
  const kept = stack.filter((e) => e.type !== "modifier");
  if (kept.length === stack.length) return;
  stack.length = 0;
  stack.push(...kept);
  signals.modifiers.emit();
  evaluatePoints();
}

export function moveModifier(
  uuid: ModifierUUID,
  container: GroupUUID | null,
  beforeUUID: string | null,
): void {
  const data = store.data();
  const mod = detachModifier(uuid);
  if (!mod) return;

  if (container === null) {
    insertEntry(data.stack, { type: "modifier", modifier: mod }, beforeUUID);
  } else {
    const group = findGroup(container);
    if (group) insertChild(group.children, mod, beforeUUID);
    else data.stack.push({ type: "modifier", modifier: mod });
  }

  signals.modifiers.emit();
  evaluatePoints();
}

export function moveGroup(uuid: GroupUUID, beforeUUID: string | null): void {
  const stack = store.data().stack;
  const i = stack.findIndex((e) => e.type === "group" && e.group.uuid === uuid);
  if (i < 0) return;
  const [entry] = stack.splice(i, 1);
  insertEntry(stack, entry, beforeUUID);
  signals.modifiers.emit();
  evaluatePoints();
}

function findModifier(uuid: ModifierUUID): Modifier | undefined {
  for (const entry of store.data().stack) {
    if (entry.type === "modifier") {
      if (entry.modifier.uuid === uuid) return entry.modifier;
    } else {
      const found = entry.children.find((m) => m.uuid === uuid);
      if (found) return found;
    }
  }
  return undefined;
}

function findGroup(uuid: GroupUUID): Extract<StackEntry, { type: "group" }> | undefined {
  for (const entry of store.data().stack) {
    if (entry.type === "group" && entry.group.uuid === uuid) return entry;
  }
  return undefined;
}

function detachModifier(uuid: ModifierUUID): Modifier | null {
  const stack = store.data().stack;
  for (let i = 0; i < stack.length; i++) {
    const entry = stack[i];
    if (entry.type === "modifier") {
      if (entry.modifier.uuid === uuid) {
        stack.splice(i, 1);
        return entry.modifier;
      }
    } else {
      const j = entry.children.findIndex((m) => m.uuid === uuid);
      if (j >= 0) {
        const [mod] = entry.children.splice(j, 1);
        return mod;
      }
    }
  }
  return null;
}

function insertEntry(list: StackEntry[], entry: StackEntry, beforeUUID: string | null): void {
  if (beforeUUID === null) {
    list.push(entry);
    return;
  }
  const idx = list.findIndex((e) => entryUUID(e) === beforeUUID);
  if (idx < 0) list.push(entry);
  else list.splice(idx, 0, entry);
}

function insertChild(children: Modifier[], mod: Modifier, beforeUUID: string | null): void {
  if (beforeUUID === null) {
    children.push(mod);
    return;
  }
  const idx = children.findIndex((m) => m.uuid === beforeUUID);
  if (idx < 0) children.push(mod);
  else children.splice(idx, 0, mod);
}
