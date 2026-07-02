import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Material,
  Points,
  PointsMaterial,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  WebGLRenderer,
} from "three";
import { PointOrigin, type ImageRef, type Point } from "../document/types.js";
import { MODIFIER_COLOR } from "./palette.js";
import { INVERTED_POINT_FRAG, INVERTED_POINT_VERT } from "./shaders.js";

const POINT_COLORS: Record<PointOrigin, number> = {
  [PointOrigin.BORDER]: 0xd98844,
  [PointOrigin.MODIFIER]: MODIFIER_COLOR,
  [PointOrigin.INTERIOR]: 0xcccccc,
};
const POINT_COLOR_FALLBACK = 0xcccccc;
const POINT_SIZE = 7;
// Background field points (border + interior) render smaller than modifier points
// so the active modifier reads clearly against the field.
const BACKGROUND_POINT_SCALE = 0.75;

// The seed-point overlay, split into three layers: border, interior, and modifier.
// Interior points draw the inverse of the image pixel behind them (so they stay
// legible over any background); the others are tinted by origin or group color.
export class PointLayer {
  readonly #scene: Scene;
  readonly #requestRender: () => void;
  readonly #renderer: WebGLRenderer;
  readonly #discTexture: Texture;

  #pointsObjects: Points[] = [];
  #pointsOpacity = 1;

  constructor(
    scene: Scene,
    requestRender: () => void,
    renderer: WebGLRenderer,
    discTexture: Texture,
  ) {
    this.#scene = scene;
    this.#requestRender = requestRender;
    this.#renderer = renderer;
    this.#discTexture = discTexture;
  }

  rebuild(points: Point[], image: ImageRef | undefined, imageTexture: Texture | undefined): void {
    for (const obj of this.#pointsObjects) {
      this.#scene.remove(obj);
      obj.geometry.dispose();
      (obj.material as Material).dispose();
    }
    this.#pointsObjects = [];

    const border = points.filter((p) => p.origin === PointOrigin.BORDER);
    const interior = points.filter(
      (p) => p.origin !== PointOrigin.BORDER && p.origin !== PointOrigin.MODIFIER,
    );
    const modifier = points.filter((p) => p.origin === PointOrigin.MODIFIER);

    const backgroundSize = POINT_SIZE * BACKGROUND_POINT_SCALE;
    const objects = [
      this.#makePointsObject(border, backgroundSize, 4),
      this.#makeInvertedPointsObject(interior, backgroundSize, 4, image, imageTexture),
      this.#makePointsObject(modifier, POINT_SIZE, 5),
    ];
    for (const obj of objects) {
      if (!obj) continue;
      this.#pointsObjects.push(obj);
      this.#scene.add(obj);
    }
    this.#applyMaterial();
    this.#requestRender();
  }

  setOpacity(value: number): void {
    this.#pointsOpacity = Math.min(1, Math.max(0, value));
    this.#applyMaterial();
    this.#requestRender();
  }

  // Default field points whose color is the inverse of the image pixel directly
  // behind each one. The image is sampled per-vertex (one texel at the point
  // center) - cheap, and exactly what we want for a small dot. No per-point color
  // attribute: the vertex shader produces it.
  #makeInvertedPointsObject(
    points: Point[],
    size: number,
    renderOrder: number,
    image: ImageRef | undefined,
    imageTexture: Texture | undefined,
  ): Points | undefined {
    if (points.length === 0) return undefined;
    const positions = new Float32Array(points.length * 3);
    points.forEach((p, i) => {
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = 1;
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));

    const hasImage = Boolean(image && imageTexture);
    const material = new ShaderMaterial({
      uniforms: {
        uImage: { value: imageTexture ?? this.#discTexture },
        uImgSize: { value: [image?.width ?? 1, image?.height ?? 1] },
        uHasImage: { value: hasImage ? 1 : 0 },
        uDisc: { value: this.#discTexture },
        // three multiplies PointsMaterial.size by the pixel ratio when it uploads
        // the uniform; match that so the inverted dots are the same size.
        uSize: { value: size * this.#renderer.getPixelRatio() },
        uOpacity: { value: this.#pointsOpacity },
      },
      vertexShader: INVERTED_POINT_VERT,
      fragmentShader: INVERTED_POINT_FRAG,
      transparent: true,
      depthTest: false,
    });
    const obj = new Points(geometry, material);
    obj.renderOrder = renderOrder;
    return obj;
  }

  #makePointsObject(points: Point[], size: number, renderOrder: number): Points | undefined {
    if (points.length === 0) return undefined;
    const positions = new Float32Array(points.length * 3);
    const colors = new Float32Array(points.length * 3);
    const scratch = new Color();
    points.forEach((p, i) => {
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = 1;
      // Grouped modifier points carry a per-group tint; everything else colors by
      // origin (border/modifier/interior).
      const hex = p.tint ?? (p.origin ? POINT_COLORS[p.origin] : POINT_COLOR_FALLBACK);
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

  #applyMaterial(): void {
    for (const obj of this.#pointsObjects) {
      const material = obj.material as Material;
      if (material instanceof ShaderMaterial)
        material.uniforms.uOpacity.value = this.#pointsOpacity;
      else (material as PointsMaterial).opacity = this.#pointsOpacity;
      obj.visible = this.#pointsOpacity > 0;
    }
  }
}
