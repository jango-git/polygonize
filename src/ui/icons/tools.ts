import type { ToolKind } from "../../document/types.js";

// Tool-palette icons use a 24x24 viewBox (larger than the 16x16 button glyphs in
// ./glyphs.js) so the control-point dots read clearly. Only the inner markup is stored;
// toolIconSvg wraps it in the shared <svg> shell.
const TOOL_MARKUP: Record<ToolKind, string> = {
  polyline: `<polyline points="3,18 9,7 15,15 21,5"/>
    <circle cx="3" cy="18" r="1.6" fill="currentColor" stroke="none"/>
    <circle cx="9" cy="7" r="1.6" fill="currentColor" stroke="none"/>
    <circle cx="15" cy="15" r="1.6" fill="currentColor" stroke="none"/>
    <circle cx="21" cy="5" r="1.6" fill="currentColor" stroke="none"/>`,
  circle: `<circle cx="12" cy="12" r="8"/>
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>`,
  catmullrom: `<path d="M3 18 C 7 18, 7 6, 12 6 S 17 18, 21 6"/>
    <circle cx="3" cy="18" r="1.6" fill="currentColor" stroke="none"/>
    <circle cx="12" cy="6" r="1.6" fill="currentColor" stroke="none"/>
    <circle cx="21" cy="6" r="1.6" fill="currentColor" stroke="none"/>`,
  circle3: `<circle cx="12" cy="12" r="8"/>
    <circle cx="12" cy="4" r="1.6" fill="currentColor" stroke="none"/>
    <circle cx="5" cy="17" r="1.6" fill="currentColor" stroke="none"/>
    <circle cx="19" cy="17" r="1.6" fill="currentColor" stroke="none"/>`,
  bezier: `<path d="M4 18 C 4 9, 14 15, 14 6"/>
    <line x1="4" y1="18" x2="4" y2="13"/>
    <line x1="14" y1="6" x2="14" y2="11"/>
    <circle cx="4" cy="13" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="14" cy="11" r="1.5" fill="currentColor" stroke="none"/>
    <rect x="2.6" y="16.6" width="2.8" height="2.8" fill="currentColor" stroke="none"/>
    <rect x="12.6" y="4.6" width="2.8" height="2.8" fill="currentColor" stroke="none"/>`,
};

export function toolIconSvg(kind: ToolKind): string {
  return `<svg class="tool-icon" viewBox="0 0 24 24" width="24" height="24" fill="none"
    stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">${TOOL_MARKUP[kind]}</svg>`;
}

export const CURSOR_ICON = `<svg class="tool-icon" viewBox="0 0 24 24" width="24" height="24"
  fill="currentColor" aria-hidden="true">
  <path d="M5 5 L13 18 L13 13 L18 13 Z"/></svg>`;
