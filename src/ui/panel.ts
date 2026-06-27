import { regenerateColors, regenerateSeed } from "../document/commands/image.js";
import {
  addGroup,
  moveGroup,
  moveModifier,
  removeGroup,
  removeModifier,
  renameGroup,
  setGroupCollapsed,
  setGroupMuted,
  updateModifier,
} from "../document/commands/modifiers.js";
import { getStack } from "../document/selectors/document.js";
import { signals } from "../document/signals.js";
import type { GroupUUID, Modifier, ModifierUUID, StackEntry } from "../document/types.js";
import {
  getColorSettings,
  getSeedSettings,
  updateColorSettings,
  updateSeedSettings,
} from "../settings/store.js";
import { COLOR_LIMITS, SEED_LIMITS, type ColorStrategy } from "../settings/types.js";
import { getSelected, selectionChanged, toggleSelected } from "./selection.js";

const ICONS = {
  grip: `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="4" r="1.5"/><circle cx="5" cy="8" r="1.5"/><circle cx="5" cy="12" r="1.5"/>
    <circle cx="11" cy="4" r="1.5"/><circle cx="11" cy="8" r="1.5"/><circle cx="11" cy="12" r="1.5"/>
  </svg>`,
  caretRight: `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="5,3 11,8 5,13"/>
  </svg>`,
  caretDown: `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="3,5 8,11 13,5"/>
  </svg>`,
  muted: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
    <circle cx="8" cy="8" r="5.5"/>
    <line x1="4.1" y1="4.1" x2="11.9" y2="11.9"/>
  </svg>`,
  unmuted: `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
    <circle cx="8" cy="8" r="5"/>
  </svg>`,
  close: `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
    <line x1="3" y1="3" x2="13" y2="13"/>
    <line x1="13" y1="3" x2="3" y2="13"/>
  </svg>`,
};

interface Limits {
  min: number;
  max: number;
  step: number;
}

interface SliderOptions {
  label: string;
  limits: Limits;
  value: number;
  format: (v: number) => string;
  onInput: (v: number) => void;
  onChange: (v: number) => void;
}

export function mountPanel(container: HTMLElement): void {
  const render = (): void => {
    cancelRename();
    container.innerHTML = "";
    container.appendChild(buildModifierSection());
    container.appendChild(buildPointSection());
    container.appendChild(buildColorSection());
  };
  render();
  signals.modifiers.on(render);
  selectionChanged.on(render);
}

function buildModifierSection(): HTMLElement {
  const section = makeSection(
    "",
    "Modifiers",
    "Non-destructive layers over the base points. Pick a tool on the left; select a card to edit its points on the stage. Drag cards to reorder or to move them between groups.",
  );

  const newGroup = makeButton("New group", "subtle", () => {
    const uuid = addGroup();
    startRename(uuid);
  });
  newGroup.classList.add("new-group-button");
  section.appendChild(newGroup);

  const stack = getStack();
  const list = document.createElement("div");
  list.className = "modifier-stack";
  registerContainer(list, null);

  if (stack.length === 0) {
    const empty = document.createElement("p");
    empty.className = "section-hint stack-empty";
    empty.textContent = "No modifiers yet.";
    list.appendChild(empty);
  } else {
    const counter = { n: 0 };
    for (const entry of stack) {
      if (entry.type === "modifier") {
        counter.n += 1;
        list.appendChild(buildModifierCard(entry.modifier, counter.n, null));
      } else {
        list.appendChild(buildGroup(entry, counter));
      }
    }
  }

  section.appendChild(list);
  return section;
}

function buildGroup(
  entry: Extract<StackEntry, { type: "group" }>,
  counter: { n: number },
): HTMLElement {
  const { group, children } = entry;

  const box = document.createElement("div");
  box.className = "modifier-group";
  if (group.muted) box.classList.add("muted");
  box.dataset.entryId = group.uuid;

  const head = document.createElement("div");
  head.className = "group-head";
  registerGroupHeadTarget(head, group.uuid);

  const grip = document.createElement("span");
  grip.className = "group-grip";
  grip.innerHTML = ICONS.grip;
  grip.title = "Drag to reorder the group";
  attachDragSource(grip, box, "group", group.uuid);

  const caret = document.createElement("button");
  caret.className = "group-caret";
  caret.title = group.collapsed ? "Expand" : "Collapse";
  caret.innerHTML = group.collapsed ? ICONS.caretRight : ICONS.caretDown;
  caret.addEventListener("click", (e) => {
    e.stopPropagation();
    setGroupCollapsed(group.uuid, !group.collapsed);
  });

  const name = document.createElement("span");
  name.className = "group-name";
  name.textContent = group.name;
  name.title = "Double-click to rename";
  name.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    startRename(group.uuid);
  });

  const count = document.createElement("span");
  count.className = "group-count";
  count.textContent = String(children.length);

  const mute = document.createElement("button");
  mute.className = group.muted ? "group-mute active" : "group-mute";
  mute.title = group.muted ? "Unmute group" : "Mute group (skip in pipeline)";
  mute.innerHTML = group.muted ? ICONS.muted : ICONS.unmuted;
  mute.addEventListener("click", (e) => {
    e.stopPropagation();
    setGroupMuted(group.uuid, !group.muted);
  });

  const remove = document.createElement("button");
  remove.className = "group-remove";
  remove.title = "Ungroup (keeps modifiers)";
  remove.innerHTML = ICONS.close;
  remove.addEventListener("click", (e) => {
    e.stopPropagation();
    removeGroup(group.uuid);
  });

  head.append(grip, caret, name, count, mute, remove);
  box.appendChild(head);

  if (!group.collapsed) {
    const body = document.createElement("div");
    body.className = "group-body";
    registerContainer(body, group.uuid);

    if (children.length === 0) {
      const hint = document.createElement("p");
      hint.className = "group-empty";
      hint.textContent = "Drop modifiers here";
      body.appendChild(hint);
    } else {
      for (const mod of children) {
        counter.n += 1;
        body.appendChild(buildModifierCard(mod, counter.n, group.uuid));
      }
    }
    box.appendChild(body);
  }

  return box;
}

function buildModifierCard(mod: Modifier, index: number, group: GroupUUID | null): HTMLElement {
  const card = document.createElement("div");
  card.className = "modifier-card";
  card.dataset.entryId = mod.uuid;
  card.dataset.group = group ?? "";
  if (mod.uuid === getSelected()) card.classList.add("selected");
  attachDragSource(card, card, "modifier", mod.uuid);

  const head = document.createElement("div");
  head.className = "card-head";
  head.addEventListener("click", () => toggleSelected(mod.uuid));

  const grip = document.createElement("span");
  grip.className = "card-grip";
  grip.innerHTML = ICONS.grip;
  grip.title = "Drag the card to reorder or move into a group";

  const title = document.createElement("span");
  title.className = "card-title";
  title.textContent = `${index}. ${kindLabel(mod.kind)}`;

  const remove = document.createElement("button");
  remove.className = "card-remove";
  remove.title = "Remove modifier";
  remove.innerHTML = ICONS.close;
  remove.addEventListener("click", (e) => {
    e.stopPropagation();
    removeModifier(mod.uuid);
  });

  head.append(grip, title, remove);
  card.appendChild(head);

  const min = mod.kind === "polyline" ? mod.vertices.length : 3;
  const step = mod.kind === "polyline" ? 2 : 1;
  const slider = buildSlider({
    label: "Points",
    limits: { min, max: min + 200, step },
    value: mod.pointCount,
    format: (v) => (mod.kind === "polyline" && v <= min ? "corners" : String(v)),
    onInput: (v) => updateModifier(mod.uuid, { pointCount: v }),
    onChange: () => {},
  });
  const range = slider.querySelector("input");
  if (range) suspendDragWhileActive(card, range);
  card.appendChild(slider);

  return card;
}

function suspendDragWhileActive(card: HTMLElement, control: HTMLElement): void {
  control.addEventListener("pointerdown", () => {
    card.draggable = false;
    window.addEventListener(
      "pointerup",
      () => {
        card.draggable = true;
      },
      { once: true },
    );
  });
}

function kindLabel(kind: Modifier["kind"]): string {
  switch (kind) {
    case "polyline":
      return "Polyline";
    case "circle":
      return "Circle";
    case "catmullrom":
      return "Catmull-Rom";
  }
}

let renaming: GroupUUID | null = null;

function startRename(uuid: GroupUUID): void {
  renaming = uuid;
  const box = document.querySelector<HTMLElement>(`.modifier-group[data-entry-id="${uuid}"]`);
  const name = box?.querySelector<HTMLElement>(".group-name");
  if (!name) return;

  const input = document.createElement("input");
  input.className = "group-name-input";
  input.value = name.textContent ?? "";
  name.replaceWith(input);
  input.focus();
  input.select();

  const commit = (): void => {
    if (renaming !== uuid) return;
    renaming = null;
    const next = input.value.trim();
    if (next) renameGroup(uuid, next);
    else signals.modifiers.emit();
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      renaming = null;
      signals.modifiers.emit();
    }
  });
  input.addEventListener("blur", commit);
}

function cancelRename(): void {
  renaming = null;
}

interface DragState {
  kind: "modifier" | "group";
  uuid: string;
}

let drag: DragState | null = null;
let dropLine: HTMLElement | null = null;

function attachDragSource(
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

function registerContainer(el: HTMLElement, container: GroupUUID | null): void {
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

function registerGroupHeadTarget(head: HTMLElement, group: GroupUUID): void {
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
  let anchor: HTMLElement | null = null;
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
  drag = null;
  if (dropLine && dropLine.parentElement) dropLine.parentElement.removeChild(dropLine);
  document
    .querySelectorAll(".group-head.drop-into")
    .forEach((el) => el.classList.remove("drop-into"));
}

function buildPointSection(): HTMLElement {
  const section = makeSection(
    "regen",
    "Point generation",
    "Bridson Poisson disk with variable radius from Sobel edges. Edges get min radius (dense); flat areas get max radius (sparse). Changes reseed the base (modifiers are kept).",
  );

  const s = getSeedSettings();
  section.appendChild(
    buildSlider({
      label: "Points per side",
      limits: SEED_LIMITS.borderPerSide,
      value: s.borderPerSide,
      format: (v) => String(v),
      onInput: (v) => updateSeedSettings({ borderPerSide: v }),
      onChange: () => regenerateSeed(),
    }),
  );
  section.appendChild(
    buildSlider({
      label: "Min radius, px",
      limits: SEED_LIMITS.minRadius,
      value: s.minRadius,
      format: (v) => String(v),
      onInput: (v) => updateSeedSettings({ minRadius: v }),
      onChange: () => regenerateSeed(),
    }),
  );
  section.appendChild(
    buildSlider({
      label: "Max radius, px",
      limits: SEED_LIMITS.maxRadius,
      value: s.maxRadius,
      format: (v) => String(v),
      onInput: (v) => updateSeedSettings({ maxRadius: v }),
      onChange: () => regenerateSeed(),
    }),
  );

  section.appendChild(makeButton("Regenerate", "danger", () => regenerateSeed()));
  return section;
}

function buildColorSection(): HTMLElement {
  const section = makeSection(
    "regen",
    "Color",
    "Color sampled from the image: a flat fill (median/average) or a per-vertex gradient. Changes recompute all colors.",
  );

  const c = getColorSettings();
  section.appendChild(
    buildSelect<ColorStrategy>(
      "Strategy",
      [
        { value: "median", label: "Median" },
        { value: "average", label: "Average" },
        { value: "vertices", label: "Per-vertex gradient" },
      ],
      c.strategy,
      (v) => {
        updateColorSettings({ strategy: v });
        regenerateColors();
      },
    ),
  );
  section.appendChild(
    buildSlider({
      label: "Samples per triangle",
      limits: COLOR_LIMITS.samplesPerTriangle,
      value: c.samplesPerTriangle,
      format: (v) => String(v),
      onInput: (v) => updateColorSettings({ samplesPerTriangle: v }),
      onChange: () => regenerateColors(),
    }),
  );

  section.appendChild(makeButton("Recompute colors", "danger", () => regenerateColors()));
  return section;
}

function makeSection(variant: string, title: string, hint: string): HTMLElement {
  const section = document.createElement("div");
  section.className = variant ? `panel-section ${variant}` : "panel-section";

  const titleEl = document.createElement("p");
  titleEl.className = "section-title";
  titleEl.textContent = title;
  section.appendChild(titleEl);

  const hintEl = document.createElement("p");
  hintEl.className = "section-hint";
  hintEl.textContent = hint;
  section.appendChild(hintEl);

  return section;
}

function makeButton(text: string, variant: string, onClick: () => void): HTMLElement {
  const button = document.createElement("button");
  button.className = variant ? `panel-button ${variant}` : "panel-button";
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

function buildSlider(opts: SliderOptions): HTMLElement {
  const field = document.createElement("div");
  field.className = "field";

  const label = document.createElement("label");
  const name = document.createElement("span");
  name.textContent = opts.label;
  const value = document.createElement("span");
  value.className = "field-value";
  value.textContent = opts.format(opts.value);
  label.append(name, value);

  const input = document.createElement("input");
  input.type = "range";
  input.min = String(opts.limits.min);
  input.max = String(opts.limits.max);
  input.step = String(opts.limits.step);
  input.value = String(opts.value);

  input.addEventListener("input", () => {
    const v = Number(input.value);
    value.textContent = opts.format(v);
    opts.onInput(v);
  });
  input.addEventListener("change", () => opts.onChange(Number(input.value)));

  field.append(label, input);
  return field;
}

function buildSelect<T extends string>(
  label: string,
  options: Array<{ value: T; label: string }>,
  current: T,
  onChange: (v: T) => void,
): HTMLElement {
  const field = document.createElement("div");
  field.className = "field";

  const labelEl = document.createElement("label");
  const name = document.createElement("span");
  name.textContent = label;
  labelEl.append(name);

  const select = document.createElement("select");
  for (const opt of options) {
    const optionEl = document.createElement("option");
    optionEl.value = opt.value;
    optionEl.textContent = opt.label;
    if (opt.value === current) optionEl.selected = true;
    select.appendChild(optionEl);
  }
  select.addEventListener("change", () => onChange(select.value as T));

  field.append(labelEl, select);
  return field;
}
