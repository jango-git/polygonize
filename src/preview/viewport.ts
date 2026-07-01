import { OrthographicCamera, WebGLRenderer } from "three";
import type { ImageRef } from "../document/types.js";

const FRAME_MARGIN = 1.08;
const MIN_ZOOM = 1;
const MAX_ZOOM = 60;
// Focus padding is adaptive: a small modifier gets more surrounding context so
// it is not lost in an empty view, a large one stays tight. Interpolated by how
// much of the framed view the box already spans (see focusOnBounds).
const MIN_FOCUS_PADDING = 0.05;
const MAX_FOCUS_PADDING = 8;
// Panning may drag the image off screen until only this fraction of the visible
// viewport still shows it (so up to 90% of the view can be emptied). Measured
// against the zoomed viewport, not the source image, so edges stay reachable at
// any zoom.
const MIN_VISIBLE_FRACTION = 0.1;

// Owns the orthographic camera and all screen <-> image coordinate math. World
// coordinates equal image coordinates (Y down); the camera frames the image with
// a small margin and supports zoom, pan, and framing a bounding box.
export class Viewport {
  readonly #camera = new OrthographicCamera();
  readonly #renderer: WebGLRenderer;
  readonly #container: HTMLElement;
  readonly #requestRender: () => void;

  #image?: ImageRef;

  #zoom = 1;
  #centerX = 0;
  #centerY = 0;
  #baseWorldWidth = 0;
  #baseWorldHeight = 0;

  constructor(renderer: WebGLRenderer, container: HTMLElement, requestRender: () => void) {
    this.#renderer = renderer;
    this.#container = container;
    this.#requestRender = requestRender;
    this.#camera.near = -100;
    this.#camera.far = 100;

    this.applyCamera();
    new ResizeObserver(() => this.applyCamera()).observe(container);
  }

  get camera(): OrthographicCamera {
    return this.#camera;
  }

  setImage(image: ImageRef | undefined): void {
    this.#image = image;
  }

  resetView(): void {
    this.#zoom = 1;
    this.#centerX = this.#image ? this.#image.width / 2 : 0;
    this.#centerY = this.#image ? this.#image.height / 2 : 0;
    this.applyCamera();
  }

  screenToImage(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.#renderer.domElement.getBoundingClientRect();
    const u = (clientX - rect.left) / rect.width;
    const v = (clientY - rect.top) / rect.height;
    const x = this.#camera.left + u * (this.#camera.right - this.#camera.left);
    const y = this.#camera.top + v * (this.#camera.bottom - this.#camera.top);
    return { x, y };
  }

  zoomAtScreen(clientX: number, clientY: number, factor: number): void {
    const before = this.screenToImage(clientX, clientY);
    const rect = this.#renderer.domElement.getBoundingClientRect();
    const u = (clientX - rect.left) / rect.width;
    const v = (clientY - rect.top) / rect.height;

    this.#zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.#zoom * factor));

    const worldWidth = this.#baseWorldWidth / this.#zoom;
    const worldHeight = this.#baseWorldHeight / this.#zoom;
    this.#centerX = before.x + (0.5 - u) * worldWidth;
    this.#centerY = before.y + (0.5 - v) * worldHeight;
    this.applyCamera();
  }

  pan(screenDx: number, screenDy: number): void {
    const worldPerPixel = this.worldPerPixel();
    this.#centerX -= screenDx * worldPerPixel;
    this.#centerY -= screenDy * worldPerPixel;
    this.applyCamera();
  }

  // Center the view on a world-space bounding box and zoom so it fills a
  // comfortable fraction of the viewport. Used to frame a modifier when it is
  // selected in the stack. Bounds are in image coords (== world coords).
  focusOnBounds(minX: number, minY: number, maxX: number, maxY: number): void {
    if (this.#baseWorldWidth === 0 || this.#baseWorldHeight === 0) return;
    // A floor avoids div-by-zero for points/tiny boxes.
    const rawWidth = Math.max(maxX - minX, 1);
    const rawHeight = Math.max(maxY - minY, 1);
    // Share of the framed view the box already spans on its dominant axis
    // (0 = tiny .. 1 = fills the frame). Small boxes get a larger padding so the
    // view pulls back and shows context; large boxes stay tight.
    const spanFraction = Math.min(
      1,
      Math.max(rawWidth / this.#baseWorldWidth, rawHeight / this.#baseWorldHeight),
    );
    const padding = MAX_FOCUS_PADDING - (MAX_FOCUS_PADDING - MIN_FOCUS_PADDING) * spanFraction;
    const boxWidth = rawWidth * padding;
    const boxHeight = rawHeight * padding;
    const zoom = Math.min(this.#baseWorldWidth / boxWidth, this.#baseWorldHeight / boxHeight);
    this.#zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
    this.#centerX = (minX + maxX) / 2;
    this.#centerY = (minY + maxY) / 2;
    this.applyCamera();
  }

  worldPerPixel(): number {
    const rect = this.#renderer.domElement.getBoundingClientRect();
    return (this.#camera.right - this.#camera.left) / rect.width;
  }

  applyCamera(): void {
    const width = this.#container.clientWidth;
    const height = this.#container.clientHeight;
    if (width === 0 || height === 0) return;
    this.#renderer.setSize(width, height, false);

    const stageAspect = width / height;
    const imageWidth = this.#image?.width ?? width;
    const imageHeight = this.#image?.height ?? height;

    const needWidth = imageWidth * FRAME_MARGIN;
    const needHeight = imageHeight * FRAME_MARGIN;
    if (needWidth / needHeight > stageAspect) {
      this.#baseWorldWidth = needWidth;
      this.#baseWorldHeight = needWidth / stageAspect;
    } else {
      this.#baseWorldHeight = needHeight;
      this.#baseWorldWidth = needHeight * stageAspect;
    }

    const worldWidth = this.#baseWorldWidth / this.#zoom;
    const worldHeight = this.#baseWorldHeight / this.#zoom;

    const boundsWidth = this.#image?.width ?? 0;
    const boundsHeight = this.#image?.height ?? 0;
    // Overscroll allowance, in world units, that keeps MIN_VISIBLE_FRACTION of
    // the viewport covered by the image on the side being dragged toward.
    const marginX = (0.5 - MIN_VISIBLE_FRACTION) * worldWidth;
    const marginY = (0.5 - MIN_VISIBLE_FRACTION) * worldHeight;
    this.#centerX = Math.min(Math.max(this.#centerX, -marginX), boundsWidth + marginX);
    this.#centerY = Math.min(Math.max(this.#centerY, -marginY), boundsHeight + marginY);

    this.#camera.left = this.#centerX - worldWidth / 2;
    this.#camera.right = this.#centerX + worldWidth / 2;
    this.#camera.top = this.#centerY - worldHeight / 2;
    this.#camera.bottom = this.#centerY + worldHeight / 2;
    this.#camera.updateProjectionMatrix();

    this.#requestRender();
  }
}
