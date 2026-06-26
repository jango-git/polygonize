import { setImage } from "../document/commands/image.js";
import { fileToDataURL } from "../domain/imageSource.js";
import {
  DEFAULT_PNG_RESOLUTION,
  PNG_RESOLUTIONS,
  downloadPng,
  downloadSvg,
} from "../persistence/export.js";
import { downloadProject, loadProjectFromFile } from "../persistence/project.js";
import {
  getToolSettings,
  getViewSettings,
  toolSettingsChanged,
  updateToolSettings,
  updateViewSettings,
  viewSettingsChanged,
} from "../settings/store.js";
import { TOOL_LIMITS, VIEW_LIMITS } from "../settings/types.js";

const percent = (v: number): string => `${Math.round(v * 100)}%`;
const multiplier = (v: number): string => `${v}x`;

function buildSep(): HTMLElement {
  const sep = document.createElement("div");
  sep.className = "topbar-sep";
  return sep;
}

export function mountTopbar(container: HTMLElement): void {
  container.innerHTML = "";
  container.appendChild(buildLoadButton());
  container.appendChild(buildOpenButton());
  container.appendChild(buildSaveButton());
  container.appendChild(buildSep());
  container.appendChild(buildExportSvgButton());
  container.appendChild(buildExportPngControls());
  container.appendChild(buildSep());

  container.appendChild(
    buildSlider(
      "Background",
      VIEW_LIMITS.overlayOpacity,
      percent,
      () => getViewSettings().overlayOpacity,
      (val) => updateViewSettings({ overlayOpacity: val }),
      viewSettingsChanged,
    ),
  );
  container.appendChild(
    buildSlider(
      "Points",
      VIEW_LIMITS.pointsOpacity,
      percent,
      () => getViewSettings().pointsOpacity,
      (val) => updateViewSettings({ pointsOpacity: val }),
      viewSettingsChanged,
    ),
  );
  container.appendChild(buildSep());
  container.appendChild(
    buildSlider(
      "Curve density",
      TOOL_LIMITS.catmullDensity,
      multiplier,
      () => getToolSettings().catmullDensity,
      (val) => updateToolSettings({ catmullDensity: val }),
      toolSettingsChanged,
    ),
  );
}

function buildLoadButton(): HTMLElement {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";

  const loadButton = document.createElement("button");
  loadButton.className = "panel-button topbar-load";
  loadButton.textContent = "Load image";
  loadButton.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const src = await fileToDataURL(file);
      await setImage(src);
    } catch (err) {
      console.error(err);
      alert("Failed to load image");
    } finally {
      fileInput.value = "";
    }
  });

  const wrap = document.createElement("div");
  wrap.appendChild(loadButton);
  wrap.appendChild(fileInput);
  return wrap;
}

function buildOpenButton(): HTMLElement {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "application/json,.json";
  fileInput.style.display = "none";

  const openButton = document.createElement("button");
  openButton.className = "panel-button subtle topbar-load";
  openButton.textContent = "Open";
  openButton.title = "Open a saved polygonize.json project";
  openButton.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      await loadProjectFromFile(file);
    } catch (err) {
      console.error(err);
      alert("Failed to open the project file");
    } finally {
      fileInput.value = "";
    }
  });

  const wrap = document.createElement("div");
  wrap.appendChild(openButton);
  wrap.appendChild(fileInput);
  return wrap;
}

function buildSaveButton(): HTMLElement {
  const saveButton = document.createElement("button");
  saveButton.className = "panel-button subtle topbar-load";
  saveButton.textContent = "Save";
  saveButton.title = "Download the project as polygonize.json";
  saveButton.addEventListener("click", () => {
    try {
      downloadProject();
    } catch (err) {
      console.error(err);
      alert("Failed to save the project");
    }
  });
  return saveButton;
}

function buildExportSvgButton(): HTMLElement {
  const button = document.createElement("button");
  button.className = "panel-button subtle topbar-load";
  button.textContent = "Export SVG";
  button.title = "Download the triangulation as polygonize.svg";
  button.addEventListener("click", () => {
    try {
      downloadSvg();
    } catch (err) {
      console.error(err);
      alert("Failed to export SVG (is an image loaded?)");
    }
  });
  return button;
}

function buildExportPngControls(): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "topbar-field";

  const button = document.createElement("button");
  button.className = "panel-button subtle topbar-load";
  button.textContent = "Export PNG";
  button.title = "Download the triangulation as polygonize.png";

  const select = document.createElement("select");
  select.className = "topbar-select";
  select.title = "PNG resolution (longest side)";
  for (const res of PNG_RESOLUTIONS) {
    const option = document.createElement("option");
    option.value = String(res);
    option.textContent = `${res}px`;
    if (res === DEFAULT_PNG_RESOLUTION) option.selected = true;
    select.appendChild(option);
  }

  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await downloadPng(Number(select.value));
    } catch (err) {
      console.error(err);
      alert("Failed to export PNG (is an image loaded?)");
    } finally {
      button.disabled = false;
    }
  });

  wrap.append(button, select);
  return wrap;
}

function buildSlider(
  label: string,
  limits: { min: number; max: number; step: number },
  format: (v: number) => string,
  read: () => number,
  onInput: (v: number) => void,
  changed: { on(listener: () => void): void },
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "topbar-field";

  const name = document.createElement("span");
  name.className = "topbar-label";
  name.textContent = label;

  const input = document.createElement("input");
  input.type = "range";
  input.min = String(limits.min);
  input.max = String(limits.max);
  input.step = String(limits.step);

  const readout = document.createElement("span");
  readout.className = "topbar-value";

  const sync = (v: number): void => {
    input.value = String(v);
    readout.textContent = format(v);
  };
  sync(read());

  input.addEventListener("input", () => {
    const v = Number(input.value);
    readout.textContent = format(v);
    onInput(v);
  });
  changed.on(() => sync(read()));

  wrap.append(name, input, readout);
  return wrap;
}
