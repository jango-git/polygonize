import { Color, Scene, WebGLRenderer } from "three";
import type { ImageRef, Point } from "../document/types.js";
import { ImageLayer } from "./imageLayer.js";
import { OverlayLayer } from "./overlayLayer.js";
import { PointLayer } from "./pointLayer.js";
import { createDiscTexture } from "./shaders.js";
import { TriangleLayer } from "./triangleLayer.js";
import { Viewport } from "./viewport.js";

type Vec2 = { x: number; y: number };

// Holds the three.js renderer and scene and coordinates the rendering layers.
// World coordinates equal image coordinates (Y down). Each layer owns its own
// three.js objects; this class only wires them to the shared scene and a single
// coalesced render call. The public API mirrors the layers and is consumed by
// `receiving.ts` (signals) and the `ui/` modules.
export class Preview {
  readonly #scene = new Scene();
  readonly #renderer: WebGLRenderer;
  readonly #viewport: Viewport;
  readonly #imageLayer: ImageLayer;
  readonly #triangleLayer: TriangleLayer;
  readonly #pointLayer: PointLayer;
  readonly #overlayLayer: OverlayLayer;
  #renderScheduled = false;

  #image?: ImageRef;

  constructor(container: HTMLElement) {
    this.#renderer = new WebGLRenderer({ antialias: true });
    this.#renderer.setPixelRatio(window.devicePixelRatio);
    this.#scene.background = new Color(
      getComputedStyle(document.documentElement).getPropertyValue("--stage-bg").trim() || "#0e0f12",
    );
    container.appendChild(this.#renderer.domElement);

    const requestRender = () => this.#render();
    const discTexture = createDiscTexture();
    this.#imageLayer = new ImageLayer(this.#scene, requestRender);
    this.#triangleLayer = new TriangleLayer(this.#scene, requestRender);
    this.#pointLayer = new PointLayer(this.#scene, requestRender, this.#renderer, discTexture);
    this.#overlayLayer = new OverlayLayer(this.#scene, requestRender, this.#renderer);
    this.#viewport = new Viewport(this.#renderer, container, requestRender);
  }

  get domElement(): HTMLCanvasElement {
    return this.#renderer.domElement;
  }

  setImageFrame(image: ImageRef | null): void {
    this.#image = image ?? undefined;
    this.#imageLayer.setImage(this.#image);
    this.#viewport.setImage(this.#image);
    this.#viewport.resetView();
  }

  resetView(): void {
    this.#viewport.resetView();
  }

  setBackground(cssColor: string): void {
    (this.#scene.background as Color).set(cssColor);
    this.#render();
  }

  setOverlayOpacity(value: number): void {
    this.#imageLayer.setOverlayOpacity(value);
  }

  setPointsOpacity(value: number): void {
    this.#pointLayer.setOpacity(value);
  }

  setSpikeOpacity(value: number): void {
    this.#triangleLayer.setSpikeOpacity(value);
  }

  setTriangleGeometry(positions: Float32Array, colors: Uint8Array, count: number): void {
    this.#triangleLayer.setGeometry(positions, colors, count);
  }

  setTriangleColors(colors: Uint8Array, count: number): void {
    this.#triangleLayer.setColors(colors, count);
  }

  rebuildPoints(points: Point[]): void {
    this.#pointLayer.rebuild(points, this.#image, this.#imageLayer.imageTexture);
  }

  screenToImage(clientX: number, clientY: number): Vec2 {
    return this.#viewport.screenToImage(clientX, clientY);
  }

  zoomAtScreen(clientX: number, clientY: number, factor: number): void {
    this.#viewport.zoomAtScreen(clientX, clientY, factor);
  }

  pan(screenDx: number, screenDy: number): void {
    this.#viewport.pan(screenDx, screenDy);
  }

  focusOnBounds(minX: number, minY: number, maxX: number, maxY: number): void {
    this.#viewport.focusOnBounds(minX, minY, maxX, maxY);
  }

  worldPerPixel(): number {
    return this.#viewport.worldPerPixel();
  }

  setDraftPath(outline: Vec2[] | null, closed: boolean, handles?: Vec2[], color?: number): void {
    this.#overlayLayer.setDraftPath(outline, closed, handles, color);
  }

  setHighlightedPath(
    outline: Vec2[] | null,
    closed: boolean,
    handles?: Vec2[],
    color?: number,
  ): void {
    this.#overlayLayer.setHighlightedPath(outline, closed, handles, color);
  }

  setHoverPath(outline: Vec2[] | null, closed: boolean, color?: number): void {
    this.#overlayLayer.setHoverPath(outline, closed, color);
  }

  setNearbyPaths(paths: { outline: Vec2[]; closed: boolean; color?: number }[]): void {
    this.#overlayLayer.setNearbyPaths(paths);
  }

  setHandleWhiskers(segments: [Vec2, Vec2][], dots: Vec2[], color?: number): void {
    this.#overlayLayer.setHandleWhiskers(segments, dots, color);
  }

  setSelectedControlPoint(point: Vec2 | null, color?: number): void {
    this.#overlayLayer.setSelectedControlPoint(point, color);
  }

  #render(): void {
    if (this.#renderScheduled) return;
    this.#renderScheduled = true;
    requestAnimationFrame(() => {
      this.#renderScheduled = false;
      // Keep fat-line widths correct across canvas resizes (overlay lines are not
      // rebuilt on resize, so their LineMaterial.resolution is synced here).
      this.#overlayLayer.updateResolution();
      this.#renderer.render(this.#scene, this.#viewport.camera);
    });
  }
}
