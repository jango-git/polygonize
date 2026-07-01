import { restoreDocument } from "../document/commands/image.js";
import type { LegacyProjectSettings } from "../document/commands/migrate.js";
import { serializeDocument } from "../document/selectors/document.js";
import { signals } from "../document/signals.js";
import { emptyDocument } from "../document/types.js";
import type { PersistedDocument } from "../document/types.js";
import { t } from "../i18n/index.js";
import { setSelected } from "../ui/selection.js";

export const PROJECT_FORMAT = "polygonize-project";
export const PROJECT_VERSION = 2;
export const DEFAULT_PROJECT_FILENAME = "polygonize.json";

export interface ProjectFile {
  format: typeof PROJECT_FORMAT;
  version: number;
  document: PersistedDocument;
}

export function buildProject(): ProjectFile {
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    document: serializeDocument(),
  };
}

export async function loadProjectFromFile(file: File): Promise<void> {
  const parsed = JSON.parse(await file.text()) as unknown;
  if (!isProjectFile(parsed)) {
    throw new Error(t("notice.projectInvalid"));
  }

  setSelected(null);
  // Legacy files carried settings beside the document; migrateDocument + normalizeDocument
  // fold them in (document values still win).
  await restoreDocument(parsed.document, parsed.settings);
  signals.document.emit();
}

function isProjectFile(
  value: unknown,
): value is ProjectFile & { settings?: LegacyProjectSettings } {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.format === PROJECT_FORMAT &&
    typeof candidate.document === "object" &&
    candidate.document !== null
  );
}

export async function resetProject(): Promise<void> {
  setSelected(null);
  await restoreDocument(emptyDocument());
  signals.document.emit();
}

export function downloadProject(filename = DEFAULT_PROJECT_FILENAME): void {
  // No indentation: the file is machine-read (a base64 image dominates its size), so
  // pretty-printing only inflates it. Format is unchanged, so old importers still read it.
  const json = JSON.stringify(buildProject());
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
