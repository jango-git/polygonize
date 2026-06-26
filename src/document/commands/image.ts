import { computeEdgeDensity } from "../../domain/featureMap.js";
import { loadPixels, measureImage } from "../../domain/imageSource.js";
import { generateSeedPoints } from "../../domain/seeding.js";
import { getSeedSettings } from "../../settings/store.js";
import { signals, DeltaOperation } from "../signals.js";
import { store } from "../store.js";
import {
  emptyDocument,
  newGroupUUID,
  type DocumentData,
  type ImageRef,
  type Modifier,
  type ModifierGroup,
  type StackEntry,
} from "../types.js";
import { evaluatePoints } from "./pipeline.js";
import { recomputeTriangles } from "./recompute.js";

export async function setImage(src: string): Promise<void> {
  const { width, height } = await measureImage(src);
  const image: ImageRef = { src, width, height };

  await loadPixels(image);

  const data = store.data();
  data.image = image;
  data.seedPoints = generateSeedPoints(width, height, getSeedSettings(), computeEdgeDensity());
  data.stack = [];
  evaluatePoints();

  signals.image.emit({ image });
  signals.modifiers.emit();
  signals.points.emit({ op: DeltaOperation.REPLACED });
  signals.triangles.emit({ op: DeltaOperation.REPLACED });
  signals.document.emit();
}

export function regenerateSeed(): void {
  const data = store.data();
  if (!data.image) return;

  const { width, height } = data.image;
  data.seedPoints = generateSeedPoints(width, height, getSeedSettings(), computeEdgeDensity());
  evaluatePoints();

  signals.points.emit({ op: DeltaOperation.REPLACED });
  signals.triangles.emit({ op: DeltaOperation.REPLACED });
  signals.document.emit();
}

export function regenerateColors(): void {
  const data = store.data();
  if (!data.image) return;

  recomputeTriangles();

  signals.triangles.emit({ op: DeltaOperation.REPLACED });
  signals.document.emit();
}

export async function restoreDocument(doc: DocumentData): Promise<void> {
  store.replace({ ...emptyDocument(), ...doc, stack: normalizeStack(doc) });
  const data = store.data();
  if (data.image) {
    await loadPixels(data.image);
    recomputeTriangles();
  }
  signals.image.emit({ image: data.image });
  signals.modifiers.emit();
  signals.points.emit({ op: DeltaOperation.REPLACED });
  signals.triangles.emit({ op: DeltaOperation.REPLACED });
}

function normalizeStack(doc: DocumentData): StackEntry[] {
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
            children: Array.isArray(entry.children) ? entry.children : [],
          };
        }
        if (entry.type === "modifier" && entry.modifier) {
          return { type: "modifier", modifier: entry.modifier };
        }
        return null;
      })
      .filter((e): e is StackEntry => e !== null);
  }

  if (Array.isArray(raw.modifiers)) {
    return (raw.modifiers as Modifier[]).map((modifier) => ({
      type: "modifier" as const,
      modifier,
    }));
  }

  return [];
}
