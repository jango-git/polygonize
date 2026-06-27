import { setImage } from "../document/commands/image.js";
import { fileToDataURL } from "../domain/imageSource.js";
import {
  availableLocales,
  getLocale,
  localeBadge,
  LOCALE_NAMES,
  setLocale,
  t,
} from "../i18n/index.js";
import {
  DEFAULT_PNG_RESOLUTION,
  PNG_RESOLUTIONS,
  type RasterFormat,
  type VectorFormat,
  downloadRaster,
  downloadVector,
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
import { createDropdown } from "./dropdown.js";
import { ICONS } from "./icons.js";
import { attachTooltip } from "./tooltip.js";

const percent = (v: number): string => `${Math.round(v * 100)}%`;
const multiplier = (v: number): string => `${v}x`;

function setButtonIcon(
  button: HTMLButtonElement,
  icon: string,
  title: string,
  description: string,
): void {
  button.innerHTML = icon;
  attachTooltip(button, title, description);
}

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
  container.appendChild(buildExportControls());
  container.appendChild(buildSep());

  container.appendChild(
    buildSlider(
      t("topbar.background.label"),
      t("topbar.background.tip"),
      ICONS.background,
      VIEW_LIMITS.overlayOpacity,
      percent,
      () => getViewSettings().overlayOpacity,
      (val) => updateViewSettings({ overlayOpacity: val }),
      viewSettingsChanged,
    ),
  );
  container.appendChild(
    buildSlider(
      t("topbar.points.label"),
      t("topbar.points.tip"),
      ICONS.points,
      VIEW_LIMITS.pointsOpacity,
      percent,
      () => getViewSettings().pointsOpacity,
      (val) => updateViewSettings({ pointsOpacity: val }),
      viewSettingsChanged,
    ),
  );
  container.appendChild(
    buildSlider(
      t("topbar.spikes.label"),
      t("topbar.spikes.tip"),
      ICONS.spikes,
      VIEW_LIMITS.spikeOpacity,
      percent,
      () => getViewSettings().spikeOpacity,
      (val) => updateViewSettings({ spikeOpacity: val }),
      viewSettingsChanged,
    ),
  );
  container.appendChild(buildSep());
  container.appendChild(
    buildSlider(
      t("topbar.curveDensity.label"),
      t("topbar.curveDensity.tip"),
      ICONS.curveDensity,
      TOOL_LIMITS.catmullDensity,
      multiplier,
      () => getToolSettings().catmullDensity,
      (val) => updateToolSettings({ catmullDensity: val }),
      toolSettingsChanged,
    ),
  );
  container.appendChild(buildSep());
  container.appendChild(buildLanguageSelect());
}

function buildLanguageSelect(): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "topbar-field topbar-lang";

  const current = getLocale();
  const dropdown = createDropdown({
    options: availableLocales().map((code) => ({
      value: code,
      label: LOCALE_NAMES[code] ?? code,
      hint: localeBadge(code),
    })),
    value: current,
    columns: 3,
    ariaLabel: t("lang.label"),
    triggerLabel: (_opt, value) => localeBadge(value),
    onSelect: (value) => setLocale(value),
  });

  wrap.appendChild(dropdown.el);
  return wrap;
}

function buildLoadButton(): HTMLElement {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";

  const loadButton = document.createElement("button");
  loadButton.className = "panel-button topbar-load";
  setButtonIcon(
    loadButton,
    ICONS.loadImage,
    t("topbar.loadImage.label"),
    t("topbar.loadImage.tip"),
  );
  loadButton.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const src = await fileToDataURL(file);
      await setImage(src);
    } catch (err) {
      console.error(err);
      alert(t("topbar.errors.loadImage"));
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
  setButtonIcon(
    openButton,
    ICONS.openProject,
    t("topbar.openProject.label"),
    t("topbar.openProject.tip"),
  );
  openButton.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      await loadProjectFromFile(file);
    } catch (err) {
      console.error(err);
      alert(t("topbar.errors.openProject"));
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
  setButtonIcon(
    saveButton,
    ICONS.saveProject,
    t("topbar.saveProject.label"),
    t("topbar.saveProject.tip"),
  );
  saveButton.addEventListener("click", () => {
    try {
      downloadProject();
    } catch (err) {
      console.error(err);
      alert(t("topbar.errors.saveProject"));
    }
  });
  return saveButton;
}

const VECTOR_FORMATS = ["svg", "pdf"] as const;
const RASTER_FORMATS = ["jpg", "png", "webp"] as const;
const EXPORT_FORMATS = [...VECTOR_FORMATS, ...RASTER_FORMATS] as const;

const isRasterFormat = (fmt: string): fmt is RasterFormat =>
  (RASTER_FORMATS as readonly string[]).includes(fmt);

function buildExportControls(): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "topbar-field";

  const button = document.createElement("button");
  button.className = "panel-button subtle topbar-load";
  setButtonIcon(button, ICONS.exportPng, t("topbar.export.label"), t("topbar.export.tip"));

  let formatValue: string = EXPORT_FORMATS[0];
  let resolutionValue: number = DEFAULT_PNG_RESOLUTION;

  const resolution = createDropdown({
    options: PNG_RESOLUTIONS.map((res) => ({ value: String(res), label: `${res}px` })),
    value: String(DEFAULT_PNG_RESOLUTION),
    ariaLabel: t("topbar.rasterResolution"),
    onSelect: (value) => {
      resolutionValue = Number(value);
    },
  });

  const syncResolution = (): void => {
    resolution.el.hidden = !isRasterFormat(formatValue);
  };

  const format = createDropdown({
    options: EXPORT_FORMATS.map((fmt) => ({ value: fmt, label: fmt.toUpperCase() })),
    value: formatValue,
    ariaLabel: t("topbar.exportFormat"),
    onSelect: (value) => {
      formatValue = value;
      syncResolution();
    },
  });

  syncResolution();

  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      if (isRasterFormat(formatValue)) {
        await downloadRaster(resolutionValue, formatValue);
      } else {
        downloadVector(formatValue as VectorFormat);
      }
    } catch (err) {
      console.error(err);
      alert(t("topbar.errors.export"));
    } finally {
      button.disabled = false;
    }
  });

  wrap.append(button, format.el, resolution.el);
  return wrap;
}

function buildSlider(
  title: string,
  description: string,
  icon: string,
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
  name.innerHTML = icon;
  attachTooltip(name, title, description);

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
