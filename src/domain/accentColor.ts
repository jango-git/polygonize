import { getPixelData, hasPixels } from "./imageSource.js";

const SAMPLE_COUNT = 500;
const SAT_THRESHOLD = 0.15;
const BUCKET_COUNT = 36;
const MIN_WEIGHT_RATIO = 0.02;

export function extractAccentHue(): number | undefined {
  if (!hasPixels()) return undefined;

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
    const [hue, saturation] = rgbToHueSaturation(r, g, b);
    if (saturation > SAT_THRESHOLD) {
      const weight = saturation * saturation;
      buckets[Math.floor((hue / 360) * BUCKET_COUNT) % BUCKET_COUNT] += weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) return undefined;

  let maxWeight = 0;
  let maxBucket = 0;
  for (let i = 0; i < BUCKET_COUNT; i++) {
    if (buckets[i] > maxWeight) {
      maxWeight = buckets[i];
      maxBucket = i;
    }
  }

  if (maxWeight / totalWeight < MIN_WEIGHT_RATIO) return undefined;

  return Math.round((maxBucket + 0.5) * (360 / BUCKET_COUNT));
}

function rgbToHueSaturation(r: number, g: number, b: number): [hue: number, saturation: number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta < 0.001) return [0, 0];

  let hue = 0;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;

  const lightness = (max + min) / 2;
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));

  return [hue, saturation];
}
