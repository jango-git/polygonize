import { getImage, getPoints, getTriangles } from "../document/selectors/document.js";
import type { Color, Point, PointUUID, Triangle } from "../document/types.js";

export const PNG_RESOLUTIONS = [128, 256, 512, 1024, 2048, 4096] as const;
export const DEFAULT_PNG_RESOLUTION = 1024;

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

export async function buildPngBlob(resolution: number): Promise<Blob> {
  const { triangles, byUUID, width, height } = trianglesWithPoints();
  const scale = resolution / Math.max(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

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
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to encode PNG"));
    }, "image/png");
  });
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

export function downloadSvg(filename = "polygonize.svg"): void {
  const blob = new Blob([buildSvg()], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  URL.revokeObjectURL(url);
}

export async function downloadPng(resolution: number, filename = "polygonize.png"): Promise<void> {
  const blob = await buildPngBlob(resolution);
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  URL.revokeObjectURL(url);
}
