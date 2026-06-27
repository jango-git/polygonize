import { getImage, getPoints, getTriangles } from "../document/selectors/document.js";
import type { Color, Point, PointUUID, Triangle } from "../document/types.js";

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

function hex(c: Color): string {
  const h = (n: number): string =>
    Math.min(255, Math.max(0, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

function triangleVerts(tri: Triangle, byUUID: Map<PointUUID, Point>): [Point, Point, Point] | null {
  const a = byUUID.get(tri.a);
  const b = byUUID.get(tri.b);
  const c = byUUID.get(tri.c);
  return a && b && c ? [a, b, c] : null;
}

function trianglesWithPoints(): {
  triangles: Triangle[];
  byUUID: Map<PointUUID, Point>;
  width: number;
  height: number;
} {
  const image = getImage();
  if (!image) throw new Error("No image loaded");
  const byUUID = new Map<PointUUID, Point>();
  for (const p of getPoints()) byUUID.set(p.uuid, p);
  return { triangles: getTriangles(), byUUID, width: image.width, height: image.height };
}

export function buildSvg(): string {
  const { triangles, byUUID, width, height } = trianglesWithPoints();
  const body: string[] = [];
  for (const tri of triangles) {
    const verts = triangleVerts(tri, byUUID);
    if (!verts) continue;
    const pts = verts.map((p) => `${round(p.x)},${round(p.y)}`).join(" ");
    const fill = hex(tri.color);
    body.push(`<polygon points="${pts}" fill="${fill}" stroke="${fill}" stroke-width="1"/>`);
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">\n${body.join("\n")}\n</svg>\n`
  );
}

export async function buildRasterBlob(resolution: number, format: RasterFormat): Promise<Blob> {
  const info = RASTER_FORMATS[format];
  const { triangles, byUUID, width, height } = trianglesWithPoints();
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

  for (const tri of triangles) {
    const verts = triangleVerts(tri, byUUID);
    if (!verts) continue;
    ctx.beginPath();
    ctx.moveTo(verts[0].x * scale, verts[0].y * scale);
    ctx.lineTo(verts[1].x * scale, verts[1].y * scale);
    ctx.lineTo(verts[2].x * scale, verts[2].y * scale);
    ctx.closePath();
    const fill = hex(tri.color);
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
  const { triangles, byUUID, width, height } = trianglesWithPoints();

  const ops: string[] = ["1 w"];
  for (const tri of triangles) {
    const verts = triangleVerts(tri, byUUID);
    if (!verts) continue;
    const c = pdfColor(tri.color);
    ops.push(`${c} rg`, `${c} RG`);
    const [a, b, cc] = verts.map((p) => `${round(p.x)} ${round(height - p.y)}`);
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

function pdfColor(c: Color): string {
  const v = (n: number): string =>
    (Math.min(255, Math.max(0, n)) / 255).toFixed(4).replace(/\.?0+$/, "") || "0";
  return `${v(c.r)} ${v(c.g)} ${v(c.b)}`;
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
