import { getModifiers } from "../document/selectors/document.js";
import type { ModifierKind, ToolKind } from "../document/types.js";
import { t, type TKey } from "../i18n/index.js";
import { getSelectedPoint, pointSelectionChanged } from "./pointSelection.js";
import { getSelection, selectionChanged } from "./selection.js";
import { activeToolChanged, type ToolController } from "./tools.js";

interface HotkeyHint {
  key: string;
  description: TKey;
}

// Always-applicable tool and view shortcuts (single-key). These are how the user enters
// each mode, so they stay visible in every context; only the contextual group below
// reacts to the current editor state.
const TOOL_HINTS: HotkeyHint[] = [
  { key: "~", description: "hotkeys.cursor" },
  { key: "1", description: "hotkeys.polyline" },
  { key: "2", description: "hotkeys.catmullrom" },
  { key: "3", description: "hotkeys.bezier" },
  { key: "4", description: "hotkeys.circle" },
  { key: "5", description: "hotkeys.circle3" },
  { key: "Q", description: "hotkeys.flipBackground" },
  { key: "W", description: "hotkeys.flipPoints" },
  { key: "E", description: "hotkeys.flipSpikes" },
  { key: "F", description: "hotkeys.fitImage" },
];

// The editor states that drive the contextual hints, mirroring the ToolController's
// ModeState: nothing selected (idle), a drawing tool building a shape (draw), or a
// modifier selected for editing (selected). A drag is transient and never read here, so
// it is not represented.
enum HotkeyMode {
  Idle,
  Draw,
  Selected,
}

type HotkeyContext =
  | { readonly mode: HotkeyMode.Idle }
  | { readonly mode: HotkeyMode.Draw; readonly tool: ToolKind }
  | {
      readonly mode: HotkeyMode.Selected;
      readonly kind: ModifierKind;
      readonly open: boolean;
      readonly hasPoint: boolean;
    };

// The open-path drawing tools accept Space to commit the shape as open; the circle tools
// commit on their final click and have no such gesture.
function isOpenPathTool(tool: ToolKind): boolean {
  return tool === "polyline" || tool === "catmullrom" || tool === "bezier";
}

// The hints that apply right now, in display order. Pure: same context in, same list out.
function contextualHints(context: HotkeyContext): HotkeyHint[] {
  if (context.mode === HotkeyMode.Draw) {
    const hints: HotkeyHint[] = [];
    if (isOpenPathTool(context.tool))
      hints.push({ key: "Space", description: "hotkeys.applyPath" });
    hints.push({ key: "Escape", description: "hotkeys.cancelDraw" });
    return hints;
  }
  if (context.mode === HotkeyMode.Selected) {
    // A circle's handles are structural, so none of the topology edits apply to it.
    if (context.kind === "circle") return [{ key: "Escape", description: "hotkeys.deselect" }];
    const hints: HotkeyHint[] = [];
    if (context.hasPoint) hints.push({ key: "Del", description: "hotkeys.deletePoint" });
    hints.push({ key: "Alt+Click", description: "hotkeys.addPoint" });
    if (context.open) hints.push({ key: "Alt+Drag", description: "hotkeys.extrudePoint" });
    hints.push({ key: "Ctrl+Click", description: "hotkeys.splitModifier" });
    hints.push({ key: "Escape", description: "hotkeys.deselect" });
    return hints;
  }
  return [];
}

// Read the live editor state into a context. A drawing tool and a modifier selection are
// mutually exclusive in the model (arming a tool clears the selection and vice versa), so
// the active tool takes precedence unambiguously.
function currentContext(tools: ToolController): HotkeyContext {
  const tool = tools.activeTool;
  if (tool) return { mode: HotkeyMode.Draw, tool };

  const selection = getSelection();
  if (selection?.type === "modifier") {
    const modifier = getModifiers().find((candidate) => candidate.uuid === selection.uuid);
    if (modifier) {
      const point = getSelectedPoint();
      return {
        mode: HotkeyMode.Selected,
        kind: modifier.kind,
        open: modifier.kind !== "circle" && !modifier.closed,
        hasPoint: point?.modifier === modifier.uuid,
      };
    }
  }
  return { mode: HotkeyMode.Idle };
}

// Build the key block for a hint. A combo (Alt+Click) becomes one <kbd> per key with a
// muted "+" joiner between them; a single key is just one <kbd>. The block sits in the
// grid's key column, so its min-content width lines all blocks up to a single width.
function buildKeyBlock(key: string): HTMLElement {
  const block = document.createElement("div");
  block.className = "hk-keys";
  key.split("+").forEach((part, index) => {
    if (index > 0) {
      const separator = document.createElement("span");
      separator.className = "hk-sep";
      separator.textContent = "+";
      block.appendChild(separator);
    }
    const kbd = document.createElement("kbd");
    kbd.textContent = part;
    block.appendChild(kbd);
  });
  return block;
}

function buildHintRows(hints: HotkeyHint[]): HTMLElement[] {
  return hints.map((hint) => {
    const row = document.createElement("div");
    row.className = "hk-row";
    const description = document.createElement("span");
    description.textContent = t(hint.description);
    row.append(buildKeyBlock(hint.key), description);
    return row;
  });
}

export function mountHotkeyHelp(container: HTMLElement, tools: ToolController): void {
  const bar = document.createElement("div");
  bar.className = "hotkey-help-bar";

  // Constant plate: the tool and view shortcuts, always shown.
  const constantPlate = document.createElement("div");
  constantPlate.className = "hotkey-help";

  const title = document.createElement("div");
  title.className = "hk-title";
  title.textContent = t("hotkeys.title");

  const toolGroup = document.createElement("div");
  toolGroup.className = "hk-group";
  toolGroup.append(...buildHintRows(TOOL_HINTS));
  constantPlate.append(title, toolGroup);

  // Context plate: a separate box sitting to the right of the constant one, rebuilt on
  // every editor-state change and hidden as a whole when nothing applies. Its own grid
  // sizes the key column to the widest combo it currently shows.
  const contextPlate = document.createElement("div");
  contextPlate.className = "hotkey-help";

  const contextGroup = document.createElement("div");
  contextGroup.className = "hk-group";
  contextPlate.appendChild(contextGroup);

  bar.append(constantPlate, contextPlate);

  const refreshContext = (): void => {
    const hints = contextualHints(currentContext(tools));
    contextGroup.replaceChildren(...buildHintRows(hints));
    contextPlate.hidden = hints.length === 0;
  };

  // Recompute from live state on any transition, so ordering between these signals never
  // matters: a stale intermediate render self-corrects on the next handler in the cycle.
  activeToolChanged.on(refreshContext);
  selectionChanged.on(refreshContext);
  pointSelectionChanged.on(refreshContext);
  refreshContext();

  container.appendChild(bar);
}
