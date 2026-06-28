import { setImage } from "../document/commands/image.js";
import type { ToolKind } from "../document/types.js";
import { fileToDataURL } from "../domain/imageSource.js";
import { t } from "../i18n/index.js";
import { downloadProject, loadProjectFromFile, resetProject } from "../persistence/project.js";
import { highlightUntilImage } from "./attention.js";
import { openHelp } from "./help.js";
import { ICONS as FILE_ICONS } from "./icons.js";
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
  circle3: `<circle cx="12" cy="12" r="8"/>
    <circle cx="12" cy="4" r="1.6" fill="currentColor" stroke="none"/>
    <circle cx="5" cy="17" r="1.6" fill="currentColor" stroke="none"/>
    <circle cx="19" cy="17" r="1.6" fill="currentColor" stroke="none"/>`,
  bezier: `<path d="M4 18 C 4 9, 14 15, 14 6"/>
    <line x1="4" y1="18" x2="4" y2="13"/>
    <line x1="14" y1="6" x2="14" y2="11"/>
    <circle cx="4" cy="13" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="14" cy="11" r="1.5" fill="currentColor" stroke="none"/>
    <rect x="2.6" y="16.6" width="2.8" height="2.8" fill="currentColor" stroke="none"/>
    <rect x="12.6" y="4.6" width="2.8" height="2.8" fill="currentColor" stroke="none"/>`,
};

export function toolIconSvg(kind: ToolKind): string {
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
    btn.innerHTML = toolIconSvg(kind);
    btn.addEventListener("click", () => tools.toggle(kind));
    buttons.set(kind, btn);
    container.appendChild(btn);
  };

  add("polyline", t("tools.polyline.label"), t("tools.polyline.tip"));
  add("catmullrom", t("tools.catmullrom.label"), t("tools.catmullrom.tip"));
  add("bezier", t("tools.bezier.label"), t("tools.bezier.tip"));
  add("circle", t("tools.circle.label"), t("tools.circle.tip"));
  add("circle3", t("tools.circle3.label"), t("tools.circle3.tip"));

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

  mountFileActions(container);
}

function buildActionButton(
  icon: string,
  title: string,
  description: string,
  onClick: () => void,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "modifier-tool modifier-action";
  btn.innerHTML = icon;
  attachTooltip(btn, title, description);
  btn.addEventListener("click", onClick);
  return btn;
}

function buildFileButton(
  icon: string,
  title: string,
  description: string,
  accept: string,
  onFile: (file: File) => Promise<void>,
  errorMessage: string,
  highlightWhenEmpty = false,
): HTMLElement {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.style.display = "none";

  const btn = buildActionButton(icon, title, description, () => input.click());
  if (highlightWhenEmpty) highlightUntilImage(btn);

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      await onFile(file);
    } catch (err) {
      console.error(err);
      alert(errorMessage);
    } finally {
      input.value = "";
    }
  });

  const wrap = document.createElement("div");
  wrap.className = "modifier-action-wrap";
  wrap.append(btn, input);
  return wrap;
}

function mountFileActions(container: HTMLElement): void {
  const group = document.createElement("div");
  group.className = "modifier-file-actions";

  group.appendChild(
    buildFileButton(
      FILE_ICONS.loadImage,
      t("topbar.loadImage.label"),
      t("topbar.loadImage.tip"),
      "image/*",
      async (file) => {
        const src = await fileToDataURL(file);
        await setImage(src);
      },
      t("topbar.errors.loadImage"),
      true,
    ),
  );

  group.appendChild(
    buildFileButton(
      FILE_ICONS.openProject,
      t("topbar.openProject.label"),
      t("topbar.openProject.tip"),
      "application/json,.json",
      (file) => loadProjectFromFile(file),
      t("topbar.errors.openProject"),
    ),
  );

  group.appendChild(
    buildActionButton(
      FILE_ICONS.saveProject,
      t("topbar.saveProject.label"),
      t("topbar.saveProject.tip"),
      () => {
        try {
          downloadProject();
        } catch (err) {
          console.error(err);
          alert(t("topbar.errors.saveProject"));
        }
      },
    ),
  );

  group.appendChild(
    buildActionButton(FILE_ICONS.help, t("topbar.help.label"), t("topbar.help.tip"), openHelp),
  );

  const spacer = document.createElement("div");
  spacer.className = "modifier-action-spacer";
  group.appendChild(spacer);

  group.appendChild(buildResetButton());

  container.appendChild(group);
}

const RESET_COUNT_START = 5;
const RESET_REVERT_MS = 2000;

function buildResetButton(): HTMLElement {
  const btn = buildActionButton(
    FILE_ICONS.reset,
    t("topbar.resetProject.label"),
    t("topbar.resetProject.tip"),
    () => {},
  );
  btn.classList.add("modifier-reset");

  let count: number | null = null;
  let timer: number | undefined;

  const revert = (): void => {
    count = null;
    btn.classList.remove("counting");
    btn.innerHTML = FILE_ICONS.reset;
  };

  const performReset = async (): Promise<void> => {
    revert();
    try {
      await resetProject();
    } catch (err) {
      console.error(err);
      alert(t("topbar.errors.resetProject"));
    }
  };

  btn.addEventListener("click", () => {
    if (timer !== undefined) clearTimeout(timer);

    count = count === null ? RESET_COUNT_START : count - 1;

    if (count <= 0) {
      void performReset();
      return;
    }

    btn.classList.add("counting");
    btn.textContent = String(count);
    timer = window.setTimeout(revert, RESET_REVERT_MS);
  });

  return btn;
}
