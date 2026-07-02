import { restoreDocument } from "../document/commands/image.js";
import type { LegacyProjectSettings } from "../document/commands/migrate.js";
import { serializeDocument } from "../document/selectors/document.js";
import { signals } from "../document/signals.js";
import { emptyDocument } from "../document/store.js";
import type { PersistedDocument } from "../document/types.js";
import { t } from "../i18n/index.js";
import { setSelected } from "../ui/selection.js";
import { downloadBlob } from "./download.js";

const PROJECT_FORMAT = "polygonize-project";
// Stamped into every exported file. Currently write-only: the document carries its own
// version that migrateDocument reads; this envelope version exists for forward-compat and
// is not consulted on load (isProjectFile validates by shape).
const PROJECT_VERSION = 2;
const DEFAULT_PROJECT_FILENAME = "polygonize.json";

interface ProjectFile {
  format: typeof PROJECT_FORMAT;
  version: number;
  document: PersistedDocument;
}

// Pre-v2 files carried seed/color settings beside the document; migrateDocument folds them
// in on load (document values still win). Modeled here so the load path is typed.
interface LegacyProjectFile extends ProjectFile {
  settings?: LegacyProjectSettings;
}

function buildProject(): ProjectFile {
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

  setSelected(undefined);
  await restoreDocument(parsed.document, parsed.settings);
  signals.document.emit();
}

function isProjectFile(value: unknown): value is LegacyProjectFile {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.format === PROJECT_FORMAT &&
    typeof candidate.document === "object" &&
    candidate.document !== null
  );
}

export async function resetProject(): Promise<void> {
  setSelected(undefined);
  await restoreDocument(emptyDocument());
  signals.document.emit();
}

export function downloadProject(filename = DEFAULT_PROJECT_FILENAME): void {
  // No indentation: the file is machine-read (a base64 image dominates its size), so
  // pretty-printing only inflates it. Format is unchanged, so old importers still read it.
  const json = JSON.stringify(buildProject());
  downloadBlob(new Blob([json], { type: "application/json" }), filename);
}
