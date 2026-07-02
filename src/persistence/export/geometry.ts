import {
  getImage,
  getRenderColors,
  getRenderPositions,
  getTriangleCount,
} from "../../document/selectors/document.js";

export interface Geometry {
  positions: Float32Array;
  colors: Uint8Array;
  count: number;
  width: number;
  height: number;
}

// Triangles are read straight from the flat render buffers: positions xyz per vertex
// (9/triangle), colors rgb per triangle (3). No point objects or UUID resolution.
export function geometry(): Geometry {
  const image = getImage();
  if (!image) throw new Error("No image loaded");
  return {
    positions: getRenderPositions(),
    colors: getRenderColors(),
    count: getTriangleCount(),
    width: image.width,
    height: image.height,
  };
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function clamp255(n: number): number {
  return Math.min(255, Math.max(0, n));
}

export function hex(r: number, g: number, b: number): string {
  const h = (n: number): string => clamp255(Math.round(n)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
