// Per-group accent colors, derived purely from a group's index in the stack so
// nothing extra has to be persisted. The hue steps by the golden-ratio fraction
// each index: this is linear in the index yet spreads successive groups far
// apart on the wheel, and adding a group only mints a new hue without disturbing
// the colors already assigned. Saturation/lightness are fixed so every group
// reads as an equally weighted accent. Consumed by the panel (CSS spine), the
// preview path overlays, and the modifier-point tint in the pipeline.

const GOLDEN = 0.618033988749895;
const SAT = 0.72;
const LIGHT = 0.6;

/** Hue in turns (0..1) for the group at `index` among the stack's groups. */
export function groupHue(index: number): number {
  return (index * GOLDEN) % 1;
}

/** `hsl(...)` string for CSS (panel spine). */
export function groupColorCss(index: number): string {
  return `hsl(${(groupHue(index) * 360).toFixed(1)} ${(SAT * 100).toFixed(0)}% ${(LIGHT * 100).toFixed(0)}%)`;
}

/** Packed 0xRRGGBB for three.js (`Color.setHex`) and the point tint buffer. */
export function groupColorHex(index: number): number {
  const { r, g, b } = hslToRgb(groupHue(index), SAT, LIGHT);
  return (r << 16) | (g << 8) | b;
}

// Standard HSL -> sRGB, returning 0-255 channels. Kept local so this module
// stays free of three.js (domain is pure logic).
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h * 6;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}
