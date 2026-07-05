import { downloadBlob } from "./download.js";
import { buildPdf } from "./export/pdf.js";
import { RASTER_FORMATS, type RasterFormat, buildRasterBlob } from "./export/raster.js";
import { buildSvg } from "./export/svg.js";

export type { RasterFormat };
export { downloadSourceImage } from "./export/sourceImage.js";

export const PNG_RESOLUTIONS = [128, 256, 512, 1024, 2048, 4096] as const;

export const DEFAULT_PNG_RESOLUTION = 4096;

export type VectorFormat = "svg" | "pdf";

export function downloadVector(format: VectorFormat): void {
  if (format === "pdf") {
    downloadBlob(buildPdf(), "tesselot.pdf");
  } else {
    downloadBlob(new Blob([buildSvg()], { type: "image/svg+xml" }), "tesselot.svg");
  }
}

export async function downloadRaster(resolution: number, format: RasterFormat): Promise<void> {
  const blob = await buildRasterBlob(resolution, format);
  downloadBlob(blob, `tesselot.${RASTER_FORMATS[format].ext}`);
}
