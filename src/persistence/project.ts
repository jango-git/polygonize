import { restoreDocument } from "../document/commands/image.js";
import { serializeDocument } from "../document/selectors/document.js";
import { signals } from "../document/signals.js";
import type { DocumentData, PersistedDocument } from "../document/types.js";
import type { ColorSettings, SeedSettings } from "../settings/types.js";
import { setSelected } from "../ui/selection.js";

export const PROJECT_FORMAT = "polygonize-project";
export const PROJECT_VERSION = 2;
export const DEFAULT_PROJECT_FILENAME = "polygonize.json";

export interface ProjectFile {
  format: typeof PROJECT_FORMAT;
  version: number;
  document: PersistedDocument;
}

interface LegacyProjectSettings {
  seed?: SeedSettings;
  color?: ColorSettings;
}

export function buildProject(): ProjectFile {
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    document: serializeDocument(),
  };
}

export async function loadProjectFromFile(file: File): Promise<void> {
  const parsed = JSON.parse(await file.text()) as Partial<ProjectFile> & {
    settings?: LegacyProjectSettings;
  };
  if (!parsed || parsed.format !== PROJECT_FORMAT || !parsed.document) {
    throw new Error("Not a Polygonize project file");
  }

  setSelected(null);
  await restoreDocument(toRestorableDocument(parsed.document, parsed.settings));
  signals.document.emit();
}

function toRestorableDocument(
  document: PersistedDocument,
  legacySettings?: LegacyProjectSettings,
): Partial<DocumentData> {
  if (!legacySettings) return document;
  return {
    ...document,
    seedSettings: document.seedSettings ?? legacySettings.seed,
    colorSettings: document.colorSettings ?? legacySettings.color,
  };
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
