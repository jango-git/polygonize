import { signals } from "../document/signals.js";
import { store } from "../document/store.js";
import { collectModifiers, type Point, type PointUUID, type Triangle } from "../document/types.js";
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
    polygonsVal.textContent = String(data.triangles.length);
    sliversVal.textContent = String(countSlivers(data.points, data.triangles));
    modifiersVal.textContent = String(collectModifiers(data.stack).length);
  };

  update();
  signals.triangles.on(update);
  signals.modifiers.on(update);
}

function countSlivers(points: Point[], triangles: Triangle[]): number {
  const byUUID = new Map<PointUUID, Point>();
  for (const p of points) byUUID.set(p.uuid, p);
  let count = 0;
  for (const tri of triangles) {
    const a = byUUID.get(tri.a);
    const b = byUUID.get(tri.b);
    const c = byUUID.get(tri.c);
    if (a && b && c && triangleSpike(a.x, a.y, b.x, b.y, c.x, c.y) > SLIVER_THRESHOLD) count++;
  }
  return count;
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
