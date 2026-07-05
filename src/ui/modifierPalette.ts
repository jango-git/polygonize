import { setImage } from "../document/commands/image.js";
import type { ToolKind } from "../document/types.js";
import { fileToDataURL } from "../domain/imageSource.js";
import { t } from "../i18n/index.js";
import { downloadSourceImage } from "../persistence/export.js";
import { downloadProject, loadProjectFromFile, resetProject } from "../persistence/project.js";
import { highlightUntilImage } from "./attention.js";
import { attachCountdownConfirm } from "./countdownConfirm.js";
import { openHelp } from "./help.js";
import { notify } from "./noticeStack.js";
import { CURSOR_ICON, ICONS as FILE_ICONS, toolIconSvg } from "./icons/index.js";
import { activeToolChanged, type ToolController } from "./tools.js";
import { getSelected, selectionChanged } from "./selection.js";
import { attachTooltip } from "./tooltip.js";

const REPO_URL = "https://github.com/jango-git/tesselot";

function appendDivider(container: HTMLElement): void {
  const divider = document.createElement("div");
  divider.className = "tool-divider";
  container.appendChild(divider);
}

export function mountModifierPalette(container: HTMLElement, tools: ToolController): void {
  container.innerHTML = "";
  const buttons = new Map<ToolKind, HTMLButtonElement>();
  let activeKind: ToolKind | undefined;

  const cursorBtn = document.createElement("button");
  cursorBtn.className = "modifier-tool";
  cursorBtn.innerHTML = CURSOR_ICON;
  attachTooltip(cursorBtn, t("tools.cursor.label"), t("tools.cursor.tip"));
  cursorBtn.addEventListener("click", () => tools.activateCursor());
  container.appendChild(cursorBtn);

  appendDivider(container);

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
  appendDivider(container);
  add("circle", t("tools.circle.label"), t("tools.circle.tip"));
  add("circle3", t("tools.circle3.label"), t("tools.circle3.tip"));

  const updateActive = (): void => {
    cursorBtn.classList.toggle("active", activeKind === undefined && getSelected() === undefined);
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
      notify(errorMessage);
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
    buildActionButton(
      FILE_ICONS.downloadImage,
      t("topbar.downloadImage.label"),
      t("topbar.downloadImage.tip"),
      () => {
        try {
          downloadSourceImage();
        } catch (err) {
          console.error(err);
          notify(t("topbar.errors.downloadImage"));
        }
      },
    ),
  );

  appendDivider(group);

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
          notify(t("topbar.errors.saveProject"));
        }
      },
    ),
  );

  appendDivider(group);

  group.appendChild(
    buildActionButton(FILE_ICONS.help, t("topbar.help.label"), t("topbar.help.tip"), openHelp),
  );

  group.appendChild(
    buildActionButton(FILE_ICONS.repo, t("topbar.repo.label"), t("topbar.repo.tip"), () => {
      window.open(REPO_URL, "_blank", "noopener,noreferrer");
    }),
  );

  appendDivider(group);

  group.appendChild(buildResetButton());

  container.appendChild(group);
}

const RESET_COUNT_START = 4;

function buildResetButton(): HTMLElement {
  const btn = buildActionButton(
    FILE_ICONS.reset,
    t("topbar.resetProject.label"),
    t("topbar.resetProject.tip"),
    () => {},
  );
  btn.classList.add("modifier-reset");

  const performReset = async (): Promise<void> => {
    try {
      await resetProject();
    } catch (err) {
      console.error(err);
      notify(t("topbar.errors.resetProject"));
    }
  };

  attachCountdownConfirm(btn, FILE_ICONS.reset, RESET_COUNT_START, () => void performReset());
  return btn;
}
