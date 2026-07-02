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

export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function clamp255(value: number): number {
  return Math.min(255, Math.max(0, value));
}

export function hex(red: number, green: number, blue: number): string {
  const component = (value: number): string =>
    clamp255(Math.round(value)).toString(16).padStart(2, "0");
  return `#${component(red)}${component(green)}${component(blue)}`;
}
