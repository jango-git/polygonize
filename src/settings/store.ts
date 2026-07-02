import { Ferrsign1 } from "ferrsign";
import { t } from "../i18n/index.js";
import { readJson, writeJson } from "../persistence/localStore.js";
import { notify } from "../ui/noticeStack.js";
import {
  DEFAULT_TOOL_SETTINGS,
  DEFAULT_TRACE_SETTINGS,
  DEFAULT_VIEW_SETTINGS,
  type ToolSettings,
  type TraceSettings,
  type ViewSettings,
} from "./types.js";

interface SettingsStore<T> {
  get(): T;
  update(patch: Partial<T>): T;
  changed: Ferrsign1<T>;
}

// localStorage keys are part of the on-disk format: keep them stable so existing
// user settings load unchanged.
function createSettingsStore<T extends object>(key: string, defaults: T): SettingsStore<T> {
  let value = load(key, defaults);
  const changed = new Ferrsign1<T>();
  return {
    get: () => ({ ...value }),
    update(patch) {
      value = { ...value, ...patch };
      persist(key, value);
      const snapshot = { ...value };
      changed.emit(snapshot);
      return { ...snapshot };
    },
    changed,
  };
}

const viewStore = createSettingsStore("polygonize:view-settings", DEFAULT_VIEW_SETTINGS);
const toolStore = createSettingsStore("polygonize:tool-settings", DEFAULT_TOOL_SETTINGS);
const traceStore = createSettingsStore("polygonize:trace-settings", DEFAULT_TRACE_SETTINGS);

export const viewSettingsChanged = viewStore.changed;
export const toolSettingsChanged = toolStore.changed;
export const traceSettingsChanged = traceStore.changed;

export function getViewSettings(): ViewSettings {
  return viewStore.get();
}

export function updateViewSettings(patch: Partial<ViewSettings>): ViewSettings {
  return viewStore.update(patch);
}

export function getToolSettings(): ToolSettings {
  return toolStore.get();
}

export function updateToolSettings(patch: Partial<ToolSettings>): ToolSettings {
  return toolStore.update(patch);
}

export function getTraceSettings(): TraceSettings {
  return traceStore.get();
}

export function updateTraceSettings(patch: Partial<TraceSettings>): TraceSettings {
  return traceStore.update(patch);
}

function load<T>(key: string, fallback: T): T {
  const stored = readJson<Partial<T>>(key);
  return stored ? { ...fallback, ...stored } : { ...fallback };
}

function persist(key: string, value: unknown): void {
  if (!writeJson(key, value)) notify(t("notice.settingsSaveFailed"));
}
