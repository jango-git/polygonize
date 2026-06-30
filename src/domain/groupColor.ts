// Per-group accent colors derived from the group NAME (like Blender collection
// colors): the name hashes to a hue, so renaming a group recolors it, two groups
// that share a name share a color, and reordering the stack never disturbs any
// color. Saturation/lightness are fixed so every group reads as an equally
// weighted accent. Consumed by the panel (CSS spine), the preview path overlays,
// and the modifier-point tint in the pipeline.

const SAT = 0.72;
const LIGHT = 0.6;

/** Hue in turns (0..1) for a group, from an FNV-1a hash of its name. A good hash
 *  spreads even near-identical names (e.g. "Group" vs "Group.001") across the
 *  wheel. */
export function groupHue(name: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x100000000;
}

/** `hsl(...)` string for CSS (panel spine). */
export function groupColorCss(name: string): string {
  return `hsl(${(groupHue(name) * 360).toFixed(1)} ${(SAT * 100).toFixed(0)}% ${(LIGHT * 100).toFixed(0)}%)`;
}

/** Packed 0xRRGGBB for three.js (`Color.setHex`) and the point tint buffer. */
export function groupColorHex(name: string): number {
  const { r, g, b } = hslToRgb(groupHue(name), SAT, LIGHT);
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
