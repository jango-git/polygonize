import type { ToolKind } from "../document/types.js";
import { t } from "../i18n/index.js";
import { activeToolChanged, type ToolController } from "./tools.js";
import { getSelected, selectionChanged } from "./selection.js";
import { attachTooltip } from "./tooltip.js";

const CURSOR_ICON = `<svg class="tool-icon" viewBox="0 0 24 24" width="24" height="24"
  fill="currentColor" aria-hidden="true">
  <path d="M5 5 L13 18 L13 13 L18 13 Z"/></svg>`;

const ICONS: Record<ToolKind, string> = {
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

function iconSvg(kind: ToolKind): string {
  return `<svg class="tool-icon" viewBox="0 0 24 24" width="24" height="24" fill="none"
    stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">${ICONS[kind]}</svg>`;
}

export function mountModifierPalette(container: HTMLElement, tools: ToolController): void {
  container.innerHTML = "";
  const buttons = new Map<ToolKind, HTMLButtonElement>();
  let activeKind: ToolKind | null = null;

  const cursorBtn = document.createElement("button");
  cursorBtn.className = "modifier-tool";
  cursorBtn.innerHTML = CURSOR_ICON;
  attachTooltip(cursorBtn, t("tools.cursor.label"), t("tools.cursor.tip"));
  cursorBtn.addEventListener("click", () => tools.activateCursor());
  container.appendChild(cursorBtn);

  const divider = document.createElement("div");
  divider.className = "tool-divider";
  container.appendChild(divider);

  const add = (kind: ToolKind, title: string, description: string): void => {
    const btn = document.createElement("button");
    btn.className = "modifier-tool";
    attachTooltip(btn, title, description);
    btn.innerHTML = iconSvg(kind);
    btn.addEventListener("click", () => tools.toggle(kind));
    buttons.set(kind, btn);
    container.appendChild(btn);
  };

  add("polyline", t("tools.polyline.label"), t("tools.polyline.tip"));
  add("circle", t("tools.circle.label"), t("tools.circle.tip"));
  add("catmullrom", t("tools.catmullrom.label"), t("tools.catmullrom.tip"));

  const updateActive = (): void => {
    cursorBtn.classList.toggle("active", activeKind === null && getSelected() === null);
    buttons.forEach((btn, kind) => btn.classList.toggle("active", kind === activeKind));
  };

  activeToolChanged.on((active) => {
    activeKind = active;
    updateActive();
  });
  selectionChanged.on(updateActive);
  updateActive();
}
