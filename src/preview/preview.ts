import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
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
import type { ImageRef, Point, Triangle } from "../document/types.js";
import { triangleSpike } from "../domain/triangleQuality.js";

const MARGIN = 1.08;
const MIN_ZOOM = 1;
const MAX_ZOOM = 60;
const HOVER_COLOR = 0x33d6ff;

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
  #pointsObject: Points | null = null;

  #draftLine: Line | null = null;
  #draftDots: Points | null = null;
  #highlightLine: Line | null = null;
  #highlightDots: Points | null = null;
  #hoverLine: Line | null = null;
  #nearbyLines: Line[] = [];

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
    this.#applySpikeMaterial();
    this.#render();
  }

  setBackground(cssColor: string): void {
    (this.#scene.background as Color).set(cssColor);
    this.#render();
  }

  rebuildTriangles(triangles: Triangle[], points: Map<string, Point>): void {
    this.#disposeTriangleMeshes();

    if (triangles.length > 0) {
      const positions = new Float32Array(triangles.length * 9);
      const colors = new Float32Array(triangles.length * 9);
      const spikeColors = new Float32Array(triangles.length * 12);
      const scratch = new Color();

      triangles.forEach((tri, t) => {
        const a = points.get(tri.a);
        const b = points.get(tri.b);
        const c = points.get(tri.c);
        const verts = [a, b, c];
        const spike = a && b && c ? triangleSpike(a.x, a.y, b.x, b.y, c.x, c.y) : 0;

        for (let v = 0; v < 3; v++) {
          const p = verts[v];
          const o = t * 9 + v * 3;
          positions[o] = p ? p.x : 0;
          positions[o + 1] = p ? p.y : 0;
          positions[o + 2] = 0;
          scratch.setRGB(tri.color.r / 255, tri.color.g / 255, tri.color.b / 255, SRGBColorSpace);
          colors[o] = scratch.r;
          colors[o + 1] = scratch.g;
          colors[o + 2] = scratch.b;

          const so = t * 12 + v * 4;
          spikeColors[so] = 1;
          spikeColors[so + 1] = 0;
          spikeColors[so + 2] = 0;
          spikeColors[so + 3] = spike;
        }
      });

      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      geometry.setAttribute("color", new BufferAttribute(colors, 3));
      const material = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
      const mesh = new Mesh(geometry, material);
      mesh.renderOrder = 1;
      this.#trianglesMesh = mesh;
      this.#scene.add(mesh);

      const spikeGeometry = new BufferGeometry();
      spikeGeometry.setAttribute("position", new BufferAttribute(positions, 3));
      spikeGeometry.setAttribute("color", new BufferAttribute(spikeColors, 4));
      const spikeMaterial = new MeshBasicMaterial({
        vertexColors: true,
        side: DoubleSide,
        transparent: true,
        depthTest: false,
      });
      const spikeMesh = new Mesh(spikeGeometry, spikeMaterial);
      spikeMesh.renderOrder = 3;
      this.#spikeMesh = spikeMesh;
      this.#applySpikeMaterial();
      this.#scene.add(spikeMesh);
    }

    this.#render();
  }

  #disposeTriangleMeshes(): void {
    for (const mesh of [this.#trianglesMesh, this.#spikeMesh]) {
      if (!mesh) continue;
      this.#scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as Material).dispose();
    }
    this.#trianglesMesh = null;
    this.#spikeMesh = null;
  }

  rebuildPoints(points: Point[]): void {
    if (this.#pointsObject) {
      this.#scene.remove(this.#pointsObject);
      this.#pointsObject.geometry.dispose();
      (this.#pointsObject.material as Material).dispose();
      this.#pointsObject = null;
    }

    if (points.length > 0) {
      const positions = new Float32Array(points.length * 3);
      points.forEach((p, i) => {
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = 1;
      });
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      const material = new PointsMaterial({
        color: 0xffffff,
        size: 7,
        sizeAttenuation: false,
        map: this.#discTexture,
        transparent: true,
        depthTest: false,
      });
      const obj = new Points(geometry, material);
      obj.renderOrder = 4;
      this.#pointsObject = obj;
      this.#applyPointsMaterial();
      this.#scene.add(obj);
    }

    this.#render();
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
      this.#draftLine = this.#makePathLine(this.#closeLoop(outline, closed), 0x4a90d9);
      this.#draftDots = this.#makePathDots(handles.length ? handles : outline, 0x4a90d9);
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
      this.#highlightLine = this.#makePathLine(this.#closeLoop(outline, closed), 0xffcc33);
      this.#highlightDots = this.#makePathDots(handles.length ? handles : outline, 0xffcc33);
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
    if (!this.#pointsObject) return;
    const material = this.#pointsObject.material as PointsMaterial;
    material.opacity = this.#pointsOpacity;
    this.#pointsObject.visible = this.#pointsOpacity > 0;
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

  #makePathDots(pts: { x: number; y: number }[], color: number): Points {
    const positions = new Float32Array(pts.length * 3);
    pts.forEach((p, i) => {
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = 2;
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    const material = new PointsMaterial({
      color,
      size: 9,
      sizeAttenuation: false,
      map: this.#discTexture,
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
