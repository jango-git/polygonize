import { getViewSettings, updateViewSettings } from "../settings/store.js";
import type { ToolController } from "./tools.js";

interface HotkeyHint {
  key: string;
  desc: string;
}

const HINTS: HotkeyHint[] = [
  { key: "1", desc: "Polyline tool" },
  { key: "2", desc: "Circle tool" },
  { key: "3", desc: "Catmull-Rom curve tool" },
  { key: "Q", desc: "Flip background opacity" },
  { key: "W", desc: "Flip point opacity" },
];

export function attachHotkeys(tools: ToolController): void {
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTypingTarget(e.target)) return;
    const action = resolveAction(e);
    if (!action) return;
    action(tools);
    e.preventDefault();
  });
}

type Action = (tools: ToolController) => void;

function resolveAction(e: KeyboardEvent): Action | null {
  switch (e.code) {
    case "Digit1":
    case "Numpad1":
      return (t) => t.toggle("polyline");
    case "Digit2":
    case "Numpad2":
      return (t) => t.toggle("circle");
    case "Digit3":
    case "Numpad3":
      return (t) => t.toggle("catmullrom");
    case "KeyQ":
      return () => flip("overlayOpacity");
    case "KeyW":
      return () => flip("pointsOpacity");
  }
  switch (e.key.toLowerCase()) {
    case "1":
      return (t) => t.toggle("polyline");
    case "2":
      return (t) => t.toggle("circle");
    case "3":
      return (t) => t.toggle("catmullrom");
    case "q":
    case "й":
      return () => flip("overlayOpacity");
    case "w":
    case "ц":
      return () => flip("pointsOpacity");
  }
  return null;
}

function flip(key: "overlayOpacity" | "pointsOpacity"): void {
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
  title.textContent = "Shortcuts";
  box.appendChild(title);

  for (const hint of HINTS) {
    const row = document.createElement("div");
    row.className = "hk-row";
    const kbd = document.createElement("kbd");
    kbd.textContent = hint.key;
    const desc = document.createElement("span");
    desc.textContent = hint.desc;
    row.append(kbd, desc);
    box.appendChild(row);
  }

  container.appendChild(box);
}
