import { Ferrsign1 } from "ferrsign";
import { addModifier } from "../document/commands/modifierCommands.js";
import { collapseAllGroups } from "../document/commands/groupCommands.js";
import { signals } from "../document/signals.js";
import { getModifiers, groupNameOfGroup } from "../document/selectors/document.js";
import { groupColorHex } from "../domain/groupColor.js";
import type { GroupUUID, Modifier, ModifierUUID, ToolKind } from "../document/types.js";
import type { Preview } from "../preview/preview.js";
import { refreshHighlight } from "./highlight.js";
import { getActiveGroup } from "./activeGroup.js";
import { setSelectedPoint } from "./pointSelection.js";
import { getSelected, selectionChanged, setSelected, setSelectedGroup } from "./selection.js";
import { GRAB_RADIUS_PX } from "./tools/constants.js";
import { bezierHitTest, controlPoints, nearestControl } from "./tools/hitTest.js";
import { DragSession, type DragTarget } from "./tools/dragSession.js";
import type { DraftEnv, ToolDraft } from "./tools/draft.js";
import { PathDraft } from "./tools/pathDraft.js";
import { CircleDraft } from "./tools/circleDraft.js";
import { Circle3Draft } from "./tools/circle3Draft.js";
import { BezierDraft } from "./tools/bezierDraft.js";
import {
  deleteControlPoint,
  extrudeEndpoint,
  insertOnCurve,
  splitAtControlPoint,
  toggleBezierHandle,
} from "./tools/topology.js";

export const activeToolChanged = new Ferrsign1<ToolKind | undefined>();

// The three mutually exclusive states of the canvas. Select is the resting state (pick,
// edit, and start drags on existing modifiers); Draw is a drawing tool building a new
// modifier through its draft; Drag is a control-point drag in progress. Making these an
// explicit discriminated union keeps illegal combinations (drawing while dragging, a
// draft with no tool) unrepresentable.
enum EditorMode {
  Select,
  Draw,
  Drag,
}

type ModeState =
  | { readonly mode: EditorMode.Select }
  | { readonly mode: EditorMode.Draw; readonly tool: ToolKind; readonly draft: ToolDraft }
  | { readonly mode: EditorMode.Drag; readonly session: DragSession };

export class ToolController {
  readonly #preview: Preview;
  readonly #draftEnv: DraftEnv;

  #state: ModeState = { mode: EditorMode.Select };

  constructor(preview: Preview) {
    this.#preview = preview;
    this.#draftEnv = {
      preview,
      draftColor: () => this.#draftColor(),
      commit: (modifier) => addModifier(modifier, getActiveGroup()),
    };

    const canvas = preview.domElement;
    canvas.addEventListener("click", (e) => this.#onClick(e));
    canvas.addEventListener("dblclick", (e) => this.#onDoubleClick(e));
    canvas.addEventListener("pointerdown", (e) => this.#onPointerDown(e));
    canvas.addEventListener("pointermove", (e) => this.#onPointerMove(e));
    window.addEventListener("pointerup", () => this.#onPointerUp());
    // A drag can end without a pointerup (the browser cancels the pointer, or the window
    // loses focus mid-drag): finish it anyway so the undo gesture always closes.
    window.addEventListener("pointercancel", () => this.#endDrag());
    window.addEventListener("blur", () => this.#endDrag());
    // Keyboard shortcuts (including the editing keys that call the command methods above)
    // are owned by a single listener in hotkeys.ts.

    selectionChanged.on((uuid) => this.#onSelectionChanged(uuid));
    // Undo/redo, a project load, or an image swap replaces the whole source: abandon any
    // half-drawn modifier and cancel an in-flight drag, since both refer to modifiers or
    // control-point indices that may no longer exist.
    signals.sourceReplaced.on(() => this.#onSourceReplaced());
  }

  // The drawing tool currently armed, or undefined when in Select/Drag. Read-only view of
  // the mode for the hotkey help, which projects the editor state into contextual hints.
  get activeTool(): ToolKind | undefined {
    return this.#state.mode === EditorMode.Draw ? this.#state.tool : undefined;
  }

  toggle(kind: ToolKind): void {
    if (this.#state.mode === EditorMode.Draw && this.#state.tool === kind) {
      this.activateCursor();
      return;
    }
    this.#keepActiveGroup();
    collapseAllGroups();
    this.#enterDraw(kind);
    document.body.style.cursor = "crosshair";
    activeToolChanged.emit(kind);
  }

  activateCursor(): void {
    this.#discardCurrentMode();
    this.#state = { mode: EditorMode.Select };
    document.body.style.cursor = "";
    this.#keepActiveGroup();
    collapseAllGroups();
    activeToolChanged.emit(undefined);
  }

  // Arming a tool changes only the tool, never the active drop target: the active
  // group (a selected group, or the parent of a selected modifier) is re-asserted as
  // a group selection so a new modifier still lands in it. Clears the modifier
  // selection when there is no active group. Returns the surviving active group.
  #keepActiveGroup(): GroupUUID | undefined {
    const active = getActiveGroup();
    if (active) setSelectedGroup(active);
    else setSelected(undefined);
    return active;
  }

  // A click on empty canvas while a modifier is selected: re-assert the active
  // group (or clear the selection) and tuck the groups away, matching what the
  // tool buttons do.
  #clickEmptyArea(): void {
    this.#keepActiveGroup();
    collapseAllGroups();
  }

  #enterDraw(tool: ToolKind): void {
    this.#discardCurrentMode();
    this.#state = { mode: EditorMode.Draw, tool, draft: this.#createDraft(tool) };
  }

  #createDraft(tool: ToolKind): ToolDraft {
    switch (tool) {
      case "polyline":
        return new PathDraft(this.#draftEnv, "polyline");
      case "catmullrom":
        return new PathDraft(this.#draftEnv, "catmullrom");
      case "bezier":
        return new BezierDraft(this.#draftEnv);
      case "circle":
        return new CircleDraft(this.#draftEnv);
      case "circle3":
        return new Circle3Draft(this.#draftEnv);
    }
  }

  // Clean up whatever the current mode owns before a transition: a drag is finished
  // (committing its last position and closing its gesture), a draft is discarded.
  #discardCurrentMode(): void {
    if (this.#state.mode === EditorMode.Drag) {
      this.#state.session.finish();
    } else if (this.#state.mode === EditorMode.Draw) {
      this.#state.draft.reset();
    }
  }

  #onSelectionChanged(uuid: ModifierUUID | undefined): void {
    // Selecting a modifier (e.g. from the stack panel) leaves any active drawing tool.
    if (uuid !== undefined && this.#state.mode === EditorMode.Draw) {
      this.#state.draft.reset();
      this.#state = { mode: EditorMode.Select };
      document.body.style.cursor = "";
      activeToolChanged.emit(undefined);
    }
  }

  #onSourceReplaced(): void {
    if (this.#state.mode === EditorMode.Drag) {
      this.#state.session.cancel();
      this.#state = { mode: EditorMode.Select };
    } else if (this.#state.mode === EditorMode.Draw) {
      // Drop the half-drawn shape but keep the tool armed for a fresh one.
      this.#state.draft.reset();
    }
  }

  #onClick(e: MouseEvent): void {
    if (this.#state.mode !== EditorMode.Draw) return;
    const p = this.#preview.screenToImage(e.clientX, e.clientY);
    this.#state.draft.click(p);
  }

  #onDoubleClick(e: MouseEvent): void {
    if (this.#state.mode !== EditorMode.Select) return;
    const sel = this.#selectedModifier();
    if (!sel) return;
    const p = this.#preview.screenToImage(e.clientX, e.clientY);
    toggleBezierHandle(sel, p, this.#preview);
  }

  #onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    const p = this.#preview.screenToImage(e.clientX, e.clientY);
    if (this.#state.mode === EditorMode.Draw) {
      this.#state.draft.pointerDown(p);
      return;
    }
    if (this.#state.mode === EditorMode.Drag) return;

    const sel = this.#selectedModifier();
    if (!sel) return;

    // Ctrl/Cmd + click a control point splits the modifier in two at that point.
    if (e.ctrlKey || e.metaKey) {
      splitAtControlPoint(sel, p, this.#preview);
      return;
    }

    // Alt edits the topology of the selected modifier: drag an open end to extrude a new
    // point, or click the curve to insert one. Neither deselects on a miss.
    if (e.altKey) {
      const extruded = extrudeEndpoint(sel, p, this.#preview, (target) =>
        this.#startDrag(sel.uuid, target),
      );
      if (!extruded) insertOnCurve(sel, p, this.#preview);
      return;
    }

    if (sel.kind === "bezier") {
      const target = bezierHitTest(sel, p, this.#preview.worldPerPixel());
      if (!target) {
        this.#clickEmptyArea();
        return;
      }
      setSelectedPoint(sel.uuid, target.index);
      this.#startDrag(sel.uuid, { kind: "bezier", target });
      return;
    }
    const grabRadius = GRAB_RADIUS_PX * this.#preview.worldPerPixel();
    const controlIndex = nearestControl(controlPoints(sel), p, grabRadius * grabRadius);
    if (controlIndex < 0) {
      this.#clickEmptyArea();
      return;
    }
    setSelectedPoint(sel.uuid, controlIndex);
    this.#startDrag(sel.uuid, { kind: "control", index: controlIndex });
  }

  // Begin a control-point drag on the selected modifier. The DragSession opens the undo
  // gesture and coalesces per-frame applies; it runs a pipeline pass per frame.
  #startDrag(modifier: ModifierUUID, target: DragTarget): void {
    const session = new DragSession(modifier, target, () => refreshHighlight(this.#preview));
    this.#state = { mode: EditorMode.Drag, session };
  }

  #onPointerMove(e: PointerEvent): void {
    const p = this.#preview.screenToImage(e.clientX, e.clientY);
    if (this.#state.mode === EditorMode.Drag) {
      this.#state.session.move(p);
    } else if (this.#state.mode === EditorMode.Draw) {
      this.#state.draft.pointerMove(p);
    }
  }

  #onPointerUp(): void {
    if (this.#state.mode === EditorMode.Drag) {
      this.#endDrag();
    } else if (this.#state.mode === EditorMode.Draw) {
      this.#state.draft.pointerUp();
    }
  }

  // Commit and close an in-flight drag, returning to Select. Safe to call in any mode.
  #endDrag(): void {
    if (this.#state.mode !== EditorMode.Drag) return;
    this.#state.session.finish();
    this.#state = { mode: EditorMode.Select };
  }

  // Escape: abandon the half-drawn shape, deactivate the tool, or clear the selection -
  // whichever applies first. Returns true if it did something.
  cancelActive(): boolean {
    if (this.#state.mode === EditorMode.Draw && this.#state.draft.hasContent()) {
      this.#state.draft.reset();
      return true;
    }
    if (this.#state.mode === EditorMode.Draw) {
      this.activateCursor();
      return true;
    }
    if (getSelected() !== undefined) {
      setSelected(undefined);
      return true;
    }
    return false;
  }

  // Space: commit the in-progress open shape (path / bezier). Returns true if handled.
  commitDraft(): boolean {
    return this.#state.mode === EditorMode.Draw && this.#state.draft.commitOpen();
  }

  // Delete/Backspace: remove the selected control point. Returns true if one was removed.
  deleteSelectedPoint(): boolean {
    if (this.#state.mode !== EditorMode.Select) return false;
    const sel = this.#selectedModifier();
    return sel ? deleteControlPoint(sel, this.#preview) : false;
  }

  // Color of the group the new modifier will land in, so the draft previews in its final
  // color. Undefined (preview default) when drawing into the root.
  #draftColor(): number | undefined {
    const group = getActiveGroup();
    if (!group) return undefined;
    const name = groupNameOfGroup(group);
    return name === undefined ? undefined : groupColorHex(name);
  }

  #selectedModifier(): Modifier | undefined {
    const sel = getSelected();
    return sel ? getModifiers().find((modifier) => modifier.uuid === sel) : undefined;
  }
}
