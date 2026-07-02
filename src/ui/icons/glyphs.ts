// Single source for the 16x16 line glyphs used across the topbar, file actions, help
// dialog and the modifier-stack panel. Each value is a complete <svg> string sized for a
// button; tool-palette icons (24x24) live separately in ./tools.js.
export const ICONS = {
  // Topbar / file actions -------------------------------------------------------------
  loadImage: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="2" y="2.5" width="12" height="11" rx="1.5"/>
    <path d="M8 11V6.2"/>
    <path d="M5.6 8.4 8 6l2.4 2.4"/>
  </svg>`,

  downloadImage: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="2" y="2.5" width="12" height="11" rx="1.5"/>
    <path d="M8 5.2V10"/>
    <path d="M5.6 7.6 8 10l2.4-2.4"/>
  </svg>`,

  trace: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="2" y="2.5" width="12" height="11" rx="1.5" stroke-dasharray="2 1.8" opacity="0.6"/>
    <path d="M4.5 11.5 7 6.2l2.4 3.1 2.6-3.6"/>
    <circle cx="4.5" cy="11.5" r="1.1" fill="currentColor" stroke="none"/>
    <circle cx="7" cy="6.2" r="1.1" fill="currentColor" stroke="none"/>
    <circle cx="9.4" cy="9.3" r="1.1" fill="currentColor" stroke="none"/>
    <circle cx="12" cy="5.7" r="1.1" fill="currentColor" stroke="none"/>
  </svg>`,

  openProject: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M2 12V4.5a1 1 0 0 1 1-1h3l1.5 1.7H13a1 1 0 0 1 1 1V6"/>
    <path d="M2 12l1.7-4.6a1 1 0 0 1 .95-.65h9.6a.6.6 0 0 1 .57.8L14.4 12a1 1 0 0 1-.94.7H3a1 1 0 0 1-1-.7Z"/>
  </svg>`,

  saveProject: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M2.5 3.5a1 1 0 0 1 1-1h7.6L13.5 4.9V12.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1Z"/>
    <path d="M5 2.5v3.2h5.2V2.5"/>
    <rect x="5" y="8.6" width="6" height="4.4"/>
  </svg>`,

  exportSvg: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 2h5l3 3v8.5a.8.8 0 0 1-.8.8H4a.8.8 0 0 1-.8-.8v-11A.8.8 0 0 1 4 2Z"/>
    <path d="M8.8 2v3h3"/>
    <path d="M6.4 11.6 8.2 8.4l1.8 3.2Z"/>
  </svg>`,

  exportPng: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 2h5l3 3v8.5a.8.8 0 0 1-.8.8H4a.8.8 0 0 1-.8-.8v-11A.8.8 0 0 1 4 2Z"/>
    <path d="M8.8 2v3h3"/>
    <circle cx="6.4" cy="9" r=".9"/>
    <path d="M4.4 12 6.6 9.9l1.5 1.3 1.3-1 1.4 1.4"/>
  </svg>`,

  reset: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 8a5 5 0 1 1 1.5 3.6"/>
    <path d="M3 12.5V9h3.5"/>
  </svg>`,

  undo: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 7h6.5a3 3 0 0 1 0 6H6"/>
    <path d="M6.5 4 3.5 7l3 3"/>
  </svg>`,

  redo: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 7H5.5a3 3 0 0 0 0 6H10"/>
    <path d="M9.5 4l3 3-3 3"/>
  </svg>`,

  help: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="8" cy="8" r="6"/>
    <path d="M6.2 6.2a1.8 1.8 0 1 1 2.6 1.7c-.6.3-.8.6-.8 1.3"/>
    <circle cx="8" cy="11.4" r=".6" fill="currentColor" stroke="none"/>
  </svg>`,

  repo: `<svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden="true">
    <path d="M8 1.3a6.7 6.7 0 0 0-2.12 13.06c.34.06.46-.15.46-.32v-1.13c-1.87.4-2.26-.9-2.26-.9-.3-.78-.75-.98-.75-.98-.6-.42.05-.41.05-.41.67.05 1.03.69 1.03.69.6 1.03 1.57.73 1.95.56.06-.44.24-.74.42-.9-1.49-.17-3.06-.75-3.06-3.33 0-.73.26-1.34.69-1.81-.07-.17-.3-.85.07-1.78 0 0 .56-.18 1.84.69a6.4 6.4 0 0 1 3.36 0c1.28-.87 1.84-.69 1.84-.69.37.93.14 1.61.07 1.78.43.47.69 1.08.69 1.81 0 2.59-1.58 3.16-3.08 3.32.24.21.46.62.46 1.26v1.87c0 .18.12.39.46.32A6.7 6.7 0 0 0 8 1.3Z"/>
  </svg>`,

  // View / seed / color settings ------------------------------------------------------
  background: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="2" y="3" width="12" height="10" rx="1.5"/>
    <circle cx="5.6" cy="6.4" r="1.2"/>
    <path d="M2.6 11.5 6 8.2l2.4 2 2.2-2 2.8 3"/>
  </svg>`,

  spikes: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M8 2.2 9.4 13 6.6 13Z"/>
  </svg>`,

  points: `<svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden="true">
    <circle cx="4" cy="5" r="1.35"/>
    <circle cx="11.2" cy="3.8" r="1.35"/>
    <circle cx="7.7" cy="8" r="1.35"/>
    <circle cx="3.6" cy="11.6" r="1.35"/>
    <circle cx="12" cy="11.4" r="1.35"/>
  </svg>`,

  curveDensity: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M2 12C4 12 4.4 4.4 8 4.4S12 12 14 12"/>
    <circle cx="2" cy="12" r="1.1" fill="currentColor" stroke="none"/>
    <circle cx="8" cy="4.4" r="1.1" fill="currentColor" stroke="none"/>
    <circle cx="14" cy="12" r="1.1" fill="currentColor" stroke="none"/>
  </svg>`,

  themeLight: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="8" cy="8" r="3.1"/>
    <path d="M8 1.4v1.7M8 12.9v1.7M1.4 8h1.7M12.9 8h1.7M3.4 3.4l1.2 1.2M11.4 11.4l1.2 1.2M12.6 3.4l-1.2 1.2M4.6 11.4l-1.2 1.2"/>
  </svg>`,

  themeDark: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8 5.6 5.6 0 1 0 13.2 9.6Z"/>
  </svg>`,

  // Modifier-stack panel: group / card controls ---------------------------------------
  grip: `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="4" r="1.5"/><circle cx="5" cy="8" r="1.5"/><circle cx="5" cy="12" r="1.5"/>
    <circle cx="11" cy="4" r="1.5"/><circle cx="11" cy="8" r="1.5"/><circle cx="11" cy="12" r="1.5"/>
  </svg>`,

  caretRight: `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="5,3 11,8 5,13"/>
  </svg>`,

  caretDown: `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="3,5 8,11 13,5"/>
  </svg>`,

  muted: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
    <circle cx="8" cy="8" r="5.5"/>
    <line x1="4.1" y1="4.1" x2="11.9" y2="11.9"/>
  </svg>`,

  unmuted: `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
    <circle cx="8" cy="8" r="5"/>
  </svg>`,

  // This group active (filled centre) while its neighbours are muted (slashed):
  // "solo" this group, muting all others.
  solo: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true">
    <circle cx="8" cy="8" r="3" fill="currentColor" stroke="none"/>
    <circle cx="2.4" cy="8" r="1.6"/>
    <line x1="1.3" y1="6.9" x2="3.5" y2="9.1"/>
    <circle cx="13.6" cy="8" r="1.6"/>
    <line x1="12.5" y1="6.9" x2="14.7" y2="9.1"/>
  </svg>`,

  close: `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
    <line x1="3" y1="3" x2="13" y2="13"/>
    <line x1="13" y1="3" x2="3" y2="13"/>
  </svg>`,

  newGroup: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M2 12.5V4.5a1 1 0 0 1 1-1h3l1.4 1.6H13a1 1 0 0 1 1 1V12.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Z"/>
    <path d="M8 7.4v4M6 9.4h4"/>
  </svg>`,

  sortAlpha: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3.5 2.6v9.8"/>
    <path d="M1.6 10.4 3.5 12.6 5.4 10.4"/>
    <text x="11" y="6.2" font-size="5.4" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif">A</text>
    <text x="11" y="13" font-size="5.4" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif">Z</text>
  </svg>`,

  trash: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 4.5h10"/>
    <path d="M6.2 4.5V3.2a1 1 0 0 1 1-1h1.6a1 1 0 0 1 1 1V4.5"/>
    <path d="M4.4 4.5l.55 8a1 1 0 0 0 1 .93h4.1a1 1 0 0 0 1-.93l.55-8"/>
    <path d="M6.7 6.8v3.9M9.3 6.8v3.9"/>
  </svg>`,

  // Trash with a single loose item dropping in: delete only ungrouped modifiers.
  trashLoose: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 6.5h10"/>
    <path d="M4.6 6.5l.5 7a1 1 0 0 0 1 .93h3.8a1 1 0 0 0 1-.93l.5-7"/>
    <path d="M8 2.2v2.6M6.6 3.6 8 2.2 9.4 3.6"/>
  </svg>`,

  // Folder with a down arrow: pull loose modifiers into this group.
  absorb: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M2 12V5.5a1 1 0 0 1 1-1h3l1.4 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Z"/>
    <path d="M8 6.4v3.4M6.4 8.4 8 10 9.6 8.4"/>
  </svg>`,

  // Folder with an up arrow: dissolve the group, modifiers stay (become loose).
  ungroup: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M2 12V5.5a1 1 0 0 1 1-1h3l1.4 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Z"/>
    <path d="M8 10V6.6M6.4 8.2 8 6.6 9.6 8.2"/>
  </svg>`,

  // Arrow up out of a tray: take this modifier out of its group.
  eject: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M8 9V2.6M5.7 4.9 8 2.6 10.3 4.9"/>
    <path d="M3.5 9v2.5a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V9"/>
  </svg>`,

  polyline: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="2,12 6,5 10,10 14,4"/>
  </svg>`,

  curve: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M2 12C4.5 12 4.5 5 8 5S11.5 12 14 5"/>
  </svg>`,

  closed: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M8 2.5 13.2 6.4 11.2 12.7 4.8 12.7 2.8 6.4Z"/>
  </svg>`,

  median: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" aria-hidden="true">
    <rect x="2.5" y="8.5" width="2.6" height="5"/>
    <rect x="6.7" y="6.5" width="2.6" height="7" fill="currentColor"/>
    <rect x="10.9" y="4.5" width="2.6" height="9"/>
  </svg>`,

  average: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M2 11 5 5 8 11 11 5 14 11"/>
    <path d="M2 8h12" stroke-dasharray="2 2"/>
  </svg>`,

  dice: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
    <rect x="2.5" y="2.5" width="11" height="11" rx="2.5"/>
    <circle cx="5.5" cy="5.5" r="0.9" fill="currentColor" stroke="none"/>
    <circle cx="10.5" cy="5.5" r="0.9" fill="currentColor" stroke="none"/>
    <circle cx="8" cy="8" r="0.9" fill="currentColor" stroke="none"/>
    <circle cx="5.5" cy="10.5" r="0.9" fill="currentColor" stroke="none"/>
    <circle cx="10.5" cy="10.5" r="0.9" fill="currentColor" stroke="none"/>
  </svg>`,
};
