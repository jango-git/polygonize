import type { Preview } from "../preview/preview.js";

const ZOOM_SPEED = 0.0015;

export function attachInteraction(preview: Preview): void {
  const canvas = preview.domElement;

  document.addEventListener("contextmenu", (e) => e.preventDefault());

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * ZOOM_SPEED);
      preview.zoomAtScreen(e.clientX, e.clientY, factor);
    },
    { passive: false },
  );

  let panActive = false;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 2) return;
    panActive = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = "grabbing";
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!panActive) return;
    preview.pan(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX;
    lastY = e.clientY;
  });

  const stopPan = (e: PointerEvent): void => {
    if (e.button !== 2) return;
    panActive = false;
    canvas.style.cursor = "";
  };
  canvas.addEventListener("pointerup", stopPan);
  canvas.addEventListener("pointercancel", () => {
    panActive = false;
    canvas.style.cursor = "";
  });
}
