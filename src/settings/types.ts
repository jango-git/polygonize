export interface SeedSettings {
  borderPerSide: number;
  minRadius: number;
  maxRadius: number;
}

export const DEFAULT_SEED_SETTINGS: SeedSettings = {
  borderPerSide: 4,
  minRadius: 6,
  maxRadius: 48,
};

export const SEED_LIMITS = {
  borderPerSide: { min: 0, max: 40, step: 1 },
  minRadius: { min: 2, max: 60, step: 1 },
  maxRadius: { min: 10, max: 200, step: 2 },
} as const;

export type ColorStrategy = "average" | "median";

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

export interface TraceSettings {
  /** Hysteresis low/high thresholds, as fractions of the max gradient magnitude. */
  lowThreshold: number;
  highThreshold: number;
  /** Douglas-Peucker simplification tolerance, in image pixels. */
  simplifyPx: number;
  /** Drop traced contours simplified below this many vertices. */
  minPoints: number;
  /** Drop traced contours whose arc length (image pixels) is below this. */
  minLength: number;
}

export const DEFAULT_TRACE_SETTINGS: TraceSettings = {
  lowThreshold: 0.1,
  highThreshold: 0.3,
  simplifyPx: 2,
  minPoints: 4,
  minLength: 40,
};

export const TRACE_LIMITS = {
  lowThreshold: { min: 0.01, max: 0.99, step: 0.01 },
  highThreshold: { min: 0.01, max: 0.99, step: 0.01 },
  simplifyPx: { min: 0, max: 10, step: 0.5 },
  minPoints: { min: 2, max: 30, step: 1 },
  minLength: { min: 0, max: 500, step: 5 },
} as const;

export interface ViewSettings {
  overlayOpacity: number;
  pointsOpacity: number;
  spikeOpacity: number;
}

export const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  overlayOpacity: 0,
  pointsOpacity: 1,
  spikeOpacity: 0,
};

export const VIEW_LIMITS = {
  overlayOpacity: { min: 0, max: 1, step: 0.1 },
  pointsOpacity: { min: 0, max: 1, step: 0.1 },
  spikeOpacity: { min: 0, max: 1, step: 0.1 },
} as const;

export interface ToolSettings {
  catmullDensity: number;
}

export const DEFAULT_TOOL_SETTINGS: ToolSettings = {
  catmullDensity: 1,
};

export const TOOL_LIMITS = {
  catmullDensity: { min: 0.25, max: 8, step: 0.25 },
} as const;
