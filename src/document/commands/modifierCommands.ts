import { splitModifierAtPoint } from "../../domain/modifiers/split.js";
import { store } from "../store.js";
import {
  type BezierModifier,
  type CircleModifier,
  type GroupUUID,
  type Modifier,
  type ModifierUUID,
  type PathModifier,
} from "../types.js";
import { commitStructural } from "./commit.js";
import { evaluatePoints } from "./pipeline.js";
import { detachModifier, findGroup, findModifier, insertChild, insertEntry } from "./stackTree.js";

export function addModifier(mod: Modifier, target: GroupUUID | null = null): void {
  const group = target ? findGroup(target) : undefined;
  if (group) {
    group.children.push(mod);
    if (group.group.collapsed) group.group.collapsed = false;
  } else {
    store.data().stack.push({ type: "modifier", modifier: mod });
  }
  commitStructural();
}

type ModifierPatch =
  | Partial<Omit<PathModifier, "uuid" | "kind">>
  | Partial<Omit<CircleModifier, "uuid" | "kind">>
  | Partial<Omit<BezierModifier, "uuid" | "kind">>;

export function updateModifier(uuid: ModifierUUID, patch: ModifierPatch): void {
  const mod = findModifier(uuid);
  if (!mod) return;
  Object.assign(mod, patch);
  // Drag path: skip the structural (modifiers) signal to avoid panel churn every frame;
  // only the geometry needs to refresh.
  evaluatePoints();
}

export function removeModifier(uuid: ModifierUUID): void {
  if (!detachModifier(uuid)) return;
  commitStructural();
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
  commitStructural();
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

  commitStructural();
}
