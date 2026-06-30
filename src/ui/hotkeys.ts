import { redo, undo } from "../document/history.js";
import { t, type TKey } from "../i18n/index.js";
import type { Preview } from "../preview/preview.js";
import { getViewSettings, updateViewSettings } from "../settings/store.js";
import type { ToolController } from "./tools.js";

interface HotkeyHint {
  key: string;
  desc: TKey;
}

const HINTS: HotkeyHint[] = [
  { key: "~", desc: "hotkeys.cursor" },
  { key: "1", desc: "hotkeys.polyline" },
  { key: "2", desc: "hotkeys.catmullrom" },
  { key: "3", desc: "hotkeys.bezier" },
  { key: "4", desc: "hotkeys.circle" },
  { key: "5", desc: "hotkeys.circle3" },
  { key: "Q", desc: "hotkeys.flipBackground" },
  { key: "W", desc: "hotkeys.flipPoints" },
  { key: "E", desc: "hotkeys.flipSpikes" },
  { key: "F", desc: "hotkeys.fitImage" },
  { key: "Spc", desc: "hotkeys.applyPath" },
  { key: "Esc", desc: "hotkeys.cancel" },
];

interface HotkeyContext {
  tools: ToolController;
  preview: Preview;
}

export function attachHotkeys(tools: ToolController, preview: Preview): void {
  window.addEventListener("keydown", (e) => {
    // Let native undo/redo and text editing win inside form fields.
    if (isTypingTarget(e.target)) return;
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

function resolveAction(e: KeyboardEvent): Action | null {
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
  return null;
}

function flip(key: "overlayOpacity" | "pointsOpacity" | "spikeOpacity"): void {
  const current = getViewSettings()[key];
  updateViewSettings({ [key]: Math.round((1 - current) * 100) / 100 });
}

const TEXT_INPUT_TYPES = new Set(["text", "search", "email", "number", "password", "url", "tel"]);

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable || el.tagName === "TEXTAREA") return true;
  if (el.tagName === "INPUT") return TEXT_INPUT_TYPES.has((el as HTMLInputElement).type);
  return false;
}

export function mountHotkeyHelp(container: HTMLElement): void {
  const box = document.createElement("div");
  box.className = "hotkey-help";

  const title = document.createElement("div");
  title.className = "hk-title";
  title.textContent = t("hotkeys.title");
  box.appendChild(title);

  for (const hint of HINTS) {
    const row = document.createElement("div");
    row.className = "hk-row";
    const kbd = document.createElement("kbd");
    kbd.textContent = hint.key;
    const desc = document.createElement("span");
    desc.textContent = t(hint.desc);
    row.append(kbd, desc);
    box.appendChild(row);
  }

  container.appendChild(box);
}
