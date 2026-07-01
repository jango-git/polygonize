import { t } from "../../i18n/index.js";
import type { ColorSettings, SeedSettings } from "../../settings/types.js";
import { notify } from "../../ui/noticeStack.js";
import { DOCUMENT_VERSION, type DocumentData } from "../types.js";

/** Seed/color settings that legacy (pre-v2) project files stored beside the document. */
export interface LegacyProjectSettings {
  seed?: SeedSettings;
  color?: ColorSettings;
}

// A persisted document part-way through migration: shaped like the current document but
// still loosely typed (settings may be partial), because normalizeDocument (image.ts) has
// not yet applied defaults/validation. Migration only moves a document forward across
// schema versions; normalization always runs after it.
export type LoadedDocument = Partial<Omit<DocumentData, "seedSettings" | "colorSettings">> & {
  seedSettings?: Partial<SeedSettings>;
  colorSettings?: Partial<ColorSettings>;
};

type MigrationStep = (doc: LoadedDocument, fileSettings?: LegacyProjectSettings) => LoadedDocument;

// Upgrade ladder, keyed by the version each step upgrades FROM. When the schema next
// changes, bump DOCUMENT_VERSION and add `2: upgradeV2toV3` here; migrateDocument walks
// these in order until the document reaches the current version. The ladder must always
// start from the oldest shape so every historical save keeps loading - that backward
// compatibility is the whole reason this module exists.
const MIGRATIONS: Record<number, MigrationStep> = {
  1: upgradeV1toV2,
};

// Single entry point every load passes through (autoload from IndexedDB, project-file
// import) before normalizeDocument. Structural/version deltas live here; field-level
// defaulting and sanitizing stay in normalizeDocument, which runs on the result.
export function migrateDocument(
  raw: Partial<DocumentData>,
  fileSettings?: LegacyProjectSettings,
): LoadedDocument {
  // A pre-v2 save has no version stamp; treat a missing/invalid one as the oldest schema.
  let version = typeof raw.version === "number" ? raw.version : 1;

  if (version > DOCUMENT_VERSION) {
    // Newer than this build understands: load best-effort (normalizeDocument sanitizes),
    // but warn that fields we do not recognize may be dropped when it is next saved.
    notify(t("notice.projectNewerVersion"));
    return raw;
  }

  let doc: LoadedDocument = raw;
  while (version < DOCUMENT_VERSION) {
    const step = MIGRATIONS[version];
    // No path from this version: leave the rest to normalizeDocument's defaults rather
    // than looping forever. Should not happen while the ladder stays contiguous.
    if (!step) break;
    doc = step(doc, fileSettings);
    version += 1;
  }
  return doc;
}

// v1 -> v2: v1 kept seed/color settings outside the document - in localStorage on this
// device, or in a sibling `settings` block in old project files. Fold both into the
// document's own settings fields. Precedence: document value > file settings > this
// device's localStorage legacy (normalizeDocument then fills any remaining gaps).
function upgradeV1toV2(doc: LoadedDocument, fileSettings?: LegacyProjectSettings): LoadedDocument {
  const legacy = readLegacyLocalSettings();
  return {
    ...doc,
    version: 2,
    seedSettings: { ...legacy.seed, ...fileSettings?.seed, ...doc.seedSettings },
    colorSettings: { ...legacy.color, ...fileSettings?.color, ...doc.colorSettings },
  };
}

interface LegacyLocalSettings {
  seed?: Partial<SeedSettings>;
  color?: Partial<ColorSettings>;
}

function readLegacyLocalSettings(): LegacyLocalSettings {
  return {
    seed: readLocalStorageJson<Partial<SeedSettings>>("polygonize:seed-settings"),
    color: readLocalStorageJson<Partial<ColorSettings>>("polygonize:color-settings"),
  };
}

function readLocalStorageJson<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch (err) {
    console.warn("Failed to read legacy settings", key, err);
  }
  return undefined;
}
