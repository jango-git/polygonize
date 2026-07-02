import { geometry, hex, round } from "./geometry.js";

export function buildSvg(): string {
  const { positions, colors, count, width, height } = geometry();
  const body: string[] = [];
  for (let t = 0; t < count; t++) {
    const offset = t * 9;
    const points =
      `${round(positions[offset])},${round(positions[offset + 1])} ` +
      `${round(positions[offset + 3])},${round(positions[offset + 4])} ` +
      `${round(positions[offset + 6])},${round(positions[offset + 7])}`;
    const colorOffset = t * 3;
    const fill = hex(colors[colorOffset], colors[colorOffset + 1], colors[colorOffset + 2]);
    body.push(`<polygon points="${points}" fill="${fill}" stroke="${fill}" stroke-width="1"/>`);
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">\n${body.join("\n")}\n</svg>\n`
  );
}
