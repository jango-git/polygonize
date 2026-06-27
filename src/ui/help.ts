import { t } from "../i18n/index.js";
import { highlightUntilImage } from "./attention.js";
import { ICONS } from "./icons.js";
import { attachTooltip } from "./tooltip.js";

const STEP_KEYS = ["load", "points", "emphasize"] as const;

export function mountHelpButton(container: HTMLElement): void {
  const button = document.createElement("button");
  button.className = "panel-button subtle topbar-load topbar-help";
  button.innerHTML = ICONS.help;
  attachTooltip(button, t("topbar.help.label"), t("topbar.help.tip"));
  button.addEventListener("click", openHelp);
  highlightUntilImage(button);
  container.appendChild(button);
}

function openHelp(): void {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const dialog = document.createElement("div");
  dialog.className = "help-dialog";
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

  const title = document.createElement("h2");
  title.className = "help-title";
  title.textContent = t("help.title");

  const subtitle = document.createElement("p");
  subtitle.className = "help-subtitle";
  subtitle.textContent = t("help.subtitle");

  dialog.append(closeButton, title, subtitle);

  for (const key of STEP_KEYS) {
    const step = document.createElement("div");
    step.className = "help-step";

    const stepTitle = document.createElement("h3");
    stepTitle.className = "help-step-title";
    stepTitle.textContent = t(`help.steps.${key}.title`);

    const stepBody = document.createElement("p");
    stepBody.className = "help-step-body";
    stepBody.textContent = t(`help.steps.${key}.body`);

    step.append(stepTitle, stepBody);
    dialog.appendChild(step);
  }

  const footer = document.createElement("p");
  footer.className = "help-footer";
  footer.textContent = t("help.footer");
  dialog.appendChild(footer);

  overlay.appendChild(dialog);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  window.addEventListener("keydown", onKey);

  document.body.appendChild(overlay);
}
