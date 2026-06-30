import { OrthographicCamera, WebGLRenderer } from "three";
import type { ImageRef } from "../document/types.js";

const FRAME_MARGIN = 1.08;
const MIN_ZOOM = 1;
const MAX_ZOOM = 60;

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
    // Pad so the modifier does not touch the edges; the view ends up ~2x the
    // box on its tightest axis. A floor avoids div-by-zero for points/tiny boxes.
    const FOCUS_PADDING = 2;
    const boxWidth = Math.max(maxX - minX, 1) * FOCUS_PADDING;
    const boxHeight = Math.max(maxY - minY, 1) * FOCUS_PADDING;
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
    this.#centerX = Math.min(
      Math.max(this.#centerX, -worldWidth / 2),
      boundsWidth + worldWidth / 2,
    );
    this.#centerY = Math.min(
      Math.max(this.#centerY, -worldHeight / 2),
      boundsHeight + worldHeight / 2,
    );

    this.#camera.left = this.#centerX - worldWidth / 2;
    this.#camera.right = this.#centerX + worldWidth / 2;
    this.#camera.top = this.#centerY - worldHeight / 2;
    this.#camera.bottom = this.#centerY + worldHeight / 2;
    this.#camera.updateProjectionMatrix();

    this.#requestRender();
  }
}
