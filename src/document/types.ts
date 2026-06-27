import {
  DEFAULT_COLOR_SETTINGS,
  DEFAULT_SEED_SETTINGS,
  type ColorSettings,
  type SeedSettings,
} from "../settings/types.js";
import { randomSeed } from "../domain/rng.js";

export type PointUUID = string & { readonly __brand: "PointUUID" };
export type TriangleUUID = string & { readonly __brand: "TriangleUUID" };
export type ModifierUUID = string & { readonly __brand: "ModifierUUID" };
export type GroupUUID = string & { readonly __brand: "GroupUUID" };

let counter = 0;
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const newPointUUID = (): PointUUID => uid("pt") as PointUUID;
export const newTriangleUUID = (): TriangleUUID => uid("tri") as TriangleUUID;
export const newModifierUUID = (): ModifierUUID => uid("mod") as ModifierUUID;
export const newGroupUUID = (): GroupUUID => uid("grp") as GroupUUID;

export interface Color {
  r: number;
  g: number;
  b: number;
}

export interface Point {
  uuid: PointUUID;
  x: number;
  y: number;
}

export interface Triangle {
  uuid: TriangleUUID;
  a: PointUUID;
  b: PointUUID;
  c: PointUUID;
  color: Color;
}

export interface ImageRef {
  src: string;
  width: number;
  height: number;
}

export type ModifierKind = "path" | "circle";

export type PathInterpolation = "polyline" | "catmullrom";

export type ToolKind = "polyline" | "circle" | "catmullrom";

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

export type Modifier = PathModifier | CircleModifier;

export interface ModifierGroup {
  uuid: GroupUUID;
  name: string;
  collapsed: boolean;
  muted: boolean;
}

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
  triangles: Triangle[];
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
    triangles: [],
  };
}
