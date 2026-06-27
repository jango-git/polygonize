import {
  getColorSettings,
  getSeed,
  getSeedSettings,
  randomizeSeed,
  regenerateColors,
  regenerateSeed,
  setSeed,
  updateColorSettings,
  updateSeedSettings,
} from "../document/commands/generation.js";
import {
  addGroup,
  moveGroup,
  moveModifier,
  removeGroup,
  removeModifier,
  renameGroup,
  setAllGroupsCollapsed,
  setGroupCollapsed,
  setGroupMuted,
  updateModifier,
} from "../document/commands/modifiers.js";
import { getStack } from "../document/selectors/document.js";
import { signals } from "../document/signals.js";
import type {
  GroupUUID,
  Modifier,
  ModifierUUID,
  PathInterpolation,
  PathModifier,
  StackEntry,
} from "../document/types.js";
import { t } from "../i18n/index.js";
import { COLOR_LIMITS, SEED_LIMITS, type ColorStrategy } from "../settings/types.js";
import { getSelected, selectionChanged, toggleSelected } from "./selection.js";
import { attachTooltip } from "./tooltip.js";

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
  newGroup: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M2 12.5V4.5a1 1 0 0 1 1-1h3l1.4 1.6H13a1 1 0 0 1 1 1V12.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Z"/>
    <path d="M8 7.4v4M6 9.4h4"/>
  </svg>`,
  collapseAll: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4.5 4 8 7 11.5 4"/>
    <path d="M4.5 12 8 9 11.5 12"/>
  </svg>`,
  expandAll: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4.5 6.5 8 3.5 11.5 6.5"/>
    <path d="M4.5 9.5 8 12.5 11.5 9.5"/>
  </svg>`,

  polyline: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="2,12 6,5 10,10 14,4"/>
  </svg>`,

  curve: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M2 12C4.5 12 4.5 5 8 5S11.5 12 14 5"/>
  </svg>`,

  closed: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M8 2.5 13.2 6.4 11.2 12.7 4.8 12.7 2.8 6.4Z"/>
  </svg>`,

  median: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" aria-hidden="true">
    <rect x="2.5" y="8.5" width="2.6" height="5"/>
    <rect x="6.7" y="6.5" width="2.6" height="7" fill="currentColor"/>
    <rect x="10.9" y="4.5" width="2.6" height="9"/>
  </svg>`,

  average: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M2 11 5 5 8 11 11 5 14 11"/>
    <path d="M2 8h12" stroke-dasharray="2 2"/>
  </svg>`,

  dice: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
    <rect x="2.5" y="2.5" width="11" height="11" rx="2.5"/>
    <circle cx="5.5" cy="5.5" r="0.9" fill="currentColor" stroke="none"/>
    <circle cx="10.5" cy="5.5" r="0.9" fill="currentColor" stroke="none"/>
    <circle cx="8" cy="8" r="0.9" fill="currentColor" stroke="none"/>
    <circle cx="5.5" cy="10.5" r="0.9" fill="currentColor" stroke="none"/>
    <circle cx="10.5" cy="10.5" r="0.9" fill="currentColor" stroke="none"/>
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
  signals.image.on(render);
  selectionChanged.on(render);
  selectionChanged.on(revealSelected);
}

function revealSelected(): void {
  const sel = getSelected();
  if (!sel) return;
  for (const entry of getStack()) {
    if (entry.type === "group" && entry.group.collapsed) {
      if (entry.children.some((m) => m.uuid === sel)) {
        setGroupCollapsed(entry.group.uuid, false);
        break;
      }
    }
  }
  requestAnimationFrame(() => {
    document
      .querySelector<HTMLElement>(`.modifier-card[data-entry-id="${sel}"]`)
      ?.scrollIntoView({ block: "nearest" });
  });
}

function buildModifierSection(): HTMLElement {
  const section = makeSection("", t("panel.modifiers.title"), t("panel.modifiers.hint"));

  const toolbar = document.createElement("div");
  toolbar.className = "stack-toolbar";
  toolbar.append(
    makeIconButton(
      ICONS.newGroup,
      t("panel.modifiers.newGroup.label"),
      t("panel.modifiers.newGroup.tip"),
      () => {
        const uuid = addGroup(t("panel.modifiers.defaultGroupName"));
        startRename(uuid);
      },
    ),
    makeIconButton(
      ICONS.collapseAll,
      t("panel.modifiers.collapseAll.label"),
      t("panel.modifiers.collapseAll.tip"),
      () => setAllGroupsCollapsed(true),
    ),
    makeIconButton(
      ICONS.expandAll,
      t("panel.modifiers.expandAll.label"),
      t("panel.modifiers.expandAll.tip"),
      () => setAllGroupsCollapsed(false),
    ),
  );
  section.appendChild(toolbar);

  const stack = getStack();
  const list = document.createElement("div");
  list.className = "modifier-stack";
  registerContainer(list, null);

  if (stack.length === 0) {
    const empty = document.createElement("p");
    empty.className = "section-hint stack-empty";
    empty.textContent = t("panel.modifiers.empty");
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
  attachTooltip(grip, t("panel.modifiers.dragGroup"));
  attachDragSource(grip, box, "group", group.uuid);

  const caret = document.createElement("button");
  caret.className = "group-caret";
  attachTooltip(
    caret,
    group.collapsed ? t("panel.modifiers.expand") : t("panel.modifiers.collapse"),
  );
  caret.innerHTML = group.collapsed ? ICONS.caretRight : ICONS.caretDown;
  caret.addEventListener("click", (e) => {
    e.stopPropagation();
    setGroupCollapsed(group.uuid, !group.collapsed);
  });

  const name = document.createElement("span");
  name.className = "group-name";
  name.textContent = group.name;
  attachTooltip(name, t("panel.modifiers.rename"));
  name.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    startRename(group.uuid);
  });

  const count = document.createElement("span");
  count.className = "group-count";
  count.textContent = String(children.length);

  const mute = document.createElement("button");
  mute.className = group.muted ? "group-mute active" : "group-mute";
  attachTooltip(mute, group.muted ? t("panel.modifiers.unmute") : t("panel.modifiers.mute"));
  mute.innerHTML = group.muted ? ICONS.muted : ICONS.unmuted;
  mute.addEventListener("click", (e) => {
    e.stopPropagation();
    setGroupMuted(group.uuid, !group.muted);
  });

  const remove = document.createElement("button");
  remove.className = "group-remove";
  attachTooltip(remove, t("panel.modifiers.ungroup"));
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
      hint.textContent = t("panel.modifiers.dropHere");
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
  attachTooltip(grip, t("panel.modifiers.dragCard"));

  const title = document.createElement("span");
  title.className = "card-title";
  title.textContent = `${index}. ${kindLabel(mod.kind)}`;

  const remove = document.createElement("button");
  remove.className = "card-remove";
  attachTooltip(remove, t("panel.modifiers.removeModifier"));
  remove.innerHTML = ICONS.close;
  remove.addEventListener("click", (e) => {
    e.stopPropagation();
    removeModifier(mod.uuid);
  });

  head.append(grip, title, remove);
  card.appendChild(head);

  const isPolyline = mod.kind === "path" && mod.interpolation === "polyline";
  const min = isPolyline ? mod.vertices.length : 3;
  const step = isPolyline ? 2 : 1;
  const slider = buildSlider({
    label: t("panel.modifiers.points"),
    limits: { min, max: min + 200, step },
    value: mod.pointCount,
    format: (v) => (isPolyline && v <= min ? t("panel.modifiers.corners") : String(v)),
    onInput: (v) => updateModifier(mod.uuid, { pointCount: v }),
    onChange: () => {},
  });
  const range = slider.querySelector("input");
  if (range) suspendDragWhileActive(card, range);
  card.appendChild(slider);

  if (mod.kind === "path") card.appendChild(buildPathControls(mod));

  return card;
}

function buildPathControls(mod: PathModifier): HTMLElement {
  const row = document.createElement("div");
  row.className = "path-controls";

  const seg = document.createElement("div");
  seg.className = "seg";
  const interpButton = (
    value: PathInterpolation,
    icon: string,
    label: string,
  ): HTMLButtonElement => {
    const btn = document.createElement("button");
    btn.className = "icon-toggle labeled";
    btn.innerHTML = `${icon}<span class="seg-label">${label}</span>`;
    btn.classList.toggle("active", mod.interpolation === value);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (mod.interpolation === value) return;
      updateModifier(mod.uuid, { interpolation: value });
      signals.modifiers.emit();
    });
    return btn;
  };
  seg.append(
    interpButton("polyline", ICONS.polyline, t("panel.kind.polyline")),
    interpButton("catmullrom", ICONS.curve, t("panel.kind.catmullrom")),
  );

  const closedBtn = document.createElement("button");
  closedBtn.className = "icon-toggle labeled";
  closedBtn.innerHTML = `${ICONS.closed}<span class="seg-label">${t("panel.modifiers.closed")}</span>`;
  closedBtn.classList.toggle("active", mod.closed);
  closedBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    updateModifier(mod.uuid, { closed: !mod.closed });
    signals.modifiers.emit();
  });

  row.append(seg, closedBtn);
  return row;
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
    case "path":
      return t("panel.kind.path");
    case "circle":
      return t("panel.kind.circle");
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
  const section = makeSection("", t("panel.pointGen.title"), t("panel.pointGen.hint"));

  const s = getSeedSettings();
  section.appendChild(
    buildSlider({
      label: t("panel.pointGen.perSide"),
      limits: SEED_LIMITS.borderPerSide,
      value: s.borderPerSide,
      format: (v) => String(v),
      onInput: (v) => updateSeedSettings({ borderPerSide: v }),
      onChange: () => regenerateSeed(),
    }),
  );
  section.appendChild(
    buildSlider({
      label: t("panel.pointGen.minRadius"),
      limits: SEED_LIMITS.minRadius,
      value: s.minRadius,
      format: (v) => String(v),
      onInput: (v) => updateSeedSettings({ minRadius: v }),
      onChange: () => regenerateSeed(),
    }),
  );
  section.appendChild(
    buildSlider({
      label: t("panel.pointGen.maxRadius"),
      limits: SEED_LIMITS.maxRadius,
      value: s.maxRadius,
      format: (v) => String(v),
      onInput: (v) => updateSeedSettings({ maxRadius: v }),
      onChange: () => regenerateSeed(),
    }),
  );
  section.appendChild(buildSeedField());

  return section;
}

function buildSeedField(): HTMLElement {
  const field = document.createElement("div");
  field.className = "field";

  const label = document.createElement("label");
  const name = document.createElement("span");
  name.textContent = t("panel.pointGen.seed");
  label.append(name);

  const row = document.createElement("div");
  row.className = "seed-row";

  const input = document.createElement("input");
  input.className = "seed-input";
  input.type = "number";
  input.min = "0";
  input.step = "1";
  input.value = String(getSeed());
  input.addEventListener("change", () => {
    const value = Number(input.value);
    if (Number.isFinite(value) && value >= 0) setSeed(value);
  });

  const randomizeButton = makeIconButton(
    ICONS.dice,
    t("panel.pointGen.randomSeed"),
    t("panel.pointGen.randomSeedHint"),
    () => {
      randomizeSeed();
      input.value = String(getSeed());
    },
  );

  row.append(input, randomizeButton);
  field.append(label, row);
  return field;
}

function buildColorSection(): HTMLElement {
  const section = makeSection("", t("panel.color.title"), t("panel.color.hint"));

  const c = getColorSettings();
  section.appendChild(
    buildSegmentedField<ColorStrategy>(
      t("panel.color.strategy"),
      [
        { value: "median", icon: ICONS.median, label: t("panel.color.median") },
        { value: "average", icon: ICONS.average, label: t("panel.color.average") },
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
      label: t("panel.color.samples"),
      limits: COLOR_LIMITS.samplesPerTriangle,
      value: c.samplesPerTriangle,
      format: (v) => String(v),
      onInput: (v) => updateColorSettings({ samplesPerTriangle: v }),
      onChange: () => regenerateColors(),
    }),
  );

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

function makeIconButton(
  icon: string,
  title: string,
  description: string,
  onClick: () => void,
): HTMLElement {
  const button = document.createElement("button");
  button.className = "panel-button subtle icon-button";
  button.innerHTML = icon;
  attachTooltip(button, title, description);
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

function buildSegmentedField<T extends string>(
  label: string,
  options: Array<{ value: T; icon: string; label: string }>,
  current: T,
  onChange: (v: T) => void,
): HTMLElement {
  const field = document.createElement("div");
  field.className = "field";

  const labelEl = document.createElement("label");
  const name = document.createElement("span");
  name.textContent = label;
  labelEl.append(name);

  const seg = document.createElement("div");
  seg.className = "seg seg-full";

  let active = current;
  const buttons = options.map((opt) => {
    const btn = document.createElement("button");
    btn.className = "icon-toggle labeled";
    btn.innerHTML = `${opt.icon}<span class="seg-label">${opt.label}</span>`;
    btn.classList.toggle("active", opt.value === active);
    btn.addEventListener("click", () => {
      if (opt.value === active) return;
      active = opt.value;
      buttons.forEach((b, i) => b.classList.toggle("active", options[i].value === active));
      onChange(opt.value);
    });
    return btn;
  });
  seg.append(...buttons);

  field.append(labelEl, seg);
  return field;
}
