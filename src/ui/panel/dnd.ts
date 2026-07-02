import { moveModifier } from "../../document/commands/modifierCommands.js";
import { moveGroup } from "../../document/commands/groupCommands.js";
import type { GroupUUID, ModifierUUID } from "../../document/types.js";

// Drag-and-drop for the modifier stack: reordering groups and loose modifiers, and dropping
// a modifier into a group. The dragged entry and the insertion indicator are module-scope
// state so they survive across the many card/group elements a drag touches. The stack view
// wires the sources (attachDragSource) and targets (registerContainer /
// registerGroupHeadTarget); the DOM contract is the `.modifier-card` / `.modifier-group`
// classes and each element's `data-entry-id`.

interface DragState {
  kind: "modifier" | "group";
  uuid: string;
}

let drag: DragState | undefined;
let dropLine: HTMLElement | undefined;

export function attachDragSource(
  handle: HTMLElement,
  image: HTMLElement,
  kind: "modifier" | "group",
  uuid: string,
): void {
  handle.draggable = true;
  handle.addEventListener("click", (e) => e.stopPropagation());
  handle.addEventListener("dragstart", (e) => {
    drag = { kind, uuid };
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", uuid);
      const rect = image.getBoundingClientRect();
      e.dataTransfer.setDragImage(image, e.clientX - rect.left, e.clientY - rect.top);
    }
    image.classList.add("dragging");
  });
  handle.addEventListener("dragend", () => {
    image.classList.remove("dragging");
    clearDrag();
  });
}

export function registerContainer(el: HTMLElement, container: GroupUUID | null): void {
  el.addEventListener("dragover", (e) => {
    if (!drag) return;
    if (drag.kind === "group" && container !== null) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    showInsertion(el, e.clientY);
  });
  el.addEventListener("drop", (e) => {
    if (!drag) return;
    if (drag.kind === "group" && container !== null) return;
    e.preventDefault();
    e.stopPropagation();
    const before = insertionBefore(el, e.clientY);
    commitDrop(container, before);
  });
}

export function registerGroupHeadTarget(head: HTMLElement, group: GroupUUID): void {
  head.addEventListener("dragover", (e) => {
    if (!drag || drag.kind !== "modifier") return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    if (dropLine && dropLine.parentElement) {
      dropLine.parentElement.removeChild(dropLine);
    }
    head.classList.add("drop-into");
  });
  head.addEventListener("dragleave", () => head.classList.remove("drop-into"));
  head.addEventListener("drop", (e) => {
    if (!drag || drag.kind !== "modifier") return;
    e.preventDefault();
    e.stopPropagation();
    head.classList.remove("drop-into");
    commitDrop(group, null);
  });
}

function commitDrop(container: GroupUUID | null, before: string | null): void {
  if (!drag) return;
  const { kind, uuid } = drag;
  clearDrag();
  if (kind === "modifier") {
    moveModifier(uuid as ModifierUUID, container, before);
  } else if (container === null) {
    moveGroup(uuid as GroupUUID, before);
  }
}

function entryChildren(container: HTMLElement): HTMLElement[] {
  return Array.from(container.children).filter(
    (c): c is HTMLElement =>
      c instanceof HTMLElement &&
      (c.classList.contains("modifier-card") || c.classList.contains("modifier-group")) &&
      !c.classList.contains("dragging"),
  );
}

function insertionBefore(container: HTMLElement, y: number): string | null {
  for (const el of entryChildren(container)) {
    const rect = el.getBoundingClientRect();
    if (y < rect.top + rect.height / 2) return el.dataset.entryId ?? null;
  }
  return null;
}

function showInsertion(container: HTMLElement, y: number): void {
  const line = ensureDropLine();
  let anchor: HTMLElement | undefined;
  for (const el of entryChildren(container)) {
    const rect = el.getBoundingClientRect();
    if (y < rect.top + rect.height / 2) {
      anchor = el;
      break;
    }
  }
  if (anchor) container.insertBefore(line, anchor);
  else container.appendChild(line);
}

function ensureDropLine(): HTMLElement {
  if (!dropLine) {
    dropLine = document.createElement("div");
    dropLine.className = "drop-line";
  }
  return dropLine;
}

function clearDrag(): void {
  drag = undefined;
  if (dropLine && dropLine.parentElement) dropLine.parentElement.removeChild(dropLine);
  document
    .querySelectorAll(".group-head.drop-into")
    .forEach((el) => el.classList.remove("drop-into"));
}
