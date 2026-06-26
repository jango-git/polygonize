export interface SeedSettings {
  pointCount: number;
  edgeSensitivity: number;
  borderPerSide: number;
  minDistance: number;
}

export const DEFAULT_SEED_SETTINGS: SeedSettings = {
  pointCount: 600,
  edgeSensitivity: 2.5,
  borderPerSide: 4,
  minDistance: 6,
};

export const SEED_LIMITS = {
  pointCount: { min: 0, max: 5000, step: 50 },
  edgeSensitivity: { min: 0, max: 6, step: 0.1 },
  borderPerSide: { min: 0, max: 40, step: 1 },
  minDistance: { min: 0, max: 60, step: 1 },
} as const;

export type ColorStrategy = "average" | "median" | "vertices";

export interface ColorSettings {
  strategy: ColorStrategy;
  samplesPerTriangle: number;
}

export const DEFAULT_COLOR_SETTINGS: ColorSettings = {
  strategy: "median",
  samplesPerTriangle: 24,
};

export const COLOR_LIMITS = {
  samplesPerTriangle: { min: 1, max: 256, step: 1 },
} as const;

export interface ViewSettings {
  overlayOpacity: number;
  pointsOpacity: number;
}

export const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  overlayOpacity: 0,
  pointsOpacity: 1,
};

export const VIEW_LIMITS = {
  overlayOpacity: { min: 0, max: 1, step: 0.1 },
  pointsOpacity: { min: 0, max: 1, step: 0.1 },
} as const;

export interface ToolSettings {
  catmullDensity: number;
}

export const DEFAULT_TOOL_SETTINGS: ToolSettings = {
  catmullDensity: 1,
};

export const TOOL_LIMITS = {
  catmullDensity: { min: 0.25, max: 4, step: 0.25 },
} as const;
