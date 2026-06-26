import { getPixelData, hasPixels } from "./imageSource.js";

export interface DensityMap {
  values: Float32Array;
  cols: number;
  rows: number;
}

const DEFAULT_MAX_DIM = 256;

export function computeEdgeDensity(maxDim = DEFAULT_MAX_DIM): DensityMap {
  if (!hasPixels()) return { values: new Float32Array(0), cols: 0, rows: 0 };
  const { data, width, height } = getPixelData();

  const scale = Math.min(1, maxDim / Math.max(width, height));
  const cols = Math.max(2, Math.round(width * scale));
  const rows = Math.max(2, Math.round(height * scale));

  const gray = new Float32Array(cols * rows);
  for (let gy = 0; gy < rows; gy++) {
    const sy0 = Math.floor((gy * height) / rows);
    const sy1 = Math.max(sy0 + 1, Math.floor(((gy + 1) * height) / rows));
    for (let gx = 0; gx < cols; gx++) {
      const sx0 = Math.floor((gx * width) / cols);
      const sx1 = Math.max(sx0 + 1, Math.floor(((gx + 1) * width) / cols));
      let sum = 0;
      let n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const idx = (sy * width + sx) * 4;
          sum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          n++;
        }
      }
      gray[gy * cols + gx] = n > 0 ? sum / n : 0;
    }
  }

  const values = new Float32Array(cols * rows);
  let max = 0;
  const at = (x: number, y: number) => {
    const cx = x < 0 ? 0 : x >= cols ? cols - 1 : x;
    const cy = y < 0 ? 0 : y >= rows ? rows - 1 : y;
    return gray[cy * cols + cx];
  };
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const tl = at(x - 1, y - 1);
      const tc = at(x, y - 1);
      const tr = at(x + 1, y - 1);
      const ml = at(x - 1, y);
      const mr = at(x + 1, y);
      const bl = at(x - 1, y + 1);
      const bc = at(x, y + 1);
      const br = at(x + 1, y + 1);
      const gxv = tr + 2 * mr + br - (tl + 2 * ml + bl);
      const gyv = bl + 2 * bc + br - (tl + 2 * tc + tr);
      const mag = Math.sqrt(gxv * gxv + gyv * gyv);
      values[y * cols + x] = mag;
      if (mag > max) max = mag;
    }
  }

  if (max > 0) {
    for (let i = 0; i < values.length; i++) values[i] /= max;
  }

  return { values, cols, rows };
}
