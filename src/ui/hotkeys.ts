import { redo, undo } from "../document/history.js";
import type { Preview } from "../preview/preview.js";
import { getViewSettings, updateViewSettings } from "../settings/store.js";
import type { ToolController } from "./tools.js";

interface HotkeyContext {
  tools: ToolController;
  preview: Preview;
}

export function attachHotkeys(tools: ToolController, preview: Preview): void {
  window.addEventListener("keydown", (e) => {
    // Let native undo/redo and text editing win inside form fields.
    if (isTypingTarget(e.target)) return;
    // Editing keys (Escape / Space / Delete) drive the tool controller directly; they are
    // modifier-agnostic, so they run before the undo/redo and tool-shortcut branches.
    if (handleEditingKeys(e, tools)) return;
    if (e.ctrlKey || e.metaKey) {
      handleUndoRedo(e);
      return;
    }
    if (e.altKey) return;
    const action = resolveAction(e);
    if (!action) return;
    action({ tools, preview });
    e.preventDefault();
  });
}

// Escape / Space / Delete / Backspace map to ToolController commands. Returns true when the
// key is one of these, so the caller stops processing it as a tool/view shortcut.
function handleEditingKeys(e: KeyboardEvent, tools: ToolController): boolean {
  if (e.key === "Escape") {
    if (tools.cancelActive()) e.preventDefault();
    return true;
  }
  if (e.key === "Delete" || e.key === "Backspace") {
    if (tools.deleteSelectedPoint()) e.preventDefault();
    return true;
  }
  if (e.code === "Space") {
    if (tools.commitDraft()) e.preventDefault();
    return true;
  }
  return false;
}

// Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y = redo. Other modifier combos
// fall through to the browser.
function handleUndoRedo(e: KeyboardEvent): void {
  if (e.altKey) return;
  if (e.code === "KeyZ") {
    if (e.shiftKey) redo();
    else undo();
    e.preventDefault();
  } else if (e.code === "KeyY" && !e.shiftKey) {
    redo();
    e.preventDefault();
  }
}

type Action = (ctx: HotkeyContext) => void;

function resolveAction(e: KeyboardEvent): Action | undefined {
  switch (e.code) {
    case "Backquote":
      return ({ tools }) => tools.activateCursor();
    case "Digit1":
    case "Numpad1":
      return ({ tools }) => tools.toggle("polyline");
    case "Digit2":
    case "Numpad2":
      return ({ tools }) => tools.toggle("catmullrom");
    case "Digit3":
    case "Numpad3":
      return ({ tools }) => tools.toggle("bezier");
    case "Digit4":
    case "Numpad4":
      return ({ tools }) => tools.toggle("circle");
    case "Digit5":
    case "Numpad5":
      return ({ tools }) => tools.toggle("circle3");
    case "KeyQ":
      return () => flip("overlayOpacity");
    case "KeyW":
      return () => flip("pointsOpacity");
    case "KeyE":
      return () => flip("spikeOpacity");
    case "KeyF":
      return ({ preview }) => preview.resetView();
  }
  return undefined;
}

function flip(key: "overlayOpacity" | "pointsOpacity" | "spikeOpacity"): void {
  const current = getViewSettings()[key];
  updateViewSettings({ [key]: Math.round((1 - current) * 100) / 100 });
}

const TEXT_INPUT_TYPES = new Set(["text", "search", "email", "number", "password", "url", "tel"]);

function isTypingTarget(target: EventTarget | null): boolean {
  const el = (target as HTMLElement | null) ?? undefined;
  if (!el) return false;
  if (el.isContentEditable || el.tagName === "TEXTAREA") return true;
  if (el.tagName === "INPUT") return TEXT_INPUT_TYPES.has((el as HTMLInputElement).type);
  return false;
}
