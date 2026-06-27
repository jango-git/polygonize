import { signals } from "../document/signals.js";
import { store } from "../document/store.js";
import { collectModifiers } from "../document/types.js";

export function mountStatsOverlay(container: HTMLElement): void {
  const box = document.createElement("div");
  box.className = "stats-overlay";

  const title = document.createElement("div");
  title.className = "stats-title";
  title.textContent = "Stats";
  box.appendChild(title);

  const pointsVal = makeRow(box, "Points");
  const polygonsVal = makeRow(box, "Polygons");
  const modifiersVal = makeRow(box, "Modifiers");

  container.appendChild(box);

  const update = (): void => {
    const data = store.data();
    pointsVal.textContent = String(data.points.length);
    polygonsVal.textContent = String(data.triangles.length);
    modifiersVal.textContent = String(collectModifiers(data.stack).length);
  };

  update();
  signals.triangles.on(update);
  signals.modifiers.on(update);
}

function makeRow(parent: HTMLElement, label: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "stats-row";
  const value = document.createElement("kbd");
  value.className = "stats-value";
  const labelEl = document.createElement("span");
  labelEl.textContent = label;
  row.append(value, labelEl);
  parent.appendChild(row);
  return value;
}
