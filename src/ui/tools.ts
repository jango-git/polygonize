import { Ferrsign1 } from "ferrsign";
import { addModifier, updateModifier } from "../document/commands/modifiers.js";
import { getModifiers } from "../document/selectors/document.js";
import { getToolSettings } from "../settings/store.js";
import {
  newModifierUUID,
  type Modifier,
  type ModifierUUID,
  type ToolKind,
} from "../document/types.js";
import { catmullRomOutline, defaultCatmullRomPointCount } from "../domain/modifiers/catmullrom.js";
import { circleOutline } from "../domain/modifiers/circle.js";
import type { Preview } from "../preview/preview.js";
import { refreshHighlight } from "./highlight.js";
import { getSelected, selectionChanged, setSelected } from "./selection.js";

const CLOSE_RADIUS_PX = 10;
const CIRCLE_DEFAULT_POINTS = 24;

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

  constructor(preview: Preview) {
    this.#preview = preview;
    const canvas = preview.domElement;
    canvas.addEventListener("click", (e) => this.#onClick(e));
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
    const p = this.#preview.screenToImage(e.clientX, e.clientY);
    if (isPathKind(this.#activeKind)) this.#pathClick(p);
    else this.#circleClick(p);
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

  #addAndKeepActive(mod: Modifier): void {
    addModifier(mod);
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
    if (e.code === "Space" && isPathKind(this.#activeKind)) {
      e.preventDefault();
      this.#commitPath(false);
    }
  }

  #isDrawing(): boolean {
    return this.#vertices.length > 0 || this.#firstPoint !== null;
  }

  #abortDrawing(): void {
    this.#vertices = [];
    this.#firstPoint = null;
    this.#cursor = null;
    this.#preview.setDraftPath(null, false);
  }

  #drawDraft(): void {
    if (this.#activeKind === "circle") {
      if (this.#firstPoint && this.#cursor) {
        const outline = circleOutline(this.#cursor, this.#firstPoint);
        this.#preview.setDraftPath(outline, true, [this.#cursor, this.#firstPoint]);
      } else {
        this.#preview.setDraftPath(null, false);
      }
      return;
    }
    const path = this.#cursor ? [...this.#vertices, this.#cursor] : this.#vertices.slice();
    const outline =
      this.#activeKind === "catmullrom" && path.length >= 2 ? catmullRomOutline(path, false) : path;
    this.#preview.setDraftPath(outline, false, this.#vertices);
  }

  #onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    if (this.#activeKind) return;
    const sel = this.#selectedModifier();
    if (!sel) return;
    const p = this.#preview.screenToImage(e.clientX, e.clientY);
    this.#dragIndex = nearestControl(controlPoints(sel), p);
    this.#dragging = true;
  }

  #onPointerMove(e: PointerEvent): void {
    const p = this.#preview.screenToImage(e.clientX, e.clientY);
    if (this.#dragging) {
      this.#dragTo(p);
      return;
    }
    if (this.#activeKind) {
      this.#cursor = p;
      this.#drawDraft();
    }
  }

  #onPointerUp(): void {
    this.#dragging = false;
  }

  #dragTo(p: Vec): void {
    const sel = this.#selectedModifier();
    if (!sel) return;
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
  return mod.kind === "circle" ? [mod.center, mod.edge] : mod.vertices;
}

function nearestControl(controls: Vec[], p: Vec): number {
  let best = 0;
  let bestD = Infinity;
  controls.forEach((c, i) => {
    const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}
