import type { ImageRef } from "../document/types.js";

let pixels: ImageData | null = null;
let imageWidth = 0;
let imageHeight = 0;

export async function loadPixels(ref: ImageRef): Promise<void> {
  const img = await loadHtmlImage(ref.src);
  const canvas = document.createElement("canvas");
  canvas.width = ref.width;
  canvas.height = ref.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D context is unavailable");
  ctx.drawImage(img, 0, 0, ref.width, ref.height);
  pixels = ctx.getImageData(0, 0, ref.width, ref.height);
  imageWidth = ref.width;
  imageHeight = ref.height;
}

export function hasPixels(): boolean {
  return pixels !== null;
}

export function getPixelData(): { data: Uint8ClampedArray; width: number; height: number } {
  if (!pixels) throw new Error("Pixels are not loaded yet");
  return { data: pixels.data, width: imageWidth, height: imageHeight };
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode the image"));
    img.src = src;
  });
}

export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read the file"));
    reader.readAsDataURL(file);
  });
}

export function measureImage(src: string): Promise<{ width: number; height: number }> {
  return loadHtmlImage(src).then((img) => ({
    width: img.naturalWidth,
    height: img.naturalHeight,
  }));
}
