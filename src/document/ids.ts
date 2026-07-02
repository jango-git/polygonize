import type { GroupUUID, ModifierUUID } from "./types.js";

// Identity generation for document entities. The branded id types live in types.js; this
// module owns the runtime that mints them (a per-session counter plus random suffix, so
// ids stay unique within a session without a heavier uuid dependency).

let counter = 0;
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const newModifierUUID = (): ModifierUUID => uid("mod") as ModifierUUID;
export const newGroupUUID = (): GroupUUID => uid("grp") as GroupUUID;
