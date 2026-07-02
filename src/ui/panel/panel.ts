import { setGroupCollapsed } from "../../document/commands/groupCommands.js";
import { getStack } from "../../document/selectors/document.js";
import { signals } from "../../document/signals.js";
import { getSelected, revealRequested, selectionChanged } from "../selection.js";
import { buildModifierSection, cancelRename } from "./stackView.js";
import { buildColorSection, buildPointSection, buildTraceSection } from "./sections.js";

// The left panel: the modifier stack plus the point / trace / color settings sections. This
// coordinator owns only the render lifecycle (rebuild on any source change) and the
// reveal-from-canvas scroll; each section builds itself in its own module.
export function mountPanel(container: HTMLElement): void {
  const render = (): void => {
    cancelRename();
    container.innerHTML = "";
    container.appendChild(buildModifierSection());
    container.appendChild(buildPointSection());
    container.appendChild(buildTraceSection());
    container.appendChild(buildColorSection());
  };
  render();
  signals.modifiers.on(render);
  signals.image.on(render);
  selectionChanged.on(render);
  // Collapsing every group returns the list to its top so the groups are back in view.
  signals.groupsCollapsed.on(() => container.scrollTo({ top: 0 }));
  // Only scroll a card into view when the selection came from a canvas pick;
  // clicking a card in the panel leaves the list where it is.
  revealRequested.on(revealSelected);
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
      ?.scrollIntoView({ block: "center" });
  });
}
