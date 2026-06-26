import type { Color, Point } from "../document/types.js";
import type { ColorSettings } from "../settings/types.js";
import { getPixelData, hasPixels } from "./imageSource.js";

const FALLBACK: Color = { r: 128, g: 128, b: 128 };

const VERTEX_RADIUS_PX = 3;

export function sampleTriangleColor(a: Point, b: Point, c: Point, settings: ColorSettings): Color {
  if (!hasPixels()) return { ...FALLBACK };
  const { data, width, height } = getPixelData();

  const n = Math.max(1, Math.floor(settings.samplesPerTriangle));
  const rs = new Uint8Array(n);
  const gs = new Uint8Array(n);
  const bs = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    let r1 = halton(i + 1, 2);
    let r2 = halton(i + 1, 3);
    if (r1 + r2 > 1) {
      r1 = 1 - r1;
      r2 = 1 - r2;
    }
    const fx = a.x + r1 * (b.x - a.x) + r2 * (c.x - a.x);
    const fy = a.y + r1 * (b.y - a.y) + r2 * (c.y - a.y);
    const x = clampInt(Math.floor(fx), width - 1);
    const y = clampInt(Math.floor(fy), height - 1);
    const idx = (y * width + x) * 4;
    rs[i] = data[idx];
    gs[i] = data[idx + 1];
    bs[i] = data[idx + 2];
  }

  if (settings.strategy === "median") {
    return { r: median(rs), g: median(gs), b: median(bs) };
  }
  return { r: mean(rs), g: mean(gs), b: mean(bs) };
}

export function samplePointColor(x: number, y: number, settings: ColorSettings): Color {
  if (!hasPixels()) return { ...FALLBACK };
  const { data, width, height } = getPixelData();

  const n = Math.max(1, Math.floor(settings.samplesPerTriangle));
  let sr = 0;
  let sg = 0;
  let sb = 0;
  for (let i = 0; i < n; i++) {
    const radius = Math.sqrt(halton(i + 1, 2)) * VERTEX_RADIUS_PX;
    const angle = 2 * Math.PI * halton(i + 1, 3);
    const px = clampInt(Math.floor(x + radius * Math.cos(angle)), width - 1);
    const py = clampInt(Math.floor(y + radius * Math.sin(angle)), height - 1);
    const idx = (py * width + px) * 4;
    sr += data[idx];
    sg += data[idx + 1];
    sb += data[idx + 2];
  }
  return { r: Math.round(sr / n), g: Math.round(sg / n), b: Math.round(sb / n) };
}

function mean(values: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i];
  return Math.round(sum / values.length);
}

function median(values: Uint8Array): number {
  const sorted = Uint8Array.from(values).sort();
  const mid = sorted.length >> 1;
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function halton(i: number, base: number): number {
  let f = 1;
  let r = 0;
  while (i > 0) {
    f /= base;
    r += f * (i % base);
    i = Math.floor(i / base);
  }
  return r;
}

function clampInt(v: number, max: number): number {
  return v < 0 ? 0 : v > max ? max : v;
}
