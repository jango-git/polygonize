import {
  DoubleSide,
  Material,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from "three";
import type { ImageRef } from "../document/types.js";

// The source image as a single variable-opacity overlay plane drawn on top of the
// triangulation, so the user can fade the original back in over the triangles. No
// opaque background plane: the triangulation covers the whole image rectangle, so
// a background would only be visible in the brief window before the first
// triangulation - not worth the per-frame overdraw. The texture is kept regardless
// of opacity because the inverted field points sample it (see PointLayer).
export class ImageLayer {
  readonly #scene: Scene;
  readonly #requestRender: () => void;

  #imageTexture?: Texture;
  #overlayMesh?: Mesh;
  #overlayOpacity = 0;

  constructor(scene: Scene, requestRender: () => void) {
    this.#scene = scene;
    this.#requestRender = requestRender;
  }

  get imageTexture(): Texture | undefined {
    return this.#imageTexture;
  }

  setImage(image: ImageRef | undefined): void {
    this.#disposeMeshes();

    if (image) {
      this.#imageTexture = new TextureLoader().load(image.src, () => this.#requestRender());
      this.#imageTexture.colorSpace = SRGBColorSpace;

      this.#overlayMesh = this.#buildOverlayMesh(image, this.#imageTexture);
      this.#applyOverlayMaterial();
      this.#scene.add(this.#overlayMesh);
    }
  }

  setOverlayOpacity(value: number): void {
    this.#overlayOpacity = Math.min(1, Math.max(0, value));
    this.#applyOverlayMaterial();
    this.#requestRender();
  }

  #buildOverlayMesh(image: ImageRef, texture: Texture): Mesh {
    const geometry = new PlaneGeometry(image.width, image.height);
    const material = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      side: DoubleSide,
    });
    const mesh = new Mesh(geometry, material);
    // Centered over the image; scale.y = -1 flips the texture so image (0,0) maps
    // to world (0,0) (Y down). renderOrder 2 draws it above the triangulation.
    mesh.position.set(image.width / 2, image.height / 2, 0.5);
    mesh.scale.y = -1;
    mesh.renderOrder = 2;
    return mesh;
  }

  #applyOverlayMaterial(): void {
    if (!this.#overlayMesh) return;
    const material = this.#overlayMesh.material as MeshBasicMaterial;
    material.opacity = this.#overlayOpacity;
    this.#overlayMesh.visible = this.#overlayOpacity > 0;
  }

  #disposeMeshes(): void {
    if (this.#overlayMesh) {
      this.#scene.remove(this.#overlayMesh);
      this.#overlayMesh.geometry.dispose();
      (this.#overlayMesh.material as Material).dispose();
      this.#overlayMesh = undefined;
    }
    if (this.#imageTexture) {
      this.#imageTexture.dispose();
      this.#imageTexture = undefined;
    }
  }
}
