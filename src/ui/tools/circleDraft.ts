import { newModifierUUID } from "../../document/types.js";
import { circleOutline } from "../../domain/modifiers/circle.js";
import { CIRCLE_DEFAULT_POINTS } from "./constants.js";
import { ToolDraft } from "./draft.js";
import type { Vector2 } from "./geometry.js";

// The circle tool: first click sets the edge point, second click sets the center and
// commits. The rubber-band previews the circle through the pending edge.
export class CircleDraft extends ToolDraft {
  #firstPoint?: Vector2;
  #cursor?: Vector2;

  override click(point: Vector2): void {
    if (!this.#firstPoint) {
      this.#firstPoint = point;
      this.#render();
      return;
    }
    this.env.commit({
      uuid: newModifierUUID(),
      kind: "circle",
      center: { x: point.x, y: point.y },
      edge: { x: this.#firstPoint.x, y: this.#firstPoint.y },
      pointCount: CIRCLE_DEFAULT_POINTS,
    });
    this.reset();
  }

  override pointerMove(point: Vector2): void {
    this.#cursor = point;
    this.#render();
  }

  override hasContent(): boolean {
    return this.#firstPoint !== undefined;
  }

  override reset(): void {
    this.#firstPoint = undefined;
    this.#cursor = undefined;
    this.env.preview.setDraftPath(null, false);
  }

  #render(): void {
    if (this.#firstPoint && this.#cursor) {
      const outline = circleOutline(this.#cursor, this.#firstPoint);
      this.env.preview.setDraftPath(
        outline,
        true,
        [this.#cursor, this.#firstPoint],
        this.env.draftColor(),
      );
    } else {
      this.env.preview.setDraftPath(null, false);
    }
  }
}
