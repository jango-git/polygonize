import { geometry, hex, round } from "./geometry.js";

export function buildSvg(): string {
  const { positions, colors, count, width, height } = geometry();
  const body: string[] = [];
  for (let t = 0; t < count; t++) {
    const o = t * 9;
    const pts =
      `${round(positions[o])},${round(positions[o + 1])} ` +
      `${round(positions[o + 3])},${round(positions[o + 4])} ` +
      `${round(positions[o + 6])},${round(positions[o + 7])}`;
    const co = t * 3;
    const fill = hex(colors[co], colors[co + 1], colors[co + 2]);
    body.push(`<polygon points="${pts}" fill="${fill}" stroke="${fill}" stroke-width="1"/>`);
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">\n${body.join("\n")}\n</svg>\n`
  );
}
