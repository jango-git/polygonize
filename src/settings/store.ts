import { Ferrsign1 } from "ferrsign";
import {
  DEFAULT_TOOL_SETTINGS,
  DEFAULT_VIEW_SETTINGS,
  type ToolSettings,
  type ViewSettings,
} from "./types.js";

const VIEW_KEY = "polygonize:view-settings";
const TOOL_KEY = "polygonize:tool-settings";

let view: ViewSettings = load(VIEW_KEY, DEFAULT_VIEW_SETTINGS);
let tool: ToolSettings = load(TOOL_KEY, DEFAULT_TOOL_SETTINGS);

export const viewSettingsChanged = new Ferrsign1<ViewSettings>();
export const toolSettingsChanged = new Ferrsign1<ToolSettings>();

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
