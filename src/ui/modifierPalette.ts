import type { ModifierKind } from "../document/types.js";
import { activeToolChanged, type ToolController } from "./tools.js";

const ICONS: Record<ModifierKind, string> = {
  polyline: `<polyline points="3,18 9,7 15,15 21,5"/>
    <circle cx="3" cy="18" r="1.6" fill="currentColor" stroke="none"/>
    <circle cx="9" cy="7" r="1.6" fill="currentColor" stroke="none"/>
    <circle cx="15" cy="15" r="1.6" fill="currentColor" stroke="none"/>
    <circle cx="21" cy="5" r="1.6" fill="currentColor" stroke="none"/>`,
  circle: `<circle cx="12" cy="12" r="8"/>
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>`,
  catmullrom: `<path d="M3 18 C 7 18, 7 6, 12 6 S 17 18, 21 6"/>
    <circle cx="3" cy="18" r="1.6" fill="currentColor" stroke="none"/>
    <circle cx="12" cy="6" r="1.6" fill="currentColor" stroke="none"/>
    <circle cx="21" cy="6" r="1.6" fill="currentColor" stroke="none"/>`,
};

function iconSvg(kind: ModifierKind): string {
  return `<svg class="tool-icon" viewBox="0 0 24 24" width="24" height="24" fill="none"
    stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">${ICONS[kind]}</svg>`;
}

export function mountModifierPalette(container: HTMLElement, tools: ToolController): void {
  container.innerHTML = "";
  const buttons = new Map<ModifierKind, HTMLButtonElement>();

  const add = (kind: ModifierKind, title: string): void => {
    const btn = document.createElement("button");
    btn.className = "modifier-tool";
    btn.title = title;
    btn.setAttribute("aria-label", title);
    btn.innerHTML = iconSvg(kind);
    btn.addEventListener("click", () => tools.toggle(kind));
    buttons.set(kind, btn);
    container.appendChild(btn);
  };

  add(
    "polyline",
    "Polyline: click to add vertices, Space or click the first vertex to finish, Esc to cancel",
  );
  add("circle", "Circle: click a point on the edge, then the center");
  add(
    "catmullrom",
    "Catmull-Rom curve: click to add control points, Space or click the first to finish, Esc to cancel",
  );

  activeToolChanged.on((active) => {
    buttons.forEach((btn, kind) => btn.classList.toggle("active", kind === active));
  });
}
