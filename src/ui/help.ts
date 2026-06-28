import { t, type TKey } from "../i18n/index.js";
import type { ToolKind } from "../document/types.js";
import { ICONS } from "./icons.js";
import { toolIconSvg } from "./modifierPalette.js";
import { attachTooltip } from "./tooltip.js";

const STEP_KEYS = ["load", "points", "emphasize", "export"] as const;
const ASIDE_KEYS = ["hotkeys", "stats", "performance"] as const;
const EMPHASIS_TOOLS: ToolKind[] = ["polyline", "catmullrom", "circle", "circle3"];

export function mountHelpButton(container: HTMLElement): void {
  const button = document.createElement("button");
  button.className = "panel-button subtle topbar-load topbar-help";
  button.innerHTML = ICONS.help;
  attachTooltip(button, t("topbar.help.label"), t("topbar.help.tip"));
  button.addEventListener("click", openHelp);
  container.appendChild(button);
}

/** A faithful copy of a real toolbar button: just the icon inside the button. */
function demoButton(svg: string, label: string, tip: string): HTMLElement {
  const btn = document.createElement("span");
  btn.className = "help-demo-btn";
  btn.innerHTML = svg;
  attachTooltip(btn, label, tip);
  return btn;
}

/** A panel control (slider) referenced by its label. */
function demoChip(label: string): HTMLElement {
  const el = document.createElement("span");
  el.className = "help-demo-chip";
  el.textContent = label;
  return el;
}

/** Visuals shown under each step: the actual buttons/controls it talks about. */
function stepVisuals(key: (typeof STEP_KEYS)[number]): HTMLElement[] {
  switch (key) {
    case "load":
      return [demoButton(ICONS.loadImage, t("topbar.loadImage.label"), t("topbar.loadImage.tip"))];
    case "points":
      return [
        demoChip(t("panel.pointGen.minRadius")),
        demoChip(t("panel.pointGen.maxRadius")),
        demoChip(t("panel.pointGen.perSide")),
      ];
    case "emphasize":
      return EMPHASIS_TOOLS.map((kind) =>
        demoButton(
          toolIconSvg(kind),
          t(`tools.${kind}.label` as TKey),
          t(`tools.${kind}.tip` as TKey),
        ),
      );
    case "export":
      return [
        demoButton(ICONS.saveProject, t("topbar.saveProject.label"), t("topbar.saveProject.tip")),
        demoButton(ICONS.exportPng, t("topbar.export.label"), t("topbar.export.tip")),
      ];
  }
}

function buildStep(key: (typeof STEP_KEYS)[number]): HTMLElement {
  const step = document.createElement("div");
  step.className = "help-step";

  const title = document.createElement("h3");
  title.className = "help-step-title";
  title.textContent = t(`help.steps.${key}.title` as TKey);

  const body = document.createElement("p");
  body.className = "help-step-body";
  body.textContent = t(`help.steps.${key}.body` as TKey);

  const visuals = document.createElement("div");
  visuals.className = "help-step-visuals";
  visuals.append(...stepVisuals(key));

  step.append(title, body, visuals);
  return step;
}

function buildNote(key: (typeof ASIDE_KEYS)[number]): HTMLElement {
  const note = document.createElement("div");
  note.className = "help-note";

  const title = document.createElement("h3");
  title.className = "help-note-title";
  title.textContent = t(`help.aside.${key}.title` as TKey);

  const body = document.createElement("p");
  body.className = "help-note-body";
  body.textContent = t(`help.aside.${key}.body` as TKey);

  note.append(title, body);
  return note;
}

export function openHelp(): void {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const dialog = document.createElement("div");
  dialog.className = "help-dialog help-dialog-wide";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");

  const close = (): void => {
    overlay.remove();
    window.removeEventListener("keydown", onKey);
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  const closeButton = document.createElement("button");
  closeButton.className = "help-close";
  closeButton.setAttribute("aria-label", t("help.close"));
  closeButton.innerHTML = "&times;";
  closeButton.addEventListener("click", close);

  const columns = document.createElement("div");
  columns.className = "help-columns";

  const main = document.createElement("div");
  main.className = "help-main";

  const title = document.createElement("h2");
  title.className = "help-title";
  title.textContent = t("help.title");

  const subtitle = document.createElement("p");
  subtitle.className = "help-subtitle";
  subtitle.textContent = t("help.subtitle");

  main.append(title, subtitle);
  for (const key of STEP_KEYS) main.appendChild(buildStep(key));

  const aside = document.createElement("aside");
  aside.className = "help-aside";

  const asideTitle = document.createElement("h2");
  asideTitle.className = "help-title";
  asideTitle.textContent = t("help.aside.title");
  aside.appendChild(asideTitle);

  for (const key of ASIDE_KEYS) aside.appendChild(buildNote(key));

  columns.append(main, aside);
  dialog.append(closeButton, columns);

  overlay.appendChild(dialog);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  window.addEventListener("keydown", onKey);

  document.body.appendChild(overlay);
}
