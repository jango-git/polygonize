import { entryUUID } from "../stack.js";
import { store } from "../store.js";
import { type GroupUUID, type Modifier, type ModifierUUID, type StackEntry } from "../types.js";

// Structural walks over the modifier stack (StackEntry[]). Pure tree operations with no
// signals or pipeline side effects - the command modules own those. Shared by the
// modifier and group command layers.

export function findModifier(uuid: ModifierUUID): Modifier | undefined {
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

export function findGroup(uuid: GroupUUID): Extract<StackEntry, { type: "group" }> | undefined {
  for (const entry of store.data().stack) {
    if (entry.type === "group" && entry.group.uuid === uuid) return entry;
  }
  return undefined;
}

export function detachModifier(uuid: ModifierUUID): Modifier | null {
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

export function insertEntry(list: StackEntry[], entry: StackEntry, beforeUUID: string | null): void {
  if (beforeUUID === null) {
    list.push(entry);
    return;
  }
  const idx = list.findIndex((e) => entryUUID(e) === beforeUUID);
  if (idx < 0) list.push(entry);
  else list.splice(idx, 0, entry);
}

export function insertChild(children: Modifier[], mod: Modifier, beforeUUID: string | null): void {
  if (beforeUUID === null) {
    children.push(mod);
    return;
  }
  const idx = children.findIndex((m) => m.uuid === beforeUUID);
  if (idx < 0) children.push(mod);
  else children.splice(idx, 0, mod);
}

export function orderSignature(stack: StackEntry[]): string {
  const parts: string[] = [];
  for (const entry of stack) {
    parts.push(entryUUID(entry));
    if (entry.type === "group") {
      for (const mod of entry.children) parts.push(mod.uuid);
    }
  }
  return parts.join("|");
}
