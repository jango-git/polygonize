import { geometry, hex } from "./geometry.js";

export type RasterFormat = "png" | "jpg" | "webp";

interface RasterFormatInfo {
  mime: string;
  ext: string;
  quality?: number;
  background?: string;
}

export const RASTER_FORMATS: Record<RasterFormat, RasterFormatInfo> = {
  png: { mime: "image/png", ext: "png" },
  jpg: { mime: "image/jpeg", ext: "jpg", quality: 1, background: "#ffffff" },
  webp: { mime: "image/webp", ext: "webp", quality: 1 },
};

export async function buildRasterBlob(resolution: number, format: RasterFormat): Promise<Blob> {
  const info = RASTER_FORMATS[format];
  const { positions, colors, count, width, height } = geometry();
  const scale = resolution / Math.max(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  if (info.background) {
    ctx.fillStyle = info.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  for (let t = 0; t < count; t++) {
    const offset = t * 9;
    ctx.beginPath();
    ctx.moveTo(positions[offset] * scale, positions[offset + 1] * scale);
    ctx.lineTo(positions[offset + 3] * scale, positions[offset + 4] * scale);
    ctx.lineTo(positions[offset + 6] * scale, positions[offset + 7] * scale);
    ctx.closePath();
    const colorOffset = t * 3;
    const fill = hex(colors[colorOffset], colors[colorOffset + 1], colors[colorOffset + 2]);
    ctx.fillStyle = fill;
    ctx.strokeStyle = fill;
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error(`Failed to encode ${format.toUpperCase()}`));
      },
      info.mime,
      info.quality,
    );
  });
}
