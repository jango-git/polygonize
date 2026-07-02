import { updateModifier } from "../../document/commands/modifierCommands.js";
import { beginGesture, endGesture } from "../../document/history.js";
import { getModifiers } from "../../document/selectors/document.js";
import type { Modifier, ModifierUUID } from "../../document/types.js";
import type { Vector2 } from "./geometry.js";
import { BezierHandle, type BezierTarget } from "./hitTest.js";

// What a drag is moving: a plain control point (a path vertex, or a circle center/edge by
// index) or a specific bezier anchor/handle.
export type DragTarget =
  | { readonly kind: "control"; readonly index: number }
  | { readonly kind: "bezier"; readonly target: BezierTarget };

// One continuous control-point drag, from pointerdown to pointerup. Owns three concerns
// that used to be loose fields on the controller:
//  - undo bracketing: the constructor opens a history gesture and finish()/cancel() close
//    it, so a drag is always exactly one undo step and the gesture depth can never leak;
//  - frame coalescing: pointer moves collapse to one pipeline run per animation frame,
//    since each apply triggers a ~100ms pipeline pass;
//  - staleness guards: every apply re-resolves the modifier by uuid and bounds-checks the
//    index, so a structure change mid-drag (or a vanished modifier) is a no-op, not a crash.
export class DragSession {
  readonly #modifier: ModifierUUID;
  readonly #target: DragTarget;
  readonly #onApplied: () => void;
  #pendingPoint?: Vector2;
  #frameHandle = 0;
  #open = true;

  constructor(modifier: ModifierUUID, target: DragTarget, onApplied: () => void) {
    this.#modifier = modifier;
    this.#target = target;
    this.#onApplied = onApplied;
    beginGesture();
  }

  // Queue a new pointer position. Coalesced to one apply per animation frame; the latest
  // position wins, intermediate ones are dropped.
  move(point: Vector2): void {
    if (!this.#open) return;
    this.#pendingPoint = point;
    if (this.#frameHandle === 0) {
      this.#frameHandle = requestAnimationFrame(() => this.#flush());
    }
  }

  // Commit the final queued position and close the undo gesture. Idempotent.
  finish(): void {
    if (!this.#open) return;
    this.#cancelFrame();
    const point = this.#pendingPoint;
    this.#pendingPoint = undefined;
    if (point) this.#apply(point);
    this.#close();
  }

  // Abandon the drag without committing the pending position (the source was replaced out
  // from under us), still closing the undo gesture. Idempotent.
  cancel(): void {
    if (!this.#open) return;
    this.#cancelFrame();
    this.#pendingPoint = undefined;
    this.#close();
  }

  #flush(): void {
    this.#frameHandle = 0;
    const point = this.#pendingPoint;
    this.#pendingPoint = undefined;
    if (point && this.#open) this.#apply(point);
  }

  #cancelFrame(): void {
    if (this.#frameHandle !== 0) {
      cancelAnimationFrame(this.#frameHandle);
      this.#frameHandle = 0;
    }
  }

  #close(): void {
    this.#open = false;
    endGesture();
  }

  #apply(point: Vector2): void {
    const modifier = getModifiers().find((candidate) => candidate.uuid === this.#modifier);
    if (!modifier) return;
    if (this.#target.kind === "bezier") {
      applyBezierDrag(modifier, this.#target.target, point);
    } else {
      applyControlDrag(modifier, this.#target.index, point);
    }
    this.#onApplied();
  }
}

function applyBezierDrag(modifier: Modifier, target: BezierTarget, point: Vector2): void {
  if (modifier.kind !== "bezier") return;
  const anchors = modifier.anchors.map((anchor) => ({ ...anchor }));
  const anchor = anchors[target.index];
  if (!anchor) return;
  if (target.handle === BezierHandle.Anchor) {
    anchor.x = point.x;
    anchor.y = point.y;
  } else if (target.handle === BezierHandle.Outgoing) {
    anchor.hx = point.x - anchor.x;
    anchor.hy = point.y - anchor.y;
  } else {
    // Dragging the incoming handle mirrors it onto the outgoing one.
    anchor.hx = anchor.x - point.x;
    anchor.hy = anchor.y - point.y;
  }
  updateModifier(modifier.uuid, { anchors });
}

function applyControlDrag(modifier: Modifier, index: number, point: Vector2): void {
  if (modifier.kind === "path") {
    if (index < 0 || index >= modifier.vertices.length) return;
    const vertices = modifier.vertices.map((vertex) => ({ x: vertex.x, y: vertex.y }));
    vertices[index] = { x: point.x, y: point.y };
    updateModifier(modifier.uuid, { vertices });
  } else if (modifier.kind === "circle") {
    updateModifier(
      modifier.uuid,
      index === 0 ? { center: { x: point.x, y: point.y } } : { edge: { x: point.x, y: point.y } },
    );
  }
}
