import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Line,
  LineBasicMaterial,
  Material,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  WebGLRenderer,
} from "three";
import type { ImageRef, Point, PointOrigin } from "../document/types.js";
import { triangleSpike } from "../domain/triangleQuality.js";

const MARGIN = 1.08;
const MIN_ZOOM = 1;
const MAX_ZOOM = 60;
const MODIFIER_COLOR = 0x4eb8d3;
const HOVER_COLOR = MODIFIER_COLOR;

const POINT_COLORS: Record<PointOrigin, number> = {
  border: 0xd98844,
  modifier: MODIFIER_COLOR,
  interior: 0xcccccc,
};
const POINT_COLOR_FALLBACK = 0xcccccc;
const POINT_SIZE = 7;
// Background field points (border + interior) render smaller than modifier points
// so the active modifier reads clearly against the field.
const BG_POINT_SCALE = 0.75;

export class Preview {
  readonly #scene = new Scene();
  readonly #camera = new OrthographicCamera();
  readonly #renderer: WebGLRenderer;
  readonly #container: HTMLElement;
  readonly #discTexture = createDiscTexture();
  #renderScheduled = false;

  #image: ImageRef | null = null;
  #imageTexture: Texture | null = null;

  #backgroundMesh: Mesh | null = null;
  #overlayMesh: Mesh | null = null;
  #trianglesMesh: Mesh | null = null;
  #spikeMesh: Mesh | null = null;
  #pointsObjects: Points[] = [];

  // Persistent triangle buffers, reused across drags (grown, never per-frame
  // reallocated). `drawRange` selects the live triangle count; the tail is unused.
  #trianglesGeometry: BufferGeometry | null = null;
  #spikeGeometry: BufferGeometry | null = null;
  #positionAttr: BufferAttribute | null = null;
  #colorAttr: BufferAttribute | null = null;
  #spikeColorAttr: BufferAttribute | null = null;
  #triangleCapacity = 0;
  #triangleCount = 0;
  #spikeDirty = false;

  #draftLine: Line | null = null;
  #draftDots: Points | null = null;
  #highlightLine: Line | null = null;
  #highlightDots: Points | null = null;
  #hoverLine: Line | null = null;
  #nearbyLines: Line[] = [];
  #whiskerLines: Line[] = [];
  #whiskerDots: Points | null = null;

  #overlayOpacity = 0;
  #pointsOpacity = 1;
  #spikeOpacity = 0;

  #zoom = 1;
  #centerX = 0;
  #centerY = 0;
  #baseWorldW = 0;
  #baseWorldH = 0;

  constructor(container: HTMLElement) {
    this.#container = container;
    this.#renderer = new WebGLRenderer({ antialias: true });
    this.#renderer.setPixelRatio(window.devicePixelRatio);
    this.#scene.background = new Color(
      getComputedStyle(document.documentElement).getPropertyValue("--stage-bg").trim() || "#0e0f12",
    );
    this.#camera.near = -100;
    this.#camera.far = 100;
    container.appendChild(this.#renderer.domElement);

    this.#applyCamera();

    new ResizeObserver(() => this.#applyCamera()).observe(container);
  }

  get domElement(): HTMLCanvasElement {
    return this.#renderer.domElement;
  }

  setImageFrame(image: ImageRef | null): void {
    this.#image = image;
    this.#disposeImageMeshes();

    if (image) {
      this.#imageTexture = new TextureLoader().load(image.src, () => this.#render());
      this.#imageTexture.colorSpace = SRGBColorSpace;

      this.#backgroundMesh = this.#buildImageMesh(image, this.#imageTexture, -1, 0, false);
      this.#scene.add(this.#backgroundMesh);

      this.#overlayMesh = this.#buildImageMesh(image, this.#imageTexture, 0.5, 2, true);
      this.#applyOverlayMaterial();
      this.#scene.add(this.#overlayMesh);
    }

    this.resetView();
  }

  resetView(): void {
    this.#zoom = 1;
    this.#centerX = this.#image ? this.#image.width / 2 : 0;
    this.#centerY = this.#image ? this.#image.height / 2 : 0;
    this.#applyCamera();
  }

  setOverlayOpacity(value: number): void {
    this.#overlayOpacity = Math.min(1, Math.max(0, value));
    this.#applyOverlayMaterial();
    this.#render();
  }

  setPointsOpacity(value: number): void {
    this.#pointsOpacity = Math.min(1, Math.max(0, value));
    this.#applyPointsMaterial();
    this.#render();
  }

  setSpikeOpacity(value: number): void {
    this.#spikeOpacity = Math.min(1, Math.max(0, value));
    // Spike colors are skipped while hidden; fill them in when first shown.
    if (this.#spikeOpacity > 0 && this.#spikeDirty) this.#rebuildSpike();
    this.#applySpikeMaterial();
    this.#render();
  }

  #rebuildSpike(): void {
    if (!this.#spikeGeometry || !this.#spikeColorAttr || !this.#positionAttr) return;
    const positions = this.#trianglePositions();
    const spikeColors = this.#spikeColorsArray();
    const count = this.#triangleCount;
    for (let t = 0; t < count; t++) {
      const po = t * 9;
      const spike = triangleSpike(
        positions[po],
        positions[po + 1],
        positions[po + 3],
        positions[po + 4],
        positions[po + 6],
        positions[po + 7],
      );
      const so = t * 12;
      for (let v = 0; v < 12; v += 4) {
        spikeColors[so + v] = 1;
        spikeColors[so + v + 1] = 0;
        spikeColors[so + v + 2] = 0;
        spikeColors[so + v + 3] = spike;
      }
    }
    this.#spikeColorAttr.needsUpdate = true;
    this.#spikeGeometry.setDrawRange(0, count * 3);
    this.#spikeDirty = false;
  }

  setBackground(cssColor: string): void {
    (this.#scene.background as Color).set(cssColor);
    this.#render();
  }

  /**
   * Upload triangle geometry from flat buffers (built by `buildGeometry`): positions
   * are xyz per vertex (9/triangle), colors are rgb per triangle (3). No UUID->Point
   * resolution or cloning - positions are a straight memcpy, colors expand per vertex.
   */
  setTriangleGeometry(positions: Float32Array, colors: Uint8Array, count: number): void {
    this.#ensureTriangleCapacity(count);

    this.#trianglePositions().set(positions.subarray(0, count * 9));
    this.#writeColors(colors, count);

    this.#triangleCount = count;
    const vertexCount = count * 3;
    this.#positionAttr!.needsUpdate = true;
    this.#colorAttr!.needsUpdate = true;
    this.#trianglesGeometry!.setDrawRange(0, vertexCount);
    this.#trianglesMesh!.visible = count > 0;

    if (this.#spikeOpacity > 0) this.#rebuildSpike();
    else this.#spikeDirty = true; // skipped while hidden; rebuilt on demand when shown
    this.#applySpikeMaterial();

    this.#render();
  }

  /**
   * Update only triangle colors against the existing geometry (positions unchanged).
   * Used for the async color-worker result, which recolors the same triangle set.
   */
  setTriangleColors(colors: Uint8Array, count: number): void {
    if (!this.#colorAttr || count !== this.#triangleCount) return;
    this.#writeColors(colors, count);
    this.#colorAttr.needsUpdate = true;
    this.#render();
  }

  // Expand per-triangle rgb (0-255) to per-vertex linear color. sRGB->linear is the
  // expensive step, so it runs once per triangle, not per vertex.
  #writeColors(colors: Uint8Array, count: number): void {
    const out = this.#triangleColors();
    const scratch = new Color();
    for (let t = 0; t < count; t++) {
      const ci = t * 3;
      scratch.setRGB(colors[ci] / 255, colors[ci + 1] / 255, colors[ci + 2] / 255, SRGBColorSpace);
      const o = t * 9;
      const r = scratch.r;
      const g = scratch.g;
      const bl = scratch.b;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = bl;
      out[o + 3] = r;
      out[o + 4] = g;
      out[o + 5] = bl;
      out[o + 6] = r;
      out[o + 7] = g;
      out[o + 8] = bl;
    }
  }

  #trianglePositions(): Float32Array {
    return this.#positionAttr!.array as Float32Array;
  }

  #triangleColors(): Float32Array {
    return this.#colorAttr!.array as Float32Array;
  }

  #spikeColorsArray(): Float32Array {
    return this.#spikeColorAttr!.array as Float32Array;
  }

  #ensureTriangleCapacity(triangleCount: number): void {
    if (!this.#trianglesGeometry) this.#initTriangleMeshes();
    if (this.#positionAttr && triangleCount <= this.#triangleCapacity) return;

    // Grow with headroom so the wiggling per-frame count doesn't reallocate.
    const cap = Math.ceil(Math.max(triangleCount, 1) * 1.25);
    this.#triangleCapacity = cap;

    this.#positionAttr = new BufferAttribute(new Float32Array(cap * 9), 3).setUsage(
      DynamicDrawUsage,
    );
    this.#colorAttr = new BufferAttribute(new Float32Array(cap * 9), 3).setUsage(DynamicDrawUsage);
    this.#spikeColorAttr = new BufferAttribute(new Float32Array(cap * 12), 4).setUsage(
      DynamicDrawUsage,
    );

    // Triangle and spike meshes share the same position buffer.
    this.#trianglesGeometry!.setAttribute("position", this.#positionAttr);
    this.#trianglesGeometry!.setAttribute("color", this.#colorAttr);
    this.#spikeGeometry!.setAttribute("position", this.#positionAttr);
    this.#spikeGeometry!.setAttribute("color", this.#spikeColorAttr);
  }

  #initTriangleMeshes(): void {
    this.#trianglesGeometry = new BufferGeometry();
    const material = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
    const mesh = new Mesh(this.#trianglesGeometry, material);
    mesh.renderOrder = 1;
    mesh.frustumCulled = false; // oversized buffer; drawRange controls what's drawn
    this.#trianglesMesh = mesh;
    this.#scene.add(mesh);

    this.#spikeGeometry = new BufferGeometry();
    const spikeMaterial = new MeshBasicMaterial({
      vertexColors: true,
      side: DoubleSide,
      transparent: true,
      depthTest: false,
    });
    const spikeMesh = new Mesh(this.#spikeGeometry, spikeMaterial);
    spikeMesh.renderOrder = 3;
    spikeMesh.frustumCulled = false;
    this.#spikeMesh = spikeMesh;
    this.#applySpikeMaterial();
    this.#scene.add(spikeMesh);
  }

  rebuildPoints(points: Point[]): void {
    for (const obj of this.#pointsObjects) {
      this.#scene.remove(obj);
      obj.geometry.dispose();
      (obj.material as Material).dispose();
    }
    this.#pointsObjects = [];

    // Split into background field (border + interior) and modifier points so the
    // two can use different sizes; the modifier layer renders on top.
    const background = points.filter((p) => p.origin !== "modifier");
    const modifier = points.filter((p) => p.origin === "modifier");
    const bg = this.#makePointsObject(background, POINT_SIZE * BG_POINT_SCALE, 4);
    const mod = this.#makePointsObject(modifier, POINT_SIZE, 5);
    for (const obj of [bg, mod]) {
      if (!obj) continue;
      this.#pointsObjects.push(obj);
      this.#scene.add(obj);
    }
    this.#applyPointsMaterial();
    this.#render();
  }

  #makePointsObject(points: Point[], size: number, renderOrder: number): Points | null {
    if (points.length === 0) return null;
    const positions = new Float32Array(points.length * 3);
    const colors = new Float32Array(points.length * 3);
    const scratch = new Color();
    points.forEach((p, i) => {
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = 1;
      const hex = p.origin ? POINT_COLORS[p.origin] : POINT_COLOR_FALLBACK;
      scratch.setHex(hex, SRGBColorSpace);
      colors[i * 3] = scratch.r;
      colors[i * 3 + 1] = scratch.g;
      colors[i * 3 + 2] = scratch.b;
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    const material = new PointsMaterial({
      vertexColors: true,
      size,
      sizeAttenuation: false,
      map: this.#discTexture,
      transparent: true,
      depthTest: false,
    });
    const obj = new Points(geometry, material);
    obj.renderOrder = renderOrder;
    return obj;
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

    const worldW = this.#baseWorldW / this.#zoom;
    const worldH = this.#baseWorldH / this.#zoom;
    this.#centerX = before.x + (0.5 - u) * worldW;
    this.#centerY = before.y + (0.5 - v) * worldH;
    this.#applyCamera();
  }

  pan(screenDx: number, screenDy: number): void {
    const wpp = this.worldPerPixel();
    this.#centerX -= screenDx * wpp;
    this.#centerY -= screenDy * wpp;
    this.#applyCamera();
  }

  worldPerPixel(): number {
    const rect = this.#renderer.domElement.getBoundingClientRect();
    return (this.#camera.right - this.#camera.left) / rect.width;
  }

  setDraftPath(
    outline: { x: number; y: number }[] | null,
    closed: boolean,
    handles: { x: number; y: number }[] = [],
  ): void {
    if (this.#draftLine) this.#disposeOverlay(this.#draftLine, this.#draftDots);
    this.#draftLine = null;
    this.#draftDots = null;

    if (outline && outline.length > 0) {
      // Same color as the edit-mode highlight so creating and editing a modifier
      // look identical.
      this.#draftLine = this.#makePathLine(this.#closeLoop(outline, closed), MODIFIER_COLOR);
      this.#draftDots = this.#makePathDots(handles.length ? handles : outline, MODIFIER_COLOR);
      this.#scene.add(this.#draftLine, this.#draftDots);
    }
    this.#render();
  }

  setHighlightedPath(
    outline: { x: number; y: number }[] | null,
    closed: boolean,
    handles: { x: number; y: number }[] = [],
  ): void {
    if (this.#highlightLine) this.#disposeOverlay(this.#highlightLine, this.#highlightDots);
    this.#highlightLine = null;
    this.#highlightDots = null;

    if (outline && outline.length > 0) {
      this.#highlightLine = this.#makePathLine(this.#closeLoop(outline, closed), MODIFIER_COLOR);
      this.#highlightDots = this.#makePathDots(handles.length ? handles : outline, MODIFIER_COLOR);
      this.#scene.add(this.#highlightLine, this.#highlightDots);
    }
    this.#render();
  }

  setHoverPath(outline: { x: number; y: number }[] | null, closed: boolean): void {
    if (this.#hoverLine) this.#disposeOverlay(this.#hoverLine, null);
    this.#hoverLine = null;

    if (outline && outline.length > 0) {
      this.#hoverLine = this.#makePathLine(this.#closeLoop(outline, closed), HOVER_COLOR);
      this.#hoverLine.renderOrder = 8;
      this.#scene.add(this.#hoverLine);
    }
    this.#render();
  }

  setNearbyPaths(paths: { outline: { x: number; y: number }[]; closed: boolean }[]): void {
    for (const line of this.#nearbyLines) this.#disposeOverlay(line, null);
    this.#nearbyLines = [];

    for (const { outline, closed } of paths) {
      if (outline.length === 0) continue;
      const line = this.#makePathLine(this.#closeLoop(outline, closed), HOVER_COLOR);
      (line.material as Material).opacity = 0.3;
      line.renderOrder = 5;
      this.#nearbyLines.push(line);
      this.#scene.add(line);
    }
    this.#render();
  }

  // Bezier tangent handles: each segment is one anchor->handle-end whisker, with
  // a dot at every handle end. Shares one layer between the selected curve and
  // the in-progress draft (only one is ever shown at a time).
  setHandleWhiskers(
    segments: [{ x: number; y: number }, { x: number; y: number }][],
    dots: { x: number; y: number }[],
    color = MODIFIER_COLOR,
  ): void {
    for (const line of this.#whiskerLines) this.#disposeOverlay(line, null);
    this.#whiskerLines = [];
    if (this.#whiskerDots) this.#disposeOverlay(null, this.#whiskerDots);
    this.#whiskerDots = null;

    for (const [a, b] of segments) {
      const line = this.#makePathLine([a, b], color);
      (line.material as Material).opacity = 0.6;
      line.renderOrder = 6;
      this.#whiskerLines.push(line);
      this.#scene.add(line);
    }
    if (dots.length > 0) {
      this.#whiskerDots = this.#makePathDots(dots, color, 10.5, false);
      this.#scene.add(this.#whiskerDots);
    }
    this.#render();
  }

  #closeLoop(pts: { x: number; y: number }[], closed: boolean): { x: number; y: number }[] {
    if (!closed || pts.length < 2) return pts;
    return [...pts, pts[0]];
  }

  #buildImageMesh(
    image: ImageRef,
    texture: Texture,
    z: number,
    renderOrder: number,
    transparent: boolean,
  ): Mesh {
    const geometry = new PlaneGeometry(image.width, image.height);
    const material = new MeshBasicMaterial({
      map: texture,
      transparent,
      depthTest: false,
      side: DoubleSide,
    });
    const mesh = new Mesh(geometry, material);
    mesh.position.set(image.width / 2, image.height / 2, z);
    mesh.scale.y = -1;
    mesh.renderOrder = renderOrder;
    return mesh;
  }

  #applyOverlayMaterial(): void {
    if (!this.#overlayMesh) return;
    const material = this.#overlayMesh.material as MeshBasicMaterial;
    material.opacity = this.#overlayOpacity;
    this.#overlayMesh.visible = this.#overlayOpacity > 0;
  }

  #applyPointsMaterial(): void {
    for (const obj of this.#pointsObjects) {
      (obj.material as PointsMaterial).opacity = this.#pointsOpacity;
      obj.visible = this.#pointsOpacity > 0;
    }
  }

  #applySpikeMaterial(): void {
    if (!this.#spikeMesh) return;
    const material = this.#spikeMesh.material as MeshBasicMaterial;
    material.opacity = this.#spikeOpacity;
    this.#spikeMesh.visible = this.#spikeOpacity > 0;
  }

  #makePathLine(pts: { x: number; y: number }[], color: number): Line {
    const positions = new Float32Array(pts.length * 3);
    pts.forEach((p, i) => {
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = 2;
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    const material = new LineBasicMaterial({ color, transparent: true, depthTest: false });
    const line = new Line(geometry, material);
    line.renderOrder = 6;
    return line;
  }

  #makePathDots(pts: { x: number; y: number }[], color: number, size = 9, round = true): Points {
    const positions = new Float32Array(pts.length * 3);
    pts.forEach((p, i) => {
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = 2;
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    // Without a sprite map PointsMaterial renders square points, used for the
    // bezier handle ends to set them apart from the round anchors.
    const material = new PointsMaterial({
      color,
      size,
      sizeAttenuation: false,
      map: round ? this.#discTexture : null,
      transparent: true,
      depthTest: false,
    });
    const dots = new Points(geometry, material);
    dots.renderOrder = 7;
    return dots;
  }

  #disposeOverlay(line: Line | null, dots: Points | null): void {
    for (const obj of [line, dots]) {
      if (!obj) continue;
      this.#scene.remove(obj);
      obj.geometry.dispose();
      (obj.material as Material).dispose();
    }
  }

  #disposeImageMeshes(): void {
    for (const mesh of [this.#backgroundMesh, this.#overlayMesh]) {
      if (!mesh) continue;
      this.#scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as Material).dispose();
    }
    this.#backgroundMesh = null;
    this.#overlayMesh = null;
    if (this.#imageTexture) {
      this.#imageTexture.dispose();
      this.#imageTexture = null;
    }
  }

  #applyCamera(): void {
    const w = this.#container.clientWidth;
    const h = this.#container.clientHeight;
    if (w === 0 || h === 0) return;
    this.#renderer.setSize(w, h, false);

    const stageAspect = w / h;
    const imgW = this.#image?.width ?? w;
    const imgH = this.#image?.height ?? h;

    const needW = imgW * MARGIN;
    const needH = imgH * MARGIN;
    if (needW / needH > stageAspect) {
      this.#baseWorldW = needW;
      this.#baseWorldH = needW / stageAspect;
    } else {
      this.#baseWorldH = needH;
      this.#baseWorldW = needH * stageAspect;
    }

    const worldW = this.#baseWorldW / this.#zoom;
    const worldH = this.#baseWorldH / this.#zoom;

    const boundsW = this.#image?.width ?? 0;
    const boundsH = this.#image?.height ?? 0;
    this.#centerX = Math.min(Math.max(this.#centerX, -worldW / 2), boundsW + worldW / 2);
    this.#centerY = Math.min(Math.max(this.#centerY, -worldH / 2), boundsH + worldH / 2);

    this.#camera.left = this.#centerX - worldW / 2;
    this.#camera.right = this.#centerX + worldW / 2;
    this.#camera.top = this.#centerY - worldH / 2;
    this.#camera.bottom = this.#centerY + worldH / 2;
    this.#camera.updateProjectionMatrix();

    this.#render();
  }

  #render(): void {
    if (this.#renderScheduled) return;
    this.#renderScheduled = true;
    requestAnimationFrame(() => {
      this.#renderScheduled = false;
      this.#renderer.render(this.#scene, this.#camera);
    });
  }
}

function createDiscTexture(): Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
