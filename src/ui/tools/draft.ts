import type { Modifier } from "../../document/types.js";
import type { Preview } from "../../preview/preview.js";
import { GRAB_RADIUS_PX } from "./constants.js";
import type { Vector2 } from "./geometry.js";

// What a draft needs from its host to preview and finish a shape. The controller supplies
// it: `preview` for the draft overlay, `draftColor` for the group tint the finished shape
// will take, and `commit` to hand a finished modifier back into the document.
export interface DraftEnv {
  readonly preview: Preview;
  draftColor(): number | undefined;
  commit(modifier: Modifier): void;
}

// One in-progress modifier being drawn by a tool. The controller creates the matching
// draft when a drawing tool activates and routes raw click/pointer input to it; the draft
// owns its accumulated points and renders its own preview overlay. All input coordinates
// are image-space (the controller converts from screen). A draft resets itself after a
// commit, so the tool stays armed for the next shape.
export abstract class ToolDraft {
  protected readonly env: DraftEnv;

  constructor(env: DraftEnv) {
    this.env = env;
  }

  // Click-driven tools (path, circle) place points here; the pointer-driven bezier pen
  // leaves this as the default no-op.
  click(_point: Vector2): void {}

  // The bezier pen drives placement from pointer events; the click-driven tools no-op.
  pointerDown(_point: Vector2): void {}
  pointerUp(): void {}

  // Live cursor movement (hover rubber-band, or the bezier pen pulling a handle).
  abstract pointerMove(point: Vector2): void;

  // Space: commit the shape as open where that is meaningful. Returns true if the tool
  // handled it (so the caller can swallow the key); the circle tools return the default
  // false.
  commitOpen(): boolean {
    return false;
  }

  // Whether anything has been placed yet (drives Escape: clear the draft vs deactivate).
  abstract hasContent(): boolean;

  // Discard everything drawn so far and clear the preview overlay.
  abstract reset(): void;

  // Whether two image-space points are within one screen-space grab radius (close snap).
  protected near(a: Vector2, b: Vector2): boolean {
    const radius = GRAB_RADIUS_PX * this.env.preview.worldPerPixel();
    return Math.hypot(a.x - b.x, a.y - b.y) <= radius;
  }
}
