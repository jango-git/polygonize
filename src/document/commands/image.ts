import { sendImageToWorker } from "../../domain/colorWorkerClient.js";
import { getPixelData, loadPixels, measureImage } from "../../domain/imageSource.js";
import * as pipelineWorker from "../../domain/pipelineWorkerClient.js";
import type { ColorSettings, SeedSettings } from "../../settings/types.js";
import { clearHistory } from "../history.js";
import { DeltaOperation, signals } from "../signals.js";
import { store } from "../store.js";
import {
  DOCUMENT_VERSION,
  emptyDocument,
  newGroupUUID,
  newModifierUUID,
  type BezierAnchor,
  type DocumentData,
  type ImageRef,
  type Modifier,
  type ModifierGroup,
  type ModifierUUID,
  type PathInterpolation,
  type StackEntry,
} from "../types.js";
import { evaluatePoints } from "./pipeline.js";
import { resetColorGrid } from "./recompute.js";

export async function setImage(src: string): Promise<void> {
  const { width, height } = await measureImage(src);
  const image: ImageRef = { src, width, height };

  await loadPixels(image);
  resetColorGrid();
  pipelineWorker.setImage(getPixelData().data, width, height);
  sendImageToWorker(getPixelData().data, width, height);

  const data = store.data();
  data.image = image;
  data.stack = [];

  signals.image.emit({ image });
  signals.modifiers.emit();
  // Derived signals (points/triangles/document) fire when the pipeline worker returns.
  evaluatePoints();
  // A new image is a new project context; do not undo across image swaps.
  clearHistory();
}

export async function restoreDocument(doc: Partial<DocumentData>): Promise<void> {
  store.replace(normalizeDocument(doc));
  const data = store.data();
  if (data.image) {
    await loadPixels(data.image);
    resetColorGrid();
    pipelineWorker.setImage(getPixelData().data, data.image.width, data.image.height);
    sendImageToWorker(getPixelData().data, data.image.width, data.image.height);
  }
  emitRestored(data);
  // A loaded/imported document starts a fresh history baseline.
  clearHistory();
}

/** Source fields restored by the in-session undo/redo history (image is unchanged). */
export interface RestoredSource {
  seed: number;
  seedSettings: SeedSettings;
  colorSettings: ColorSettings;
  stack: StackEntry[];
}

// Restore a trusted source snapshot from undo/redo. The image is unchanged (history is
// cleared whenever it changes), so the worker pixel caches stay valid and we skip the
// costly reload/setImage. The snapshot is already current-version and validated, so it
// bypasses normalizeDocument (which would, among other things, force every group
// collapsed). Geometry is recomputed from the restored source.
export function restoreSource(source: RestoredSource): void {
  const image = store.data().image;
  store.replace({
    ...emptyDocument(),
    image,
    seed: source.seed,
    seedSettings: source.seedSettings,
    colorSettings: source.colorSettings,
    stack: source.stack,
  });
  signals.modifiers.emit();
  // Deliberately NOT emitting signals.image: the image is unchanged, and that signal
  // resets the preview camera (setImageFrame -> resetView). Geometry and points refresh
  // through the pipeline run below (signals.points / signals.triangles), which leaves the
  // camera where the user left it. evaluatePoints handles the no-image case too.
  evaluatePoints();
}

function emitRestored(data: DocumentData): void {
  signals.image.emit({ image: data.image });
  signals.modifiers.emit();
  if (data.image) {
    // Derived signals fire when the pipeline worker returns.
    evaluatePoints();
  } else {
    signals.points.emit({ op: DeltaOperation.REPLACED });
    signals.triangles.emit({ op: DeltaOperation.REPLACED });
  }
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
    renderPositions: base.renderPositions,
    renderColors: base.renderColors,
    triangleCount: base.triangleCount,
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
              // Always start collapsed; the saved collapsed state is intentionally
              // ignored on load.
              collapsed: true,
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

function normalizeAnchor(raw: unknown): BezierAnchor | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  if (typeof a.x !== "number" || typeof a.y !== "number") return null;
  return { x: a.x, y: a.y, hx: num(a.hx), hy: num(a.hy) };
}

function normalizeModifiers(raw: unknown[]): Modifier[] {
  return raw.map(normalizeModifier).filter((m): m is Modifier => m !== null);
}

function normalizeModifier(raw: unknown): Modifier | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const kind = m.kind;

  if (kind === "circle") return raw as Modifier;

  if (kind === "bezier") {
    const anchors = Array.isArray(m.anchors)
      ? (m.anchors as unknown[]).map(normalizeAnchor).filter((a): a is BezierAnchor => a !== null)
      : [];
    return {
      uuid: (typeof m.uuid === "string" ? m.uuid : newModifierUUID()) as ModifierUUID,
      kind: "bezier",
      anchors,
      closed: Boolean(m.closed),
      pointCount: typeof m.pointCount === "number" ? m.pointCount : Math.max(2, anchors.length),
    };
  }

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
