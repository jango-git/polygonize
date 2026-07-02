import { clamp255, geometry, round } from "./geometry.js";

export function buildPdf(): Blob {
  const { positions, colors, count, width, height } = geometry();

  const operations: string[] = ["1 w"];
  for (let t = 0; t < count; t++) {
    const offset = t * 9;
    const colorOffset = t * 3;
    const color = pdfColor(colors[colorOffset], colors[colorOffset + 1], colors[colorOffset + 2]);
    operations.push(`${color} rg`, `${color} RG`);
    const pointA = `${round(positions[offset])} ${round(height - positions[offset + 1])}`;
    const pointB = `${round(positions[offset + 3])} ${round(height - positions[offset + 4])}`;
    const pointC = `${round(positions[offset + 6])} ${round(height - positions[offset + 7])}`;
    operations.push(`${pointA} m`, `${pointB} l`, `${pointC} l`, "h", "B");
  }
  const content = operations.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${round(width)} ${round(height)}] ` +
      "/Contents 4 0 R /Resources << >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` + `startxref\n${xrefStart}\n%%EOF\n`;

  return new Blob([pdf], { type: "application/pdf" });
}

function pdfColor(red: number, green: number, blue: number): string {
  const component = (value: number): string =>
    (clamp255(value) / 255).toFixed(4).replace(/\.?0+$/, "") || "0";
  return `${component(red)} ${component(green)} ${component(blue)}`;
}
