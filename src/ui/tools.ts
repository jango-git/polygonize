import { Ferrsign1 } from "ferrsign";
import { addModifier, updateModifier } from "../document/commands/modifiers.js";
import { getModifiers } from "../document/selectors/document.js";
import { getToolSettings } from "../settings/store.js";
import {
  newModifierUUID,
  type BezierAnchor,
  type BezierModifier,
  type Modifier,
  type ModifierUUID,
  type ToolKind,
} from "../document/types.js";
import {
  bezierOutline,
  defaultAnchorHandle,
  defaultBezierPointCount,
} from "../domain/modifiers/bezier.js";
import { catmullRomOutline, defaultCatmullRomPointCount } from "../domain/modifiers/catmullrom.js";
import { circleOutline, circumcircle } from "../domain/modifiers/circle.js";
import type { Preview } from "../preview/preview.js";
import { bezierWhiskers, refreshHighlight } from "./highlight.js";
import { getActiveGroup } from "./activeGroup.js";
import { getSelected, selectionChanged, setSelected } from "./selection.js";

const CLOSE_RADIUS_PX = 10;
const CIRCLE_DEFAULT_POINTS = 24;
const HANDLE_EPS = 1e-3;

type BezierTarget = { index: number; part: "anchor" | "out" | "in" };

function isPathKind(kind: ToolKind): kind is "polyline" | "catmullrom" {
  return kind === "polyline" || kind === "catmullrom";
}

interface Vec {
  x: number;
  y: number;
}

export const activeToolChanged = new Ferrsign1<ToolKind | null>();

export class ToolController {
  readonly #preview: Preview;

  #activeKind: ToolKind | null = null;
  #vertices: Vec[] = [];
  #firstPoint: Vec | null = null;
  #cursor: Vec | null = null;

  #dragging = false;
  #dragIndex = 0;
  #pendingDrag: Vec | null = null;
  #dragRaf = 0;

  // Bezier pen: anchors of the in-progress curve, plus transient flags for the
  // press-drag-release of a single anchor and the close gesture.
  #anchors: BezierAnchor[] = [];
  #placingAnchor = false;
  #closing = false;
  #bezierDrag: BezierTarget | null = null;

  constructor(preview: Preview) {
    this.#preview = preview;
    const canvas = preview.domElement;
    canvas.addEventListener("click", (e) => this.#onClick(e));
    canvas.addEventListener("dblclick", (e) => this.#onDoubleClick(e));
    canvas.addEventListener("pointerdown", (e) => this.#onPointerDown(e));
    canvas.addEventListener("pointermove", (e) => this.#onPointerMove(e));
    window.addEventListener("pointerup", () => this.#onPointerUp());
    window.addEventListener("keydown", (e) => this.#onKey(e));

    selectionChanged.on((uuid) => this.#onSelectionChanged(uuid));
  }

  toggle(kind: ToolKind): void {
    if (this.#activeKind === kind) {
      this.activateCursor();
      return;
    }
    setSelected(null);
    this.#activeKind = kind;
    this.#abortDrawing();
    document.body.style.cursor = "crosshair";
    activeToolChanged.emit(this.#activeKind);
  }

  activateCursor(): void {
    this.#activeKind = null;
    this.#abortDrawing();
    document.body.style.cursor = "";
    setSelected(null);
    activeToolChanged.emit(null);
  }

  #onSelectionChanged(uuid: ModifierUUID | null): void {
    if (uuid !== null && this.#activeKind !== null) {
      this.#activeKind = null;
      this.#abortDrawing();
      document.body.style.cursor = "";
      activeToolChanged.emit(null);
    }
  }

  #onClick(e: MouseEvent): void {
    if (!this.#activeKind) return;
    if (this.#activeKind === "bezier") return; // the pen is driven by pointer events
    const p = this.#preview.screenToImage(e.clientX, e.clientY);
    if (isPathKind(this.#activeKind)) this.#pathClick(p);
    else if (this.#activeKind === "circle3") this.#circle3Click(p);
    else this.#circleClick(p);
  }

  // Double-click toggles a bezier anchor between retracted (zero) and default
  // tangent handles, so a corner-like point can be turned into a draggable one.
  #onDoubleClick(e: MouseEvent): void {
    if (this.#activeKind) return;
    const sel = this.#selectedModifier();
    if (!sel || sel.kind !== "bezier") return;
    const p = this.#preview.screenToImage(e.clientX, e.clientY);
    const r = CLOSE_RADIUS_PX * this.#preview.worldPerPixel();

    let idx = -1;
    let bestD = r * r;
    sel.anchors.forEach((a, i) => {
      const d = (a.x - p.x) ** 2 + (a.y - p.y) ** 2;
      if (d < bestD) {
        bestD = d;
        idx = i;
      }
    });
    if (idx < 0) return;

    const anchors = sel.anchors.map((a) => ({ ...a }));
    const a = anchors[idx];
    if (Math.hypot(a.hx, a.hy) > HANDLE_EPS) {
      a.hx = 0;
      a.hy = 0;
    } else {
      const h = defaultAnchorHandle(sel, idx);
      a.hx = h.hx;
      a.hy = h.hy;
    }
    updateModifier(sel.uuid, { anchors });
    refreshHighlight(this.#preview);
  }

  #pathClick(p: Vec): void {
    if (this.#vertices.length >= 2 && this.#near(p, this.#vertices[0])) {
      this.#commitPath(true);
      return;
    }
    this.#vertices.push(p);
    this.#drawDraft();
  }

  #circleClick(p: Vec): void {
    if (!this.#firstPoint) {
      this.#firstPoint = p;
      this.#drawDraft();
      return;
    }
    this.#addAndKeepActive({
      uuid: newModifierUUID(),
      kind: "circle",
      center: { x: p.x, y: p.y },
      edge: { x: this.#firstPoint.x, y: this.#firstPoint.y },
      pointCount: CIRCLE_DEFAULT_POINTS,
    });
    this.#firstPoint = null;
    this.#cursor = null;
    this.#preview.setDraftPath(null, false);
  }

  #circle3Click(p: Vec): void {
    this.#vertices.push({ x: p.x, y: p.y });
    if (this.#vertices.length < 3) {
      this.#drawDraft();
      return;
    }
    const [a, b, c] = this.#vertices;
    const circ = circumcircle(a, b, c);
    if (circ) {
      this.#addAndKeepActive({
        uuid: newModifierUUID(),
        kind: "circle",
        center: { x: circ.center.x, y: circ.center.y },
        edge: { x: circ.edge.x, y: circ.edge.y },
        pointCount: CIRCLE_DEFAULT_POINTS,
      });
    }
    this.#vertices = [];
    this.#cursor = null;
    this.#preview.setDraftPath(null, false);
  }

  #commitPath(closed: boolean): void {
    if (this.#vertices.length < 2 || !isPathKind(this.#activeKind!)) {
      this.#abortDrawing();
      return;
    }
    const vertices = this.#vertices.map((v) => ({ x: v.x, y: v.y }));
    const catmull = this.#activeKind === "catmullrom";
    this.#addAndKeepActive({
      uuid: newModifierUUID(),
      kind: "path",
      interpolation: catmull ? "catmullrom" : "polyline",
      vertices,
      closed,
      pointCount: catmull
        ? defaultCatmullRomPointCount(vertices, closed, getToolSettings().catmullDensity)
        : vertices.length,
    });
    this.#vertices = [];
    this.#cursor = null;
    this.#preview.setDraftPath(null, false);
  }

  // Pen: a press drops an anchor (or arms the close gesture when over the first
  // anchor); the following drag pulls its symmetric handle.
  #bezierDown(p: Vec): void {
    if (this.#anchors.length >= 2 && this.#near(p, this.#anchors[0])) {
      this.#closing = true;
      return;
    }
    this.#anchors.push({ x: p.x, y: p.y, hx: 0, hy: 0 });
    this.#placingAnchor = true;
    this.#cursor = p;
    this.#drawDraft();
  }

  #commitBezier(closed: boolean): void {
    if (this.#anchors.length < 2) {
      this.#abortDrawing();
      return;
    }
    const anchors = this.#anchors.map((a) => ({ x: a.x, y: a.y, hx: a.hx, hy: a.hy }));
    const mod: BezierModifier = {
      uuid: newModifierUUID(),
      kind: "bezier",
      anchors,
      closed,
      pointCount: 2,
    };
    mod.pointCount = defaultBezierPointCount(mod);
    this.#addAndKeepActive(mod);
    this.#anchors = [];
    this.#placingAnchor = false;
    this.#closing = false;
    this.#cursor = null;
    this.#preview.setDraftPath(null, false);
    this.#preview.setHandleWhiskers([], []);
  }

  #addAndKeepActive(mod: Modifier): void {
    addModifier(mod, getActiveGroup());
  }

  #onKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
    ) {
      return;
    }

    if (e.key === "Escape") {
      if (this.#activeKind && this.#isDrawing()) {
        e.preventDefault();
        this.#abortDrawing();
      } else if (this.#activeKind) {
        e.preventDefault();
        this.activateCursor();
      } else if (getSelected() !== null) {
        e.preventDefault();
        setSelected(null);
      }
      return;
    }

    if (!this.#activeKind) return;
    if (e.code === "Space") {
      if (isPathKind(this.#activeKind)) {
        e.preventDefault();
        this.#commitPath(false);
      } else if (this.#activeKind === "bezier") {
        e.preventDefault();
        this.#commitBezier(false);
      }
    }
  }

  #isDrawing(): boolean {
    return this.#vertices.length > 0 || this.#firstPoint !== null || this.#anchors.length > 0;
  }

  #abortDrawing(): void {
    this.#vertices = [];
    this.#firstPoint = null;
    this.#anchors = [];
    this.#placingAnchor = false;
    this.#closing = false;
    this.#cursor = null;
    this.#preview.setDraftPath(null, false);
    this.#preview.setHandleWhiskers([], []);
  }

  #drawDraft(): void {
    if (this.#activeKind === "bezier") {
      this.#drawBezierDraft();
      return;
    }
    if (this.#activeKind === "circle") {
      if (this.#firstPoint && this.#cursor) {
        const outline = circleOutline(this.#cursor, this.#firstPoint);
        this.#preview.setDraftPath(outline, true, [this.#cursor, this.#firstPoint]);
      } else {
        this.#preview.setDraftPath(null, false);
      }
      return;
    }
    if (this.#activeKind === "circle3") {
      const fixed = this.#vertices;
      const pts = this.#cursor ? [...fixed, this.#cursor] : fixed.slice();
      const circ =
        fixed.length >= 2 && this.#cursor ? circumcircle(fixed[0], fixed[1], this.#cursor) : null;
      if (circ) {
        this.#preview.setDraftPath(circleOutline(circ.center, circ.edge), true, pts);
      } else {
        this.#preview.setDraftPath(pts.length ? pts : null, false, pts);
      }
      return;
    }
    const path = this.#cursor ? [...this.#vertices, this.#cursor] : this.#vertices.slice();
    const outline =
      this.#activeKind === "catmullrom" && path.length >= 2 ? catmullRomOutline(path, false) : path;
    this.#preview.setDraftPath(outline, false, this.#vertices);
  }

  #drawBezierDraft(): void {
    const anchors = this.#anchors;
    if (anchors.length === 0) {
      this.#preview.setDraftPath(null, false);
      this.#preview.setHandleWhiskers([], []);
      return;
    }
    // While hovering (not dragging a handle) append a zero-handle phantom anchor
    // at the cursor so the next segment previews as a real curve.
    const previewAnchors =
      !this.#placingAnchor && this.#cursor
        ? [...anchors, { x: this.#cursor.x, y: this.#cursor.y, hx: 0, hy: 0 }]
        : anchors;
    const draftMod: BezierModifier = {
      uuid: "" as ModifierUUID,
      kind: "bezier",
      anchors: previewAnchors,
      closed: false,
      pointCount: 2,
    };
    const outline = bezierOutline(draftMod);
    const dots = anchors.map((a) => ({ x: a.x, y: a.y }));
    this.#preview.setDraftPath(outline.length ? outline : null, false, dots);
    const w = bezierWhiskers(draftMod);
    this.#preview.setHandleWhiskers(w.segments, w.dots);
  }

  #onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    const p = this.#preview.screenToImage(e.clientX, e.clientY);
    if (this.#activeKind === "bezier") {
      this.#bezierDown(p);
      return;
    }
    if (this.#activeKind) return;
    const sel = this.#selectedModifier();
    if (!sel) return;
    if (sel.kind === "bezier") {
      this.#bezierDrag = bezierHitTest(sel, p, this.#preview.worldPerPixel());
      if (!this.#bezierDrag) {
        setSelected(null);
        return;
      }
      this.#dragging = true;
      return;
    }
    const grab = CLOSE_RADIUS_PX * this.#preview.worldPerPixel();
    const idx = nearestControl(controlPoints(sel), p, grab * grab);
    if (idx < 0) {
      setSelected(null);
      return;
    }
    this.#dragIndex = idx;
    this.#dragging = true;
  }

  #onPointerMove(e: PointerEvent): void {
    const p = this.#preview.screenToImage(e.clientX, e.clientY);
    if (this.#dragging) {
      // Coalesce pointer moves to one pipeline run per animation frame: each
      // #dragTo is ~100ms, so applying every event would back the queue up.
      this.#pendingDrag = p;
      if (!this.#dragRaf) {
        this.#dragRaf = requestAnimationFrame(() => {
          this.#dragRaf = 0;
          const pending = this.#pendingDrag;
          this.#pendingDrag = null;
          if (pending && this.#dragging) this.#dragTo(pending);
        });
      }
      return;
    }
    if (this.#activeKind === "bezier" && this.#placingAnchor) {
      // Live-update the symmetric handle of the anchor being placed (draft only,
      // no pipeline run).
      const a = this.#anchors[this.#anchors.length - 1];
      a.hx = p.x - a.x;
      a.hy = p.y - a.y;
      this.#cursor = p;
      this.#drawDraft();
      return;
    }
    if (this.#activeKind) {
      this.#cursor = p;
      this.#drawDraft();
    }
  }

  #onPointerUp(): void {
    this.#dragging = false;
    if (this.#dragRaf) {
      cancelAnimationFrame(this.#dragRaf);
      this.#dragRaf = 0;
    }
    // Flush the final position so the drag's end state is always committed.
    const pending = this.#pendingDrag;
    this.#pendingDrag = null;
    if (pending) this.#dragTo(pending);
    this.#bezierDrag = null;

    if (this.#activeKind === "bezier") {
      if (this.#closing) {
        this.#commitBezier(true);
      } else if (this.#placingAnchor) {
        this.#placingAnchor = false;
        this.#drawDraft();
      }
    }
  }

  #dragTo(p: Vec): void {
    const sel = this.#selectedModifier();
    if (!sel) return;
    if (sel.kind === "bezier") {
      if (!this.#bezierDrag) return;
      const anchors = sel.anchors.map((a) => ({ ...a }));
      const a = anchors[this.#bezierDrag.index];
      if (!a) return;
      if (this.#bezierDrag.part === "anchor") {
        a.x = p.x;
        a.y = p.y;
      } else if (this.#bezierDrag.part === "out") {
        a.hx = p.x - a.x;
        a.hy = p.y - a.y;
      } else {
        // Dragging the incoming handle sets the outgoing one to its mirror.
        a.hx = a.x - p.x;
        a.hy = a.y - p.y;
      }
      updateModifier(sel.uuid, { anchors });
      refreshHighlight(this.#preview);
      return;
    }
    if (sel.kind === "path") {
      const verts = sel.vertices.map((v) => ({ x: v.x, y: v.y }));
      verts[this.#dragIndex] = { x: p.x, y: p.y };
      updateModifier(sel.uuid, { vertices: verts });
    } else {
      updateModifier(
        sel.uuid,
        this.#dragIndex === 0 ? { center: { x: p.x, y: p.y } } : { edge: { x: p.x, y: p.y } },
      );
    }
    refreshHighlight(this.#preview);
  }

  #selectedModifier(): Modifier | undefined {
    const sel = getSelected();
    return sel ? getModifiers().find((m) => m.uuid === sel) : undefined;
  }

  #near(a: Vec, b: Vec): boolean {
    const r = CLOSE_RADIUS_PX * this.#preview.worldPerPixel();
    return Math.hypot(a.x - b.x, a.y - b.y) <= r;
  }
}

function controlPoints(mod: Modifier): Vec[] {
  if (mod.kind === "circle") return [mod.center, mod.edge];
  if (mod.kind === "bezier") return mod.anchors;
  return mod.vertices;
}

// Hit-test for editing a bezier. Extended handle ends take priority over the
// anchor (so you grab the whisker, not the point); a handle within the grab
// radius of its own anchor is treated as retracted and ignored, keeping the
// anchor draggable.
function bezierHitTest(mod: BezierModifier, p: Vec, worldPerPixel: number): BezierTarget | null {
  const r = CLOSE_RADIUS_PX * worldPerPixel;
  const r2 = r * r;
  const distSq = (x: number, y: number): number => (x - p.x) ** 2 + (y - p.y) ** 2;

  let best: BezierTarget | null = null;
  let bestD = r2;
  mod.anchors.forEach((a, index) => {
    if (Math.hypot(a.hx, a.hy) <= r) return;
    const dOut = distSq(a.x + a.hx, a.y + a.hy);
    if (dOut < bestD) {
      bestD = dOut;
      best = { index, part: "out" };
    }
    const dIn = distSq(a.x - a.hx, a.y - a.hy);
    if (dIn < bestD) {
      bestD = dIn;
      best = { index, part: "in" };
    }
  });
  if (best) return best;

  bestD = r2;
  mod.anchors.forEach((a, index) => {
    const d = distSq(a.x, a.y);
    if (d < bestD) {
      bestD = d;
      best = { index, part: "anchor" };
    }
  });
  return best;
}

function nearestControl(controls: Vec[], p: Vec, maxDistSq: number): number {
  let best = -1;
  let bestD = maxDistSq;
  controls.forEach((c, i) => {
    const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}
