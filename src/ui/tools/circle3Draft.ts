import { newModifierUUID } from "../../document/ids.js";
import { circleOutline, circumcircle } from "../../domain/modifiers/circle.js";
import { CIRCLE_DEFAULT_POINTS } from "./constants.js";
import { ToolDraft } from "./draft.js";
import type { Vector2 } from "./geometry.js";

// The 3-point circle tool: click three points, and the circle through them is committed.
// After two points the rubber-band previews the circle through the current cursor.
export class Circle3Draft extends ToolDraft {
  #vertices: Vector2[] = [];
  #cursor?: Vector2;

  override click(point: Vector2): void {
    this.#vertices.push({ x: point.x, y: point.y });
    if (this.#vertices.length < 3) {
      this.#render();
      return;
    }
    const [a, b, c] = this.#vertices;
    const circle = circumcircle(a, b, c);
    if (circle) {
      this.env.commit({
        uuid: newModifierUUID(),
        kind: "circle",
        center: { x: circle.center.x, y: circle.center.y },
        edge: { x: circle.edge.x, y: circle.edge.y },
        pointCount: CIRCLE_DEFAULT_POINTS,
      });
    }
    this.reset();
  }

  override pointerMove(point: Vector2): void {
    this.#cursor = point;
    this.#render();
  }

  override hasContent(): boolean {
    return this.#vertices.length > 0;
  }

  override reset(): void {
    this.#vertices = [];
    this.#cursor = undefined;
    this.env.preview.setDraftPath(null, false);
  }

  #render(): void {
    const color = this.env.draftColor();
    const points = this.#cursor ? [...this.#vertices, this.#cursor] : this.#vertices.slice();
    const circle =
      this.#vertices.length >= 2 && this.#cursor
        ? circumcircle(this.#vertices[0], this.#vertices[1], this.#cursor)
        : undefined;
    if (circle) {
      this.env.preview.setDraftPath(circleOutline(circle.center, circle.edge), true, points, color);
    } else {
      this.env.preview.setDraftPath(points.length ? points : null, false, points, color);
    }
  }
}
