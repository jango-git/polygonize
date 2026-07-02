import type { Modifier, StackEntry } from "./types.js";

// Pure read helpers over the modifier stack (StackEntry[]). No store access and no side
// effects - they operate on whatever array is passed in. Structural mutations that touch
// the live store live in commands/stackTree.ts.

/**
 * Reserved name for the managed group produced by image tracing. Identified by name:
 * users cannot create or rename a group to it, and each trace overwrites this group's
 * contents (it can still be deleted manually).
 */
export const TRACED_GROUP_NAME = "Traced contours";

export function entryUUID(entry: StackEntry): string {
  return entry.type === "modifier" ? entry.modifier.uuid : entry.group.uuid;
}

export function collectModifiers(stack: StackEntry[]): Modifier[] {
  const out: Modifier[] = [];
  for (const entry of stack) {
    if (entry.type === "modifier") out.push(entry.modifier);
    else out.push(...entry.children);
  }
  return out;
}

// Modifiers that participate in the pipeline: loose ones plus the children of
// non-muted groups. Muted groups are skipped, matching evaluatePoints (they
// contribute no points), so callers that mirror what is on screen exclude them.
export function collectActiveModifiers(stack: StackEntry[]): Modifier[] {
  const out: Modifier[] = [];
  for (const entry of stack) {
    if (entry.type === "modifier") out.push(entry.modifier);
    else if (!entry.group.muted) out.push(...entry.children);
  }
  return out;
}
