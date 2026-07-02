import { clamp255, geometry, round } from "./geometry.js";

export function buildPdf(): Blob {
  const { positions, colors, count, width, height } = geometry();

  const ops: string[] = ["1 w"];
  for (let t = 0; t < count; t++) {
    const o = t * 9;
    const co = t * 3;
    const c = pdfColor(colors[co], colors[co + 1], colors[co + 2]);
    ops.push(`${c} rg`, `${c} RG`);
    const a = `${round(positions[o])} ${round(height - positions[o + 1])}`;
    const b = `${round(positions[o + 3])} ${round(height - positions[o + 4])}`;
    const cc = `${round(positions[o + 6])} ${round(height - positions[o + 7])}`;
    ops.push(`${a} m`, `${b} l`, `${cc} l`, "h", "B");
  }
  const content = ops.join("\n");

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
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` + `startxref\n${xrefStart}\n%%EOF\n`;

  return new Blob([pdf], { type: "application/pdf" });
}

function pdfColor(r: number, g: number, b: number): string {
  const v = (n: number): string => (clamp255(n) / 255).toFixed(4).replace(/\.?0+$/, "") || "0";
  return `${v(r)} ${v(g)} ${v(b)}`;
}
