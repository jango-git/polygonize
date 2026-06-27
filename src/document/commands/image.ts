import { resetEdgeDensity } from "../../domain/featureMap.js";
import { getPixelData, loadPixels, measureImage } from "../../domain/imageSource.js";
import { sendImageToWorker } from "../../domain/colorWorkerClient.js";
import type { ColorSettings, SeedSettings } from "../../settings/types.js";
import { signals, DeltaOperation } from "../signals.js";
import { store } from "../store.js";
import {
  DOCUMENT_VERSION,
  emptyDocument,
  newGroupUUID,
  newModifierUUID,
  type DocumentData,
  type ImageRef,
  type Modifier,
  type ModifierGroup,
  type ModifierUUID,
  type PathInterpolation,
  type StackEntry,
} from "../types.js";
import { evaluatePoints } from "./pipeline.js";
import { recomputeTriangles, resetColorGrid } from "./recompute.js";

export async function setImage(src: string): Promise<void> {
  const { width, height } = await measureImage(src);
  const image: ImageRef = { src, width, height };

  await loadPixels(image);
  resetColorGrid();
  resetEdgeDensity();
  sendImageToWorker(getPixelData().data, width, height);

  const data = store.data();
  data.image = image;
  data.stack = [];
  evaluatePoints();

  signals.image.emit({ image });
  signals.modifiers.emit();
  signals.points.emit({ op: DeltaOperation.REPLACED });
  signals.triangles.emit({ op: DeltaOperation.REPLACED });
  signals.document.emit();
}

export async function restoreDocument(doc: Partial<DocumentData>): Promise<void> {
  const legacy = !isCurrentVersion(doc);
  store.replace(normalizeDocument(doc));
  const data = store.data();
  if (data.image) {
    await loadPixels(data.image);
    resetColorGrid();
    resetEdgeDensity();
    sendImageToWorker(getPixelData().data, data.image.width, data.image.height);
    if (legacy) recomputeTriangles();
    else evaluatePoints();
  }
  signals.image.emit({ image: data.image });
  signals.modifiers.emit();
  signals.points.emit({ op: DeltaOperation.REPLACED });
  signals.triangles.emit({ op: DeltaOperation.REPLACED });
}

function isCurrentVersion(doc: Partial<DocumentData>): boolean {
  return doc.version === DOCUMENT_VERSION && typeof doc.seed === "number";
}

function normalizeDocument(doc: Partial<DocumentData>): DocumentData {
  const base = emptyDocument();
  const raw = doc;
  const legacySettings = isCurrentVersion(doc) ? null : readLegacySettings();

  return {
    version: DOCUMENT_VERSION,
    image: raw.image ?? null,
    seed: typeof raw.seed === "number" ? raw.seed >>> 0 : base.seed,
    seedSettings: { ...base.seedSettings, ...legacySettings?.seed, ...raw.seedSettings },
    colorSettings: normalizeColorSettings({
      ...base.colorSettings,
      ...legacySettings?.color,
      ...raw.colorSettings,
    }),
    stack: normalizeStack(doc),
    points: Array.isArray(raw.points) ? raw.points : [],
    constraintEdges: Array.isArray(raw.constraintEdges) ? raw.constraintEdges : [],
    triangles: Array.isArray(raw.triangles) ? raw.triangles : [],
  };
}

function normalizeColorSettings(settings: ColorSettings): ColorSettings {
  if ((settings.strategy as string) === "vertices") return { ...settings, strategy: "median" };
  return settings;
}

interface LegacySettings {
  seed?: Partial<SeedSettings>;
  color?: Partial<ColorSettings>;
}

function readLegacySettings(): LegacySettings {
  const result: LegacySettings = {};
  result.seed = readLocalStorageJson("polygonize:seed-settings");
  result.color = readLocalStorageJson("polygonize:color-settings");
  return result;
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

function normalizeStack(doc: Partial<DocumentData>): StackEntry[] {
  const raw = doc as { stack?: unknown; modifiers?: unknown };

  if (Array.isArray(raw.stack)) {
    return (raw.stack as StackEntry[])
      .map((entry): StackEntry | null => {
        if (!entry || typeof entry !== "object") return null;
        if (entry.type === "group") {
          const g = (entry.group ?? {}) as Partial<ModifierGroup>;
          return {
            type: "group",
            group: {
              uuid: g.uuid ?? newGroupUUID(),
              name: typeof g.name === "string" ? g.name : "Group",
              collapsed: Boolean(g.collapsed),
              muted: Boolean(g.muted),
            },
            children: Array.isArray(entry.children) ? normalizeModifiers(entry.children) : [],
          };
        }
        if (entry.type === "modifier") {
          const modifier = normalizeModifier(entry.modifier);
          return modifier ? { type: "modifier", modifier } : null;
        }
        return null;
      })
      .filter((e): e is StackEntry => e !== null);
  }

  if (Array.isArray(raw.modifiers)) {
    return normalizeModifiers(raw.modifiers).map((modifier) => ({
      type: "modifier" as const,
      modifier,
    }));
  }

  return [];
}

function normalizeModifiers(raw: unknown[]): Modifier[] {
  return raw.map(normalizeModifier).filter((m): m is Modifier => m !== null);
}

function normalizeModifier(raw: unknown): Modifier | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const kind = m.kind;

  if (kind === "circle") return raw as Modifier;

  if (kind === "path" || kind === "polyline" || kind === "catmullrom") {
    const interpolation: PathInterpolation =
      kind === "catmullrom" || (kind === "path" && m.interpolation === "catmullrom")
        ? "catmullrom"
        : "polyline";
    const vertices = Array.isArray(m.vertices) ? (m.vertices as { x: number; y: number }[]) : [];
    return {
      uuid: (typeof m.uuid === "string" ? m.uuid : newModifierUUID()) as ModifierUUID,
      kind: "path",
      interpolation,
      vertices,
      closed: Boolean(m.closed),
      pointCount: typeof m.pointCount === "number" ? m.pointCount : vertices.length,
    };
  }

  return null;
}
