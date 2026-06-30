import { Ferrsign1 } from "ferrsign";
import { addModifier, splitModifier, updateModifier } from "../document/commands/modifiers.js";
import { beginGesture, endGesture } from "../document/history.js";
import { getModifiers, groupNameOfGroup } from "../document/selectors/document.js";
import { groupColorHex } from "../domain/groupColor.js";
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
import { insertBezierAnchor, insertPathVertex } from "../domain/modifiers/insert.js";
import type { Preview } from "../preview/preview.js";
import { bezierWhiskers, refreshHighlight } from "./highlight.js";
import { getActiveGroup } from "./activeGroup.js";
import { clearSelectedPoint, getSelectedPoint, setSelectedPoint } from "./pointSelection.js";
import { getSelected, selectionChanged, setSelected } from "./selection.js";

// Screen-space grab radius (px) for control points, bezier handles/anchors, and the
// path-close snap. Generous so the small dots and handle squares are easy to hit.
const CLOSE_RADIUS_PX = 15;
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

    if (e.key === "Delete" || e.key === "Backspace") {
      if (!this.#activeKind && this.#deleteSelectedPoint()) e.preventDefault();
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

  // Color of the group the new modifier will land in, so the draft previews in
  // its final color. Undefined (preview default) when drawing into the root.
  #draftColor(): number | undefined {
    const group = getActiveGroup();
    if (!group) return undefined;
    const name = groupNameOfGroup(group);
    return name === null ? undefined : groupColorHex(name);
  }

  #drawDraft(): void {
    if (this.#activeKind === "bezier") {
      this.#drawBezierDraft();
      return;
    }
    const color = this.#draftColor();
    if (this.#activeKind === "circle") {
      if (this.#firstPoint && this.#cursor) {
        const outline = circleOutline(this.#cursor, this.#firstPoint);
        this.#preview.setDraftPath(outline, true, [this.#cursor, this.#firstPoint], color);
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
        this.#preview.setDraftPath(circleOutline(circ.center, circ.edge), true, pts, color);
      } else {
        this.#preview.setDraftPath(pts.length ? pts : null, false, pts, color);
      }
      return;
    }
    const path = this.#cursor ? [...this.#vertices, this.#cursor] : this.#vertices.slice();
    const outline =
      this.#activeKind === "catmullrom" && path.length >= 2 ? catmullRomOutline(path, false) : path;
    this.#preview.setDraftPath(outline, false, this.#vertices, color);
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
    const color = this.#draftColor();
    this.#preview.setDraftPath(outline.length ? outline : null, false, dots, color);
    const w = bezierWhiskers(draftMod);
    this.#preview.setHandleWhiskers(w.segments, w.dots, color);
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

    // Ctrl/Cmd + click a control point splits the modifier in two at that point.
    if (e.ctrlKey || e.metaKey) {
      this.#trySplit(sel, p);
      return;
    }

    // Alt edits the topology of the selected modifier: drag an open end to extrude
    // a new point, or click the curve to insert one. Neither deselects on a miss.
    if (e.altKey) {
      if (!this.#tryExtrude(sel, p)) this.#tryInsertOnCurve(sel, p);
      return;
    }

    if (sel.kind === "bezier") {
      this.#bezierDrag = bezierHitTest(sel, p, this.#preview.worldPerPixel());
      if (!this.#bezierDrag) {
        setSelected(null);
        return;
      }
      setSelectedPoint(sel.uuid, this.#bezierDrag.index);
      // Bracket the whole drag as one undo step (it fires a pipeline run per frame).
      beginGesture();
      this.#dragging = true;
      return;
    }
    const grab = CLOSE_RADIUS_PX * this.#preview.worldPerPixel();
    const idx = nearestControl(controlPoints(sel), p, grab * grab);
    if (idx < 0) {
      setSelected(null);
      return;
    }
    setSelectedPoint(sel.uuid, idx);
    this.#dragIndex = idx;
    // Bracket the whole drag as one undo step (it fires a pipeline run per frame).
    beginGesture();
    this.#dragging = true;
  }

  // Alt + drag an open endpoint: append a coincident point at that end and start
  // dragging it, leaving the original endpoint in place (a classic extrude). The
  // append + drag are one undo step (the open gesture coalesces them).
  #tryExtrude(sel: Modifier, p: Vec): boolean {
    const grabSq = (CLOSE_RADIUS_PX * this.#preview.worldPerPixel()) ** 2;
    if (sel.kind === "path") {
      if (sel.closed) return false;
      const end = this.#hitEndpoint(sel.vertices, p, grabSq);
      if (end < 0) return false;
      const vertices = sel.vertices.map((v) => ({ x: v.x, y: v.y }));
      const at = end === 0 ? 0 : vertices.length;
      vertices.splice(at, 0, { x: vertices[end].x, y: vertices[end].y });
      const pointCount = sel.interpolation === "polyline" ? sel.pointCount + 1 : sel.pointCount;
      beginGesture();
      this.#dragIndex = at;
      this.#dragging = true;
      updateModifier(sel.uuid, { vertices, pointCount });
      setSelectedPoint(sel.uuid, at);
      refreshHighlight(this.#preview);
      return true;
    }
    if (sel.kind === "bezier") {
      if (sel.closed) return false;
      const end = this.#hitEndpoint(sel.anchors, p, grabSq);
      if (end < 0) return false;
      const anchors = sel.anchors.map((a) => ({ ...a }));
      const at = end === 0 ? 0 : anchors.length;
      const src = anchors[end];
      anchors.splice(at, 0, { x: src.x, y: src.y, hx: 0, hy: 0 });
      beginGesture();
      this.#bezierDrag = { index: at, part: "anchor" };
      this.#dragging = true;
      updateModifier(sel.uuid, { anchors });
      setSelectedPoint(sel.uuid, at);
      refreshHighlight(this.#preview);
      return true;
    }
    return false;
  }

  // Alt + click the curve (not on a control point): insert a new point there.
  #tryInsertOnCurve(sel: Modifier, p: Vec): boolean {
    if (sel.kind === "circle") return false;
    const grabSq = (CLOSE_RADIUS_PX * this.#preview.worldPerPixel()) ** 2;
    // A press on an existing control point is a select/drag, not an insert.
    if (nearestControl(controlPoints(sel), p, grabSq) >= 0) return false;

    if (sel.kind === "path") {
      const res = insertPathVertex(sel, p, grabSq);
      if (!res) return false;
      const pointCount = sel.interpolation === "polyline" ? sel.pointCount + 1 : sel.pointCount;
      updateModifier(sel.uuid, { vertices: res.vertices, pointCount });
      setSelectedPoint(sel.uuid, res.index);
    } else {
      const res = insertBezierAnchor(sel, p, grabSq);
      if (!res) return false;
      updateModifier(sel.uuid, { anchors: res.anchors });
      setSelectedPoint(sel.uuid, res.index);
    }
    refreshHighlight(this.#preview);
    return true;
  }

  // Ctrl/Cmd + click a control point: split the modifier into two at that point.
  // The original is replaced by the halves, so its selection no longer resolves.
  #trySplit(sel: Modifier, p: Vec): boolean {
    if (sel.kind === "circle") return false;
    const grabSq = (CLOSE_RADIUS_PX * this.#preview.worldPerPixel()) ** 2;
    const idx = nearestControl(controlPoints(sel), p, grabSq);
    if (idx < 0) return false;
    splitModifier(sel.uuid, idx);
    setSelected(null);
    return true;
  }

  // Nearest open endpoint (first or last control point) within maxDistSq, or -1.
  #hitEndpoint(points: Vec[], p: Vec, maxDistSq: number): number {
    const n = points.length;
    if (n < 2) return -1;
    let best = -1;
    let bestD = maxDistSq;
    for (const i of [0, n - 1]) {
      const c = points[i];
      const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  #deleteSelectedPoint(): boolean {
    const sp = getSelectedPoint();
    if (!sp) return false;
    const sel = this.#selectedModifier();
    if (!sel || sel.uuid !== sp.modifier) return false;
    const count =
      sel.kind === "path" ? sel.vertices.length : sel.kind === "bezier" ? sel.anchors.length : 0;
    if (sp.index < 0 || sp.index >= count) return false;

    if (sel.kind === "path") {
      // Below the minimum a path/bezier stops being valid; deleting is a no-op
      // rather than wiping the modifier.
      if (sel.vertices.length <= 2) return false;
      const vertices = sel.vertices.filter((_, i) => i !== sp.index);
      const pointCount =
        sel.interpolation === "polyline"
          ? Math.max(vertices.length, sel.pointCount - 1)
          : sel.pointCount;
      updateModifier(sel.uuid, { vertices, pointCount });
    } else if (sel.kind === "bezier") {
      if (sel.anchors.length <= 2) return false;
      const anchors = sel.anchors.filter((_, i) => i !== sp.index);
      updateModifier(sel.uuid, { anchors });
    } else {
      return false; // circle handles are structural
    }
    clearSelectedPoint();
    refreshHighlight(this.#preview);
    return true;
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
    // Close any open drag gesture (no-op when this pointerup was not a drag).
    endGesture();

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
