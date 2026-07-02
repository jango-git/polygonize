import {
  absorbLooseModifiers,
  addGroup,
  clearLooseModifiers,
  clearStack,
  expandGroupSolo,
  moveModifier,
  removeGroup,
  removeGroupDeep,
  removeModifier,
  renameGroup,
  setGroupCollapsed,
  sortStack,
  setGroupMuted,
  soloGroup,
  updateModifier,
} from "../../document/commands/modifiers.js";
import { getStack } from "../../document/selectors/document.js";
import { groupColorCss } from "../../domain/groupColor.js";
import { signals } from "../../document/signals.js";
import type {
  BezierModifier,
  GroupUUID,
  Modifier,
  PathInterpolation,
  PathModifier,
  StackEntry,
} from "../../document/types.js";
import { getLocale, t } from "../../i18n/index.js";
import { getActiveGroup } from "../activeGroup.js";
import { attachCountdownConfirm } from "../countdownConfirm.js";
import {
  focusRequested,
  getSelected,
  setSelected,
  setSelectedGroup,
  toggleGroup,
} from "../selection.js";
import { attachTooltip } from "../tooltip.js";
import { ICONS } from "./icons.js";
import { buildSlider, iconToggle, makeIconButton, makeSection } from "./controls.js";
import { attachDragSource, registerContainer, registerGroupHeadTarget } from "./dnd.js";

// A second click within this window of the first (on the same already-selected
// group) renames; otherwise a click just selects/deselects.
const DOUBLE_CLICK_MS = 400;
// Kept at module scope so it survives the re-render the first click triggers
// (a per-header closure would be discarded with the old element).
let lastGroupClick: { uuid: GroupUUID; at: number } | null = null;
// Alphabetical sort toggles direction on each press; kept at module scope so it
// survives the re-render that sorting triggers.
let sortDescending = false;

// Response curve for the modifier point-count slider: gamma > 1 devotes more of
// the track to low point counts, where each added point matters most.
const POINT_COUNT_GAMMA = 2.5;

// Count-start values for the panel's confirm buttons; the countdown mechanism itself lives
// in countdownConfirm.ts. Clearing is a heavier gesture (4 clicks) than a single removal.
const CLEAR_COUNT_START = 4;
const REMOVE_COUNT_START = 1;

export function buildModifierSection(): HTMLElement {
  const section = makeSection(t("panel.modifiers.title"), t("panel.modifiers.hint"));

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
      ICONS.sortAlpha,
      t("panel.modifiers.sortAlpha.label"),
      t("panel.modifiers.sortAlpha.tip"),
      () => {
        const collator = new Intl.Collator(getLocale(), { numeric: true, sensitivity: "base" });
        const dir = sortDescending ? -1 : 1;
        sortStack(stackEntryLabel, (a, b) => dir * collator.compare(a, b));
        sortDescending = !sortDescending;
      },
    ),
    buildClearLooseButton(),
    buildClearAllButton(),
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
    const activeGroup = getActiveGroup();
    const hasLoose = stack.some((e) => e.type === "modifier");
    const counter = { n: 0 };
    // Render groups above loose modifiers regardless of their position in the
    // stack. This is display-only: the underlying stack order (which is
    // semantically meaningful for the pipeline) is left untouched.
    for (const entry of stack) {
      if (entry.type === "group") {
        list.appendChild(buildGroup(entry, counter, activeGroup, hasLoose));
      }
    }
    for (const entry of stack) {
      if (entry.type === "modifier") {
        counter.n += 1;
        list.appendChild(buildModifierCard(entry.modifier, counter.n, null));
      }
    }
  }

  section.appendChild(list);
  return section;
}

function buildGroup(
  entry: Extract<StackEntry, { type: "group" }>,
  counter: { n: number },
  activeGroup: GroupUUID | null,
  hasLoose: boolean,
): HTMLElement {
  const { group, children } = entry;
  const isActive = group.uuid === activeGroup;

  const box = document.createElement("div");
  box.className = "modifier-group";
  // Per-group accent for the left spine (the `.active` rule still overrides it
  // with the global accent while the group is selected). Keyed on the group name,
  // matching the preview overlay and point tint.
  box.style.setProperty("--group-spine", groupColorCss(group.name));
  if (group.muted) box.classList.add("muted");
  if (isActive) box.classList.add("active");
  box.dataset.entryId = group.uuid;

  const head = document.createElement("div");
  head.className = "group-head";
  registerGroupHeadTarget(head, group.uuid);
  attachDragSource(head, box, "group", group.uuid);
  // A single click selects the group (the active target for new modifiers); a
  // quick second click on the same group renames it. Rename no longer requires the
  // group to already be selected, so it is always two quick clicks regardless of
  // state (a muted group needed a third click before). A slow click just toggles
  // selection.
  head.addEventListener("click", (e) => {
    const quick =
      lastGroupClick?.uuid === group.uuid && e.timeStamp - lastGroupClick.at <= DOUBLE_CLICK_MS;
    lastGroupClick = { uuid: group.uuid, at: e.timeStamp };
    if (quick) {
      setSelectedGroup(group.uuid);
      startRename(group.uuid);
    } else {
      toggleGroup(group.uuid);
    }
  });

  const grip = document.createElement("span");
  grip.className = "group-grip";
  grip.innerHTML = ICONS.grip;
  attachTooltip(grip, t("panel.modifiers.dragGroup"), t("panel.modifiers.dragGroupTip"));

  const caret = document.createElement("button");
  caret.className = "group-caret";
  attachTooltip(
    caret,
    group.collapsed ? t("panel.modifiers.expand") : t("panel.modifiers.collapse"),
    t("panel.modifiers.caretTip"),
  );
  caret.innerHTML = group.collapsed ? ICONS.caretRight : ICONS.caretDown;
  caret.addEventListener("click", (e) => {
    e.stopPropagation();
    if (group.collapsed) {
      // Opening a folder selects it (the active target new modifiers drop into)
      // and collapses the others, so only one group is open at a time. Collapsing
      // leaves the selection untouched, so the group stays the active target.
      expandGroupSolo(group.uuid);
      setSelectedGroup(group.uuid);
    } else {
      setGroupCollapsed(group.uuid, true);
    }
  });

  const name = document.createElement("span");
  name.className = "group-name";
  name.textContent = group.name;
  attachTooltip(name, t("panel.modifiers.rename"), t("panel.modifiers.renameTip"));

  const count = document.createElement("span");
  count.className = "group-count";
  count.textContent = String(children.length);
  attachTooltip(count, t("panel.modifiers.count"), t("panel.modifiers.countTip"));

  // Solo: mute every other group so only this one reaches the pipeline.
  const solo = document.createElement("button");
  solo.className = "group-solo";
  attachTooltip(solo, t("panel.modifiers.solo.label"), t("panel.modifiers.solo.tip"));
  solo.innerHTML = ICONS.solo;
  solo.addEventListener("click", (e) => {
    e.stopPropagation();
    soloGroup(group.uuid);
  });

  const mute = document.createElement("button");
  mute.className = group.muted ? "group-mute active" : "group-mute";
  attachTooltip(
    mute,
    group.muted ? t("panel.modifiers.unmute") : t("panel.modifiers.mute"),
    t("panel.modifiers.muteTip"),
  );
  mute.innerHTML = group.muted ? ICONS.muted : ICONS.unmuted;
  mute.addEventListener("click", (e) => {
    e.stopPropagation();
    setGroupMuted(group.uuid, !group.muted);
  });

  // Pull all loose (ungrouped) modifiers into this group. Only shown when some exist.
  let absorb: HTMLButtonElement | null = null;
  if (hasLoose) {
    absorb = document.createElement("button");
    absorb.className = "group-absorb";
    attachTooltip(absorb, t("panel.modifiers.absorb.label"), t("panel.modifiers.absorb.tip"));
    absorb.innerHTML = ICONS.absorb;
    absorb.addEventListener("click", (e) => {
      e.stopPropagation();
      absorbLooseModifiers(group.uuid);
    });
  }

  // Ungroup: dissolve the group but keep its modifiers (they become loose).
  const ungroup = document.createElement("button");
  ungroup.className = "group-ungroup";
  attachTooltip(ungroup, t("panel.modifiers.ungroup.label"), t("panel.modifiers.ungroup.tip"));
  ungroup.innerHTML = ICONS.ungroup;
  attachCountdownConfirm(ungroup, ICONS.ungroup, REMOVE_COUNT_START, () => removeGroup(group.uuid));

  // Delete the group together with its modifiers.
  const remove = document.createElement("button");
  remove.className = "group-remove";
  attachTooltip(
    remove,
    t("panel.modifiers.deleteGroup.label"),
    t("panel.modifiers.deleteGroup.tip"),
  );
  remove.innerHTML = ICONS.trash;
  attachCountdownConfirm(remove, ICONS.trash, REMOVE_COUNT_START, () =>
    removeGroupDeep(group.uuid),
  );

  head.append(grip, caret, name, count, solo, mute);
  if (absorb) head.append(absorb);
  head.append(ungroup, remove);
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

  // Selecting the modifier happens on a click anywhere in the card; the interactive
  // controls (eject/remove buttons, the point slider, the path/bezier toggles) each
  // stopPropagation so they do not also toggle the selection.
  card.addEventListener("click", () => {
    if (getSelected() === mod.uuid) {
      // Deselecting a modifier drops to its parent group so that group stays the
      // active drop target; only a root modifier clears the selection outright.
      if (group) setSelectedGroup(group);
      else setSelected(null);
      return;
    }
    setSelected(mod.uuid);
    // Frame the modifier in the preview only when selecting it (not deselecting).
    focusRequested.emit(mod.uuid);
  });

  const head = document.createElement("div");
  head.className = "card-head";

  const grip = document.createElement("span");
  grip.className = "card-grip";
  grip.innerHTML = ICONS.grip;
  attachTooltip(grip, t("panel.modifiers.dragCard"));

  const title = document.createElement("span");
  title.className = "card-title";
  title.textContent = `${index}. ${kindLabel(mod.kind)}`;

  // Take this modifier out of its group (becomes a loose top-level modifier).
  let eject: HTMLButtonElement | null = null;
  if (group !== null) {
    eject = document.createElement("button");
    eject.className = "card-eject";
    attachTooltip(eject, t("panel.modifiers.eject.label"), t("panel.modifiers.eject.tip"));
    eject.innerHTML = ICONS.eject;
    eject.addEventListener("click", (e) => {
      e.stopPropagation();
      moveModifier(mod.uuid, null, null);
    });
  }

  const remove = document.createElement("button");
  remove.className = "card-remove";
  attachTooltip(
    remove,
    t("panel.modifiers.removeModifier.label"),
    t("panel.modifiers.removeModifier.tip"),
  );
  remove.innerHTML = ICONS.close;
  attachCountdownConfirm(remove, ICONS.close, REMOVE_COUNT_START, () => removeModifier(mod.uuid));

  head.append(grip, title);
  if (eject) head.append(eject);
  head.append(remove);
  card.appendChild(head);

  const isPolyline = mod.kind === "path" && mod.interpolation === "polyline";
  const min = isPolyline ? mod.vertices.length : 3;
  const step = isPolyline ? 2 : 1;
  const slider = buildSlider({
    label: t("panel.modifiers.points"),
    tip: t("panel.modifiers.pointsTip"),
    limits: { min, max: min + 200, step },
    value: mod.pointCount,
    gamma: POINT_COUNT_GAMMA,
    format: (v) => (isPolyline && v <= min ? t("panel.modifiers.corners") : String(v)),
    onInput: (v) => updateModifier(mod.uuid, { pointCount: v }),
    onChange: () => {},
  });
  slider.addEventListener("click", (e) => e.stopPropagation());
  const range = slider.querySelector("input");
  if (range) suspendDragWhileActive(card, range);
  card.appendChild(slider);

  if (mod.kind === "path") card.appendChild(buildPathControls(mod));
  else if (mod.kind === "bezier") card.appendChild(buildBezierControls(mod));

  return card;
}

function buildClosedToggle(mod: PathModifier | BezierModifier): HTMLButtonElement {
  return iconToggle(
    ICONS.closed,
    t("panel.modifiers.closed"),
    mod.closed,
    (e) => {
      e.stopPropagation();
      updateModifier(mod.uuid, { closed: !mod.closed });
      signals.modifiers.emit();
    },
    t("panel.modifiers.closedTip"),
  );
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
    tip: string,
  ): HTMLButtonElement =>
    iconToggle(
      icon,
      label,
      mod.interpolation === value,
      (e) => {
        e.stopPropagation();
        if (mod.interpolation === value) return;
        updateModifier(mod.uuid, { interpolation: value });
        signals.modifiers.emit();
      },
      tip,
    );
  seg.append(
    interpButton(
      "polyline",
      ICONS.polyline,
      t("panel.kind.polyline"),
      t("panel.modifiers.polylineTip"),
    ),
    interpButton(
      "catmullrom",
      ICONS.curve,
      t("panel.kind.catmullrom"),
      t("panel.modifiers.catmullromTip"),
    ),
  );

  row.append(seg, buildClosedToggle(mod));
  return row;
}

function buildBezierControls(mod: BezierModifier): HTMLElement {
  const row = document.createElement("div");
  row.className = "path-controls";
  const spacer = document.createElement("div");
  row.append(spacer, buildClosedToggle(mod));
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

// The text shown for a stack entry, used as the sort key. Groups sort by their
// user-given name; modifiers by their localized kind label.
function stackEntryLabel(entry: StackEntry): string {
  return entry.type === "group" ? entry.group.name : kindLabel(entry.modifier.kind);
}

function kindLabel(kind: Modifier["kind"]): string {
  switch (kind) {
    case "path":
      return t("panel.kind.path");
    case "circle":
      return t("panel.kind.circle");
    case "bezier":
      return t("panel.kind.bezier");
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
  // The head is a drag source; disable it while editing so the pointer can select
  // text in the input instead of starting a group drag. The next render (on
  // commit/cancel) rebuilds a fresh, draggable head.
  if (input.parentElement) input.parentElement.draggable = false;
  input.focus();
  input.select();
  // A click in the input bubbles to the head; stop it so it does not re-enter
  // rename via the header click handler.
  input.addEventListener("click", (e) => e.stopPropagation());

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

export function cancelRename(): void {
  renaming = null;
}

function buildClearAllButton(): HTMLElement {
  const button = document.createElement("button");
  button.className = "panel-button subtle icon-button danger";
  button.innerHTML = ICONS.trash;
  attachTooltip(button, t("panel.modifiers.clearAll.label"), t("panel.modifiers.clearAll.tip"));
  attachCountdownConfirm(button, ICONS.trash, CLEAR_COUNT_START, clearStack);
  return button;
}

function buildClearLooseButton(): HTMLElement {
  const button = document.createElement("button");
  button.className = "panel-button subtle icon-button danger clear-loose";
  button.innerHTML = ICONS.trashLoose;
  attachTooltip(button, t("panel.modifiers.clearLoose.label"), t("panel.modifiers.clearLoose.tip"));
  attachCountdownConfirm(button, ICONS.trashLoose, CLEAR_COUNT_START, clearLooseModifiers);
  return button;
}
