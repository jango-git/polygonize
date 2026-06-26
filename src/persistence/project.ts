import { restoreDocument } from "../document/commands/image.js";
import { getDocument } from "../document/selectors/document.js";
import { signals } from "../document/signals.js";
import type { DocumentData } from "../document/types.js";
import {
  getColorSettings,
  getSeedSettings,
  getToolSettings,
  updateColorSettings,
  updateSeedSettings,
  updateToolSettings,
} from "../settings/store.js";
import type { ColorSettings, SeedSettings, ToolSettings } from "../settings/types.js";
import { setSelected } from "../ui/selection.js";

export const PROJECT_FORMAT = "polygonize-project";
export const PROJECT_VERSION = 1;
export const DEFAULT_PROJECT_FILENAME = "polygonize.json";

export interface ProjectFile {
  format: typeof PROJECT_FORMAT;
  version: number;
  document: DocumentData;
  settings: {
    seed: SeedSettings;
    color: ColorSettings;
    tool: ToolSettings;
  };
}

export function buildProject(): ProjectFile {
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    document: getDocument(),
    settings: {
      seed: getSeedSettings(),
      color: getColorSettings(),
      tool: getToolSettings(),
    },
  };
}

export async function loadProjectFromFile(file: File): Promise<void> {
  const parsed = JSON.parse(await file.text()) as Partial<ProjectFile>;
  if (!parsed || parsed.format !== PROJECT_FORMAT || !parsed.document) {
    throw new Error("Not a Polygonize project file");
  }

  const settings = parsed.settings;
  if (settings?.seed) updateSeedSettings(settings.seed);
  if (settings?.color) updateColorSettings(settings.color);
  if (settings?.tool) updateToolSettings(settings.tool);

  setSelected(null);
  await restoreDocument(parsed.document);
  signals.document.emit();
}

export function downloadProject(filename = DEFAULT_PROJECT_FILENAME): void {
  const json = JSON.stringify(buildProject(), null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
