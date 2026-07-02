import type { ColorSettings, SeedSettings } from "../settings/types.js";

export type ModifierUUID = string & { readonly __brand: "ModifierUUID" };
export type GroupUUID = string & { readonly __brand: "GroupUUID" };

export interface Color {
  r: number;
  g: number;
  b: number;
}

export type PointOrigin = "border" | "modifier" | "interior";

export interface Point {
  x: number;
  y: number;
  origin?: PointOrigin;
  /** Packed 0xRRGGBB overlay color, set only on modifier points that belong to a
   *  group (see `groupColor`). Drives the per-group point tint in the preview;
   *  loose modifier points carry none and fall back to the default modifier color. */
  tint?: number;
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

export type StackEntry =
  | { type: "modifier"; modifier: Modifier }
  | { type: "group"; group: ModifierGroup; children: Modifier[] };

export interface ModifierResult {
  points: Point[];
  /** Constraint edges as index pairs into `points`. Modifier points are only ever
   *  appended in order, so the index of a placed point is fixed at creation and the
   *  pairs stay valid through the rest of the run (see `pointsToResult`). */
  edges: [number, number][];
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
  /** Render-ready triangle buffers, rebuilt by `buildGeometry` (not persisted).
   *  Flat to let the preview upload without cloning or point resolution.
   *  Positions are xyz per vertex (9/triangle); colors are rgb per triangle (3). */
  renderPositions: Float32Array;
  renderColors: Uint8Array;
  triangleCount: number;
}
