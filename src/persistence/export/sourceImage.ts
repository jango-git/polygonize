import { getImage } from "../../document/selectors/document.js";
import { triggerDownload } from "../download.js";

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
