import { signals } from "../document/signals.js";
import { store } from "../document/store.js";
import { collectModifiers } from "../document/stack.js";
import { SLIVER_THRESHOLD, triangleSpike } from "../domain/triangleQuality.js";
import { t } from "../i18n/index.js";

export function mountStatsOverlay(container: HTMLElement): void {
  const box = document.createElement("div");
  box.className = "stats-overlay";

  const title = document.createElement("div");
  title.className = "stats-title";
  title.textContent = t("stats.title");
  box.appendChild(title);

  const pointsVal = makeRow(box, t("stats.points"));
  const polygonsVal = makeRow(box, t("stats.polygons"));
  const sliversVal = makeRow(box, t("stats.slivers"));
  const modifiersVal = makeRow(box, t("stats.modifiers"));

  container.appendChild(box);

  const update = (): void => {
    const data = store.data();
    pointsVal.textContent = String(data.points.length);
    polygonsVal.textContent = String(data.triangleCount);
    sliversVal.textContent = String(countSlivers(data.renderPositions, data.triangleCount));
    modifiersVal.textContent = String(collectModifiers(data.stack).length);
  };

  update();
  signals.triangles.on(update);
  signals.modifiers.on(update);
}

function countSlivers(positions: Float32Array, count: number): number {
  let slivers = 0;
  for (let t = 0; t < count; t++) {
    const o = t * 9;
    const spike = triangleSpike(
      positions[o],
      positions[o + 1],
      positions[o + 3],
      positions[o + 4],
      positions[o + 6],
      positions[o + 7],
    );
    if (spike > SLIVER_THRESHOLD) slivers++;
  }
  return slivers;
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
