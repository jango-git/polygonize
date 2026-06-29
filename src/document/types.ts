import {
  DEFAULT_COLOR_SETTINGS,
  DEFAULT_SEED_SETTINGS,
  type ColorSettings,
  type SeedSettings,
} from "../settings/types.js";
import { randomSeed } from "../domain/rng.js";

export type PointUUID = string & { readonly __brand: "PointUUID" };
export type ModifierUUID = string & { readonly __brand: "ModifierUUID" };
export type GroupUUID = string & { readonly __brand: "GroupUUID" };

let counter = 0;
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const newPointUUID = (): PointUUID => uid("pt") as PointUUID;
export const newModifierUUID = (): ModifierUUID => uid("mod") as ModifierUUID;
export const newGroupUUID = (): GroupUUID => uid("grp") as GroupUUID;

export interface Color {
  r: number;
  g: number;
  b: number;
}

export type PointOrigin = "border" | "modifier" | "interior";

export interface Point {
  /** Identity is only needed for modifier points (constraint-edge linking). Generated
   *  points carry none - triangle geometry lives in the flat render buffers. */
  uuid?: PointUUID;
  x: number;
  y: number;
  origin?: PointOrigin;
}

export interface ImageRef {
  src: string;
  width: number;
  height: number;
}

export type ModifierKind = "path" | "circle" | "bezier";

export type PathInterpolation = "polyline" | "catmullrom";

export type ToolKind = "polyline" | "catmullrom" | "circle" | "circle3" | "bezier";

interface ModifierBase {
  uuid: ModifierUUID;
  kind: ModifierKind;
}

export interface PathModifier extends ModifierBase {
  kind: "path";
  interpolation: PathInterpolation;
  vertices: { x: number; y: number }[];
  closed: boolean;
  pointCount: number;
}

export interface CircleModifier extends ModifierBase {
  kind: "circle";
  center: { x: number; y: number };
  edge: { x: number; y: number };
  pointCount: number;
}

/** A bezier anchor with a single symmetric tangent: `(hx, hy)` is the outgoing
 *  handle as a delta from the anchor; the incoming handle is its mirror
 *  `-(hx, hy)`. Storing one vector keeps tangents continuous by construction
 *  (no corner points) while still allowing the handle to be edited. */
export interface BezierAnchor {
  x: number;
  y: number;
  hx: number;
  hy: number;
}

export interface BezierModifier extends ModifierBase {
  kind: "bezier";
  anchors: BezierAnchor[];
  closed: boolean;
  pointCount: number;
}

export type Modifier = PathModifier | CircleModifier | BezierModifier;

export interface ModifierGroup {
  uuid: GroupUUID;
  name: string;
  collapsed: boolean;
  muted: boolean;
}

/**
 * Reserved name for the managed group produced by image tracing. Identified by name:
 * users cannot create or rename a group to it, and each trace overwrites this group's
 * contents (it can still be deleted manually).
 */
export const TRACED_GROUP_NAME = "Traced contours";

export type StackEntry =
  | { type: "modifier"; modifier: Modifier }
  | { type: "group"; group: ModifierGroup; children: Modifier[] };

export function entryUUID(entry: StackEntry): string {
  return entry.type === "modifier" ? entry.modifier.uuid : entry.group.uuid;
}

export function collectModifiers(stack: StackEntry[]): Modifier[] {
  const out: Modifier[] = [];
  for (const entry of stack) {
    if (entry.type === "modifier") out.push(entry.modifier);
    else out.push(...entry.children);
  }
  return out;
}

export type ConstraintEdge = [PointUUID, PointUUID];

export interface ModifierResult {
  points: Point[];
  edges: ConstraintEdge[];
}

export const DOCUMENT_VERSION = 2;

export interface PersistedDocument {
  version: number;
  image: ImageRef | null;
  seed: number;
  seedSettings: SeedSettings;
  colorSettings: ColorSettings;
  stack: StackEntry[];
}

export interface DocumentData {
  version: number;
  image: ImageRef | null;
  seed: number;
  seedSettings: SeedSettings;
  colorSettings: ColorSettings;
  stack: StackEntry[];
  points: Point[];
  constraintEdges: ConstraintEdge[];
  /** Render-ready triangle buffers, rebuilt by `buildGeometry` (not persisted).
   *  Flat to let the preview upload without cloning or UUID->Point resolution.
   *  Positions are xyz per vertex (9/triangle); colors are rgb per triangle (3). */
  renderPositions: Float32Array;
  renderColors: Uint8Array;
  triangleCount: number;
}

export function emptyDocument(): DocumentData {
  return {
    version: DOCUMENT_VERSION,
    image: null,
    seed: randomSeed(),
    seedSettings: { ...DEFAULT_SEED_SETTINGS },
    colorSettings: { ...DEFAULT_COLOR_SETTINGS },
    stack: [],
    points: [],
    constraintEdges: [],
    renderPositions: new Float32Array(0),
    renderColors: new Uint8Array(0),
    triangleCount: 0,
  };
}
