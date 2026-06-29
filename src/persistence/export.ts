import {
  getImage,
  getRenderColors,
  getRenderPositions,
  getTriangleCount,
} from "../document/selectors/document.js";

export const PNG_RESOLUTIONS = [128, 256, 512, 1024, 2048, 4096] as const;

export const DEFAULT_PNG_RESOLUTION = 4096;

export type RasterFormat = "png" | "jpg" | "webp";
export type VectorFormat = "svg" | "pdf";

interface RasterFormatInfo {
  mime: string;
  ext: string;
  quality?: number;
  background?: string;
}

const RASTER_FORMATS: Record<RasterFormat, RasterFormatInfo> = {
  png: { mime: "image/png", ext: "png" },
  jpg: { mime: "image/jpeg", ext: "jpg", quality: 1, background: "#ffffff" },
  webp: { mime: "image/webp", ext: "webp", quality: 1 },
};

function hex(r: number, g: number, b: number): string {
  const h = (n: number): string =>
    Math.min(255, Math.max(0, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

interface Geometry {
  positions: Float32Array;
  colors: Uint8Array;
  count: number;
  width: number;
  height: number;
}

// Triangles are read straight from the flat render buffers: positions xyz per vertex
// (9/triangle), colors rgb per triangle (3). No point objects or UUID resolution.
function geometry(): Geometry {
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

export function buildSvg(): string {
  const { positions, colors, count, width, height } = geometry();
  const body: string[] = [];
  for (let t = 0; t < count; t++) {
    const o = t * 9;
    const pts =
      `${round(positions[o])},${round(positions[o + 1])} ` +
      `${round(positions[o + 3])},${round(positions[o + 4])} ` +
      `${round(positions[o + 6])},${round(positions[o + 7])}`;
    const co = t * 3;
    const fill = hex(colors[co], colors[co + 1], colors[co + 2]);
    body.push(`<polygon points="${pts}" fill="${fill}" stroke="${fill}" stroke-width="1"/>`);
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">\n${body.join("\n")}\n</svg>\n`
  );
}

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
    const o = t * 9;
    ctx.beginPath();
    ctx.moveTo(positions[o] * scale, positions[o + 1] * scale);
    ctx.lineTo(positions[o + 3] * scale, positions[o + 4] * scale);
    ctx.lineTo(positions[o + 6] * scale, positions[o + 7] * scale);
    ctx.closePath();
    const co = t * 3;
    const fill = hex(colors[co], colors[co + 1], colors[co + 2]);
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

export function buildPdf(): Blob {
  const { positions, colors, count, width, height } = geometry();

  const ops: string[] = ["1 w"];
  for (let t = 0; t < count; t++) {
    const o = t * 9;
    const co = t * 3;
    const c = pdfColor(colors[co], colors[co + 1], colors[co + 2]);
    ops.push(`${c} rg`, `${c} RG`);
    const a = `${round(positions[o])} ${round(height - positions[o + 1])}`;
    const b = `${round(positions[o + 3])} ${round(height - positions[o + 4])}`;
    const cc = `${round(positions[o + 6])} ${round(height - positions[o + 7])}`;
    ops.push(`${a} m`, `${b} l`, `${cc} l`, "h", "B");
  }
  const content = ops.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${round(width)} ${round(height)}] ` +
      "/Contents 4 0 R /Resources << >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` + `startxref\n${xrefStart}\n%%EOF\n`;

  return new Blob([pdf], { type: "application/pdf" });
}

function pdfColor(r: number, g: number, b: number): string {
  const v = (n: number): string =>
    (Math.min(255, Math.max(0, n)) / 255).toFixed(4).replace(/\.?0+$/, "") || "0";
  return `${v(r)} ${v(g)} ${v(b)}`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function triggerDownload(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  URL.revokeObjectURL(url);
}

export function downloadVector(format: VectorFormat): void {
  if (format === "pdf") {
    downloadBlob(buildPdf(), "polygonize.pdf");
  } else {
    downloadBlob(new Blob([buildSvg()], { type: "image/svg+xml" }), "polygonize.svg");
  }
}

export async function downloadRaster(resolution: number, format: RasterFormat): Promise<void> {
  const blob = await buildRasterBlob(resolution, format);
  downloadBlob(blob, `polygonize.${RASTER_FORMATS[format].ext}`);
}

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
};

// Returns the user-loaded source image untouched (the original data URL the document
// holds), letting them recover the base photo they polygonized.
export function downloadSourceImage(): void {
  const image = getImage();
  if (!image) throw new Error("No image loaded");
  const mime = /^data:([^;,]+)/.exec(image.src)?.[1] ?? "image/png";
  const ext = MIME_EXTENSIONS[mime] ?? "png";
  triggerDownload(image.src, `polygonize-source.${ext}`);
}
