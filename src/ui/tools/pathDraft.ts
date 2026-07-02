import { newModifierUUID } from "../../document/ids.js";
import { type PathInterpolation } from "../../document/types.js";
import {
  catmullRomOutline,
  defaultCatmullRomPointCount,
} from "../../domain/modifiers/catmullrom.js";
import { getToolSettings } from "../../settings/store.js";
import { ToolDraft, type DraftEnv } from "./draft.js";
import type { Vector2 } from "./geometry.js";

// The polyline / catmull-rom tools: click to drop vertices, click the first vertex again
// to close, Space to commit as open. The interpolation is fixed for the draft's lifetime.
export class PathDraft extends ToolDraft {
  readonly #interpolation: PathInterpolation;
  #vertices: Vector2[] = [];
  #cursor?: Vector2;

  constructor(env: DraftEnv, interpolation: PathInterpolation) {
    super(env);
    this.#interpolation = interpolation;
  }

  override click(point: Vector2): void {
    if (this.#vertices.length >= 2 && this.near(point, this.#vertices[0])) {
      this.#commit(true);
      return;
    }
    this.#vertices.push(point);
    this.#render();
  }

  override pointerMove(point: Vector2): void {
    this.#cursor = point;
    this.#render();
  }

  override commitOpen(): boolean {
    this.#commit(false);
    return true;
  }

  override hasContent(): boolean {
    return this.#vertices.length > 0;
  }

  override reset(): void {
    this.#vertices = [];
    this.#cursor = undefined;
    this.env.preview.setDraftPath(null, false);
  }

  #commit(closed: boolean): void {
    if (this.#vertices.length < 2) {
      this.reset();
      return;
    }
    const vertices = this.#vertices.map((vertex) => ({ x: vertex.x, y: vertex.y }));
    const catmull = this.#interpolation === "catmullrom";
    this.env.commit({
      uuid: newModifierUUID(),
      kind: "path",
      interpolation: this.#interpolation,
      vertices,
      closed,
      pointCount: catmull
        ? defaultCatmullRomPointCount(vertices, closed, getToolSettings().catmullDensity)
        : vertices.length,
    });
    this.reset();
  }

  #render(): void {
    const color = this.env.draftColor();
    const path = this.#cursor ? [...this.#vertices, this.#cursor] : this.#vertices.slice();
    const outline =
      this.#interpolation === "catmullrom" && path.length >= 2
        ? catmullRomOutline(path, false)
        : path;
    this.env.preview.setDraftPath(outline, false, this.#vertices, color);
  }
}
