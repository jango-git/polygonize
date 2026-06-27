import { DeltaOperation, signals } from "../signals.js";
import { store } from "../store.js";
import {
  entryUUID,
  newGroupUUID,
  type CircleModifier,
  type GroupUUID,
  type Modifier,
  type ModifierUUID,
  type PathModifier,
  type StackEntry,
} from "../types.js";
import { evaluatePoints } from "./pipeline.js";

export function addModifier(mod: Modifier): void {
  store.data().stack.push({ type: "modifier", modifier: mod });
  evaluatePoints();
  signals.modifiers.emit();
  emitDerived();
}

type ModifierPatch =
  Partial<Omit<PathModifier, "uuid" | "kind">> | Partial<Omit<CircleModifier, "uuid" | "kind">>;

export function updateModifier(uuid: ModifierUUID, patch: ModifierPatch): void {
  const mod = findModifier(uuid);
  if (!mod) return;
  Object.assign(mod, patch);
  evaluatePoints();
  emitDerived();
}

export function removeModifier(uuid: ModifierUUID): void {
  if (!detachModifier(uuid)) return;
  evaluatePoints();
  signals.modifiers.emit();
  emitDerived();
}

export function addGroup(name = "Group"): GroupUUID {
  const uuid = newGroupUUID();
  store.data().stack.push({
    type: "group",
    group: { uuid, name, collapsed: false, muted: false },
    children: [],
  });
  signals.modifiers.emit();
  signals.document.emit();
  return uuid;
}

export function renameGroup(uuid: GroupUUID, name: string): void {
  const group = findGroup(uuid);
  if (!group) return;
  group.group.name = name;
  signals.modifiers.emit();
  signals.document.emit();
}

export function setGroupCollapsed(uuid: GroupUUID, collapsed: boolean): void {
  const group = findGroup(uuid);
  if (!group) return;
  group.group.collapsed = collapsed;
  signals.modifiers.emit();
  signals.document.emit();
}

export function setAllGroupsCollapsed(collapsed: boolean): void {
  let changed = false;
  for (const entry of store.data().stack) {
    if (entry.type === "group" && entry.group.collapsed !== collapsed) {
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
  evaluatePoints();
  signals.modifiers.emit();
  emitDerived();
}

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
  evaluatePoints();
  signals.modifiers.emit();
  emitDerived();
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

  evaluatePoints();
  signals.modifiers.emit();
  emitDerived();
}

export function moveGroup(uuid: GroupUUID, beforeUUID: string | null): void {
  const stack = store.data().stack;
  const i = stack.findIndex((e) => e.type === "group" && e.group.uuid === uuid);
  if (i < 0) return;
  const [entry] = stack.splice(i, 1);
  insertEntry(stack, entry, beforeUUID);
  evaluatePoints();
  signals.modifiers.emit();
  emitDerived();
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

function emitDerived(): void {
  signals.points.emit({ op: DeltaOperation.REPLACED });
  signals.triangles.emit({ op: DeltaOperation.REPLACED });
  signals.document.emit();
}
