import { getPixelData, hasPixels } from "./imageSource.js";

const SAMPLE_COUNT = 500;
const SAT_THRESHOLD = 0.15;
const BUCKET_COUNT = 36; // 10° per bucket
const MIN_WEIGHT_RATIO = 0.02; // dominant bucket must hold ≥2% of total weight

export function extractAccentHue(): number | null {
  if (!hasPixels()) return null;

  const { data, width, height } = getPixelData();
  const total = width * height;
  const step = Math.max(1, Math.floor(total / SAMPLE_COUNT));

  const buckets = new Float64Array(BUCKET_COUNT);
  let totalWeight = 0;

  for (let i = 0; i < total; i += step) {
    const idx = i * 4;
    const r = data[idx] / 255;
    const g = data[idx + 1] / 255;
    const b = data[idx + 2] / 255;
    const [h, s] = rgbToHS(r, g, b);
    if (s > SAT_THRESHOLD) {
      const w = s * s; // square-weight: strongly saturated pixels vote louder
      buckets[Math.floor((h / 360) * BUCKET_COUNT) % BUCKET_COUNT] += w;
      totalWeight += w;
    }
  }

  if (totalWeight === 0) return null;

  let maxWeight = 0;
  let maxBucket = 0;
  for (let i = 0; i < BUCKET_COUNT; i++) {
    if (buckets[i] > maxWeight) {
      maxWeight = buckets[i];
      maxBucket = i;
    }
  }

  if (maxWeight / totalWeight < MIN_WEIGHT_RATIO) return null;

  return Math.round((maxBucket + 0.5) * (360 / BUCKET_COUNT));
}

function rgbToHS(r: number, g: number, b: number): [h: number, s: number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta < 0.001) return [0, 0];

  let h = 0;
  if (max === r) h = ((g - b) / delta) % 6;
  else if (max === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;
  h = ((h * 60) + 360) % 360;

  const l = (max + min) / 2;
  const s = delta / (1 - Math.abs(2 * l - 1));

  return [h, s];
}
