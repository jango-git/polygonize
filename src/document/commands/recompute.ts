import { samplePointColor, sampleTriangleColor } from "../../domain/color.js";
import { triangulate } from "../../domain/triangulation.js";
import { getColorSettings } from "../../settings/store.js";
import { store } from "../store.js";
import { newTriangleUUID, type Color, type Point, type PointUUID } from "../types.js";

export function recomputeTriangles(): void {
  const data = store.data();
  const byUUID = new Map<PointUUID, Point>();
  for (const p of data.points) byUUID.set(p.uuid, p);

  const colorSettings = getColorSettings();
  const indices = triangulate(data.points, data.constraintEdges);

  if (colorSettings.strategy === "vertices") {
    const pointColors = new Map<PointUUID, Color>();
    for (const p of data.points) {
      pointColors.set(p.uuid, samplePointColor(p.x, p.y, colorSettings));
    }
    data.triangles = indices.map(({ a, b, c }) => {
      const ca = pointColors.get(a)!;
      const cb = pointColors.get(b)!;
      const cc = pointColors.get(c)!;
      return {
        uuid: newTriangleUUID(),
        a,
        b,
        c,
        color: averageColor(ca, cb, cc),
        vertexColors: [ca, cb, cc] as [Color, Color, Color],
      };
    });
    return;
  }

  data.triangles = indices.map(({ a, b, c }) => {
    const pa = byUUID.get(a)!;
    const pb = byUUID.get(b)!;
    const pc = byUUID.get(c)!;
    return {
      uuid: newTriangleUUID(),
      a,
      b,
      c,
      color: sampleTriangleColor(pa, pb, pc, colorSettings),
    };
  });
}

function averageColor(a: Color, b: Color, c: Color): Color {
  return {
    r: Math.round((a.r + b.r + c.r) / 3),
    g: Math.round((a.g + b.g + c.g) / 3),
    b: Math.round((a.b + b.b + c.b) / 3),
  };
}
