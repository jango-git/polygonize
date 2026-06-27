import { randomSeed } from "../../domain/rng.js";
import type { ColorSettings, SeedSettings } from "../../settings/types.js";
import { DeltaOperation, signals } from "../signals.js";
import { store } from "../store.js";
import { evaluatePoints } from "./pipeline.js";
import { recomputeTriangles } from "./recompute.js";

export function getSeed(): number {
  return store.data().seed;
}

export function getSeedSettings(): SeedSettings {
  return { ...store.data().seedSettings };
}

export function getColorSettings(): ColorSettings {
  return { ...store.data().colorSettings };
}

export function updateSeedSettings(patch: Partial<SeedSettings>): void {
  const data = store.data();
  data.seedSettings = { ...data.seedSettings, ...patch };
}

export function updateColorSettings(patch: Partial<ColorSettings>): void {
  const data = store.data();
  data.colorSettings = { ...data.colorSettings, ...patch };
}

export function setSeed(seed: number): void {
  store.data().seed = seed >>> 0;
  regenerateSeed();
}

export function randomizeSeed(): void {
  setSeed(randomSeed());
}

export function regenerateSeed(): void {
  if (!store.data().image) return;
  evaluatePoints();
  emitDerived();
}

export function regenerateColors(): void {
  if (!store.data().image) return;
  recomputeTriangles();
  emitDerived();
}

function emitDerived(): void {
  signals.points.emit({ op: DeltaOperation.REPLACED });
  signals.triangles.emit({ op: DeltaOperation.REPLACED });
  signals.document.emit();
}
