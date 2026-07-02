import type { ColorSettings } from "../../settings/types.js";
import { newGroupUUID, newModifierUUID } from "../ids.js";
import { emptyDocument } from "../store.js";
import {
  DOCUMENT_VERSION,
  type BezierAnchor,
  type DocumentData,
  type Modifier,
  type ModifierGroup,
  type ModifierUUID,
  type PathInterpolation,
  type StackEntry,
} from "../types.js";
import type { LoadedDocument } from "./migrate.js";

// Final defaulting + sanitizing layer, run on every load after migrateDocument. Version
// deltas are the migrator's job; this fills gaps with defaults and coerces untrusted input
// (seed to uint32, arrays guarded, stack rebuilt, the removed "vertices" color strategy
// mapped to "median"). Defensive coercions stay here, not in version-gated steps, so a
// mislabeled or hand-edited file is still repaired.
export function normalizeDocument(doc: LoadedDocument): DocumentData {
  const base = emptyDocument();
  const raw = doc;

  return {
    version: DOCUMENT_VERSION,
    image: raw.image ?? null,
    seed: typeof raw.seed === "number" ? raw.seed >>> 0 : base.seed,
    seedSettings: { ...base.seedSettings, ...raw.seedSettings },
    colorSettings: normalizeColorSettings({ ...base.colorSettings, ...raw.colorSettings }),
    stack: normalizeStack(doc),
    points: Array.isArray(raw.points) ? raw.points : [],
    renderPositions: base.renderPositions,
    renderColors: base.renderColors,
    triangleCount: base.triangleCount,
  };
}

function normalizeColorSettings(settings: ColorSettings): ColorSettings {
  if ((settings.strategy as string) === "vertices") return { ...settings, strategy: "median" };
  return settings;
}

function normalizeStack(doc: LoadedDocument): StackEntry[] {
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
