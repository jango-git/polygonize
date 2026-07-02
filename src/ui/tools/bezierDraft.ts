import { newModifierUUID } from "../../document/ids.js";
import {
  type BezierAnchor,
  type BezierModifier,
  type ModifierUUID,
} from "../../document/types.js";
import { bezierOutline, defaultBezierPointCount } from "../../domain/modifiers/bezier.js";
import { bezierWhiskers } from "../highlight.js";
import { ToolDraft } from "./draft.js";
import type { Vector2 } from "./geometry.js";

// The bezier pen, driven by pointer events rather than clicks: a press drops an anchor
// (or, over the first anchor, arms the close gesture); the following drag pulls the
// anchor's symmetric handle; release ends the placement or closes the curve. Space
// commits the curve as open.
export class BezierDraft extends ToolDraft {
  #anchors: BezierAnchor[] = [];
  #placingAnchor = false;
  #closing = false;
  #cursor?: Vector2;

  override pointerDown(point: Vector2): void {
    if (this.#anchors.length >= 2 && this.near(point, this.#anchors[0])) {
      this.#closing = true;
      return;
    }
    this.#anchors.push({ x: point.x, y: point.y, hx: 0, hy: 0 });
    this.#placingAnchor = true;
    this.#cursor = point;
    this.#render();
  }

  override pointerMove(point: Vector2): void {
    if (this.#placingAnchor) {
      // Live-update the symmetric handle of the anchor being placed (draft only).
      const anchor = this.#anchors[this.#anchors.length - 1];
      anchor.hx = point.x - anchor.x;
      anchor.hy = point.y - anchor.y;
    }
    this.#cursor = point;
    this.#render();
  }

  override pointerUp(): void {
    if (this.#closing) {
      this.#commit(true);
    } else if (this.#placingAnchor) {
      this.#placingAnchor = false;
      this.#render();
    }
  }

  override commitOpen(): boolean {
    this.#commit(false);
    return true;
  }

  override hasContent(): boolean {
    return this.#anchors.length > 0;
  }

  override reset(): void {
    this.#anchors = [];
    this.#placingAnchor = false;
    this.#closing = false;
    this.#cursor = undefined;
    this.env.preview.setDraftPath(null, false);
    this.env.preview.setHandleWhiskers([], []);
  }

  #commit(closed: boolean): void {
    if (this.#anchors.length < 2) {
      this.reset();
      return;
    }
    const anchors = this.#anchors.map((anchor) => ({
      x: anchor.x,
      y: anchor.y,
      hx: anchor.hx,
      hy: anchor.hy,
    }));
    const modifier: BezierModifier = {
      uuid: newModifierUUID(),
      kind: "bezier",
      anchors,
      closed,
      pointCount: 2,
    };
    modifier.pointCount = defaultBezierPointCount(modifier);
    this.env.commit(modifier);
    this.reset();
  }

  #render(): void {
    if (this.#anchors.length === 0) {
      this.env.preview.setDraftPath(null, false);
      this.env.preview.setHandleWhiskers([], []);
      return;
    }
    // While hovering (not dragging a handle) append a zero-handle phantom anchor at the
    // cursor so the next segment previews as a real curve.
    const previewAnchors =
      !this.#placingAnchor && this.#cursor
        ? [...this.#anchors, { x: this.#cursor.x, y: this.#cursor.y, hx: 0, hy: 0 }]
        : this.#anchors;
    const draftModifier: BezierModifier = {
      uuid: "" as ModifierUUID,
      kind: "bezier",
      anchors: previewAnchors,
      closed: false,
      pointCount: 2,
    };
    const outline = bezierOutline(draftModifier);
    const dots = this.#anchors.map((anchor) => ({ x: anchor.x, y: anchor.y }));
    const color = this.env.draftColor();
    this.env.preview.setDraftPath(outline.length ? outline : null, false, dots, color);
    const whiskers = bezierWhiskers(draftModifier);
    this.env.preview.setHandleWhiskers(whiskers.segments, whiskers.dots, color);
  }
}
