import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Mesh,
  MeshBasicMaterial,
  Scene,
  SRGBColorSpace,
} from "three";
import { triangleSpike } from "../domain/triangleQuality.js";

// Spare fraction added when the triangle buffers grow, so the per-frame count
// wiggling during a drag does not trigger a reallocation every frame.
const CAPACITY_HEADROOM = 1.25;

// The colored triangulation plus an overlaid "spike" mesh that tints sliver
// triangles red. Both meshes share one position buffer, grown with headroom and
// reused across drags (never reallocated per frame); `drawRange` selects the live
// triangle count and the tail is left unused.
export class TriangleLayer {
  readonly #scene: Scene;
  readonly #requestRender: () => void;

  #trianglesMesh?: Mesh;
  #spikeMesh?: Mesh;

  #trianglesGeometry?: BufferGeometry;
  #spikeGeometry?: BufferGeometry;
  #positionAttr?: BufferAttribute;
  #colorAttr?: BufferAttribute;
  #spikeColorAttr?: BufferAttribute;
  #triangleCapacity = 0;
  #triangleCount = 0;
  #spikeDirty = false;
  #spikeOpacity = 0;

  constructor(scene: Scene, requestRender: () => void) {
    this.#scene = scene;
    this.#requestRender = requestRender;
  }

  /**
   * Upload triangle geometry from flat buffers (built by `buildGeometry`): positions
   * are xyz per vertex (9/triangle), colors are rgb per triangle (3). No UUID->Point
   * resolution or cloning - positions are a straight memcpy, colors expand per vertex.
   */
  setGeometry(positions: Float32Array, colors: Uint8Array, count: number): void {
    this.#ensureCapacity(count);

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

    this.#requestRender();
  }

  /**
   * Update only triangle colors against the existing geometry (positions unchanged).
   * Used for the async color-worker result, which recolors the same triangle set.
   */
  setColors(colors: Uint8Array, count: number): void {
    if (!this.#colorAttr || count !== this.#triangleCount) return;
    this.#writeColors(colors, count);
    this.#colorAttr.needsUpdate = true;
    this.#requestRender();
  }

  setSpikeOpacity(value: number): void {
    this.#spikeOpacity = Math.min(1, Math.max(0, value));
    // Spike colors are skipped while hidden; fill them in when first shown.
    if (this.#spikeOpacity > 0 && this.#spikeDirty) this.#rebuildSpike();
    this.#applySpikeMaterial();
    this.#requestRender();
  }

  #rebuildSpike(): void {
    if (!this.#spikeGeometry || !this.#spikeColorAttr || !this.#positionAttr) return;
    const positions = this.#trianglePositions();
    const spikeColors = this.#spikeColorsArray();
    const count = this.#triangleCount;
    for (let t = 0; t < count; t++) {
      const positionOffset = t * 9;
      const spike = triangleSpike(
        positions[positionOffset],
        positions[positionOffset + 1],
        positions[positionOffset + 3],
        positions[positionOffset + 4],
        positions[positionOffset + 6],
        positions[positionOffset + 7],
      );
      const colorOffset = t * 12;
      for (let v = 0; v < 12; v += 4) {
        spikeColors[colorOffset + v] = 1;
        spikeColors[colorOffset + v + 1] = 0;
        spikeColors[colorOffset + v + 2] = 0;
        spikeColors[colorOffset + v + 3] = spike;
      }
    }
    this.#spikeColorAttr.needsUpdate = true;
    this.#spikeGeometry.setDrawRange(0, count * 3);
    this.#spikeDirty = false;
  }

  // Expand per-triangle rgb (0-255) to per-vertex linear color. sRGB->linear is the
  // expensive step, so it runs once per triangle, not per vertex.
  #writeColors(colors: Uint8Array, count: number): void {
    const out = this.#triangleColors();
    const scratch = new Color();
    for (let t = 0; t < count; t++) {
      const colorIndex = t * 3;
      scratch.setRGB(
        colors[colorIndex] / 255,
        colors[colorIndex + 1] / 255,
        colors[colorIndex + 2] / 255,
        SRGBColorSpace,
      );
      const offset = t * 9;
      const red = scratch.r;
      const green = scratch.g;
      const blue = scratch.b;
      out[offset] = red;
      out[offset + 1] = green;
      out[offset + 2] = blue;
      out[offset + 3] = red;
      out[offset + 4] = green;
      out[offset + 5] = blue;
      out[offset + 6] = red;
      out[offset + 7] = green;
      out[offset + 8] = blue;
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

  #ensureCapacity(triangleCount: number): void {
    if (!this.#trianglesGeometry) this.#initMeshes();
    if (this.#positionAttr && triangleCount <= this.#triangleCapacity) return;

    const capacity = Math.ceil(Math.max(triangleCount, 1) * CAPACITY_HEADROOM);
    this.#triangleCapacity = capacity;

    this.#positionAttr = new BufferAttribute(new Float32Array(capacity * 9), 3).setUsage(
      DynamicDrawUsage,
    );
    this.#colorAttr = new BufferAttribute(new Float32Array(capacity * 9), 3).setUsage(
      DynamicDrawUsage,
    );
    this.#spikeColorAttr = new BufferAttribute(new Float32Array(capacity * 12), 4).setUsage(
      DynamicDrawUsage,
    );

    // Triangle and spike meshes share the same position buffer.
    this.#trianglesGeometry!.setAttribute("position", this.#positionAttr);
    this.#trianglesGeometry!.setAttribute("color", this.#colorAttr);
    this.#spikeGeometry!.setAttribute("position", this.#positionAttr);
    this.#spikeGeometry!.setAttribute("color", this.#spikeColorAttr);
  }

  #initMeshes(): void {
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

  #applySpikeMaterial(): void {
    if (!this.#spikeMesh) return;
    const material = this.#spikeMesh.material as MeshBasicMaterial;
    material.opacity = this.#spikeOpacity;
    this.#spikeMesh.visible = this.#spikeOpacity > 0;
  }
}
