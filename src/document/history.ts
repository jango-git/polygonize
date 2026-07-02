import type { ColorSettings, SeedSettings } from "../settings/types.js";
import { clone } from "./clone.js";
import { restoreSource } from "./commands/image.js";
import { signals } from "./signals.js";
import { store } from "./store.js";
import type { StackEntry } from "./types.js";

// In-session undo/redo over the document SOURCE only (image, seed, settings, stack).
// The architecture makes this cheap: derived geometry is recomputed from source, so a
// snapshot never needs to store points or render buffers. History is driven off
// `signals.document` (the universal "an edit committed" signal): we keep a `baseline`
// source snapshot and, on each commit, push the previous baseline onto the undo stack.
// Continuous canvas drags fire `signals.document` every frame, so they are bracketed by
// beginGesture/endGesture to collapse into a single step. Image swaps and project loads
// clear history (see commands/image.ts), so within a session the image is invariant -
// snapshots omit it (the data URL is large) and restore reattaches the live image.

const HISTORY_LIMIT = 128;

interface SourceSnapshot {
  seed: number;
  seedSettings: SeedSettings;
  colorSettings: ColorSettings;
  stack: StackEntry[];
}

function snapshot(): SourceSnapshot {
  const data = store.data();
  return clone({
    seed: data.seed,
    seedSettings: data.seedSettings,
    colorSettings: data.colorSettings,
    stack: data.stack,
  });
}

// Group `collapsed` is a view flag (the app even discards it on load), so toggling a
// folder must not create an undo step. Compare snapshots with every `collapsed`
// normalized out; `muted` and everything else stays significant.
function comparisonKey(source: SourceSnapshot): string {
  const stack = source.stack.map((entry) =>
    entry.type === "group" ? { ...entry, group: { ...entry.group, collapsed: false } } : entry,
  );
  return JSON.stringify({ ...source, stack });
}

const undoStack: SourceSnapshot[] = [];
const redoStack: SourceSnapshot[] = [];
let baseline: SourceSnapshot = snapshot();
let gestureDepth = 0;
const listeners = new Set<() => void>();

function notify(): void {
  for (const callback of listeners) callback();
}

// Push `baseline` onto the undo stack if the live source differs, then adopt the live
// source as the new baseline. A no-op when nothing changed (early-returning commands,
// or a pure folder collapse/expand).
function reconcile(): void {
  const current = snapshot();
  if (comparisonKey(current) === comparisonKey(baseline)) {
    baseline = current;
    return;
  }
  undoStack.push(baseline);
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack.length = 0;
  baseline = current;
  notify();
}

export function initHistory(): void {
  baseline = snapshot();
  signals.document.on(() => {
    if (gestureDepth > 0) return;
    reconcile();
  });
}

export function beginGesture(): void {
  gestureDepth++;
}

export function endGesture(): void {
  if (gestureDepth === 0) return;
  gestureDepth--;
  if (gestureDepth === 0) reconcile();
}

export function canUndo(): boolean {
  return undoStack.length > 0;
}

export function canRedo(): boolean {
  return redoStack.length > 0;
}

export function undo(): void {
  const target = undoStack.pop();
  if (!target) return;
  redoStack.push(baseline);
  apply(target);
}

export function redo(): void {
  const target = redoStack.pop();
  if (!target) return;
  undoStack.push(baseline);
  apply(target);
}

// Restore a snapshot. The user's current folder expansion is preserved across undo
// (collapsed is not historical), so live `collapsed` flags are overlaid onto the
// restored stack by group uuid.
function apply(target: SourceSnapshot): void {
  baseline = target;
  const collapsedByUuid = new Map<string, boolean>();
  for (const entry of store.data().stack) {
    if (entry.type === "group") collapsedByUuid.set(entry.group.uuid, entry.group.collapsed);
  }
  const stack = clone(target.stack);
  for (const entry of stack) {
    if (entry.type !== "group") continue;
    const collapsed = collapsedByUuid.get(entry.group.uuid);
    if (collapsed !== undefined) entry.group.collapsed = collapsed;
  }
  restoreSource({
    seed: target.seed,
    seedSettings: clone(target.seedSettings),
    colorSettings: clone(target.colorSettings),
    stack,
  });
  notify();
}

export function clearHistory(): void {
  undoStack.length = 0;
  redoStack.length = 0;
  baseline = snapshot();
  notify();
}

export function onHistoryChange(listener: () => void): void {
  listeners.add(listener);
}
