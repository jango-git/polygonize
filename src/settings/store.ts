import { Ferrsign1 } from "ferrsign";
import {
  DEFAULT_COLOR_SETTINGS,
  DEFAULT_SEED_SETTINGS,
  DEFAULT_TOOL_SETTINGS,
  DEFAULT_VIEW_SETTINGS,
  type ColorSettings,
  type SeedSettings,
  type ToolSettings,
  type ViewSettings,
} from "./types.js";

const SEED_KEY = "polygonize:seed-settings";
const COLOR_KEY = "polygonize:color-settings";
const VIEW_KEY = "polygonize:view-settings";
const TOOL_KEY = "polygonize:tool-settings";

let seed: SeedSettings = load(SEED_KEY, DEFAULT_SEED_SETTINGS);
let color: ColorSettings = load(COLOR_KEY, DEFAULT_COLOR_SETTINGS);
let view: ViewSettings = load(VIEW_KEY, DEFAULT_VIEW_SETTINGS);
let tool: ToolSettings = load(TOOL_KEY, DEFAULT_TOOL_SETTINGS);

export const seedSettingsChanged = new Ferrsign1<SeedSettings>();
export const colorSettingsChanged = new Ferrsign1<ColorSettings>();
export const viewSettingsChanged = new Ferrsign1<ViewSettings>();
export const toolSettingsChanged = new Ferrsign1<ToolSettings>();

export function getSeedSettings(): SeedSettings {
  return { ...seed };
}

export function updateSeedSettings(patch: Partial<SeedSettings>): SeedSettings {
  seed = { ...seed, ...patch };
  persist(SEED_KEY, seed);
  seedSettingsChanged.emit({ ...seed });
  return { ...seed };
}

export function getColorSettings(): ColorSettings {
  return { ...color };
}

export function updateColorSettings(patch: Partial<ColorSettings>): ColorSettings {
  color = { ...color, ...patch };
  persist(COLOR_KEY, color);
  colorSettingsChanged.emit({ ...color });
  return { ...color };
}

export function getViewSettings(): ViewSettings {
  return { ...view };
}

export function updateViewSettings(patch: Partial<ViewSettings>): ViewSettings {
  view = { ...view, ...patch };
  persist(VIEW_KEY, view);
  viewSettingsChanged.emit({ ...view });
  return { ...view };
}

export function getToolSettings(): ToolSettings {
  return { ...tool };
}

export function updateToolSettings(patch: Partial<ToolSettings>): ToolSettings {
  tool = { ...tool, ...patch };
  persist(TOOL_KEY, tool);
  toolSettingsChanged.emit({ ...tool });
  return { ...tool };
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...fallback, ...JSON.parse(raw) };
  } catch (err) {
    console.warn("Failed to read settings", key, err);
  }
  return { ...fallback };
}

function persist<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn("Failed to save settings", key, err);
  }
}
