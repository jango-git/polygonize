import { ICONS as SHARED_ICONS } from "../icons.js";

// Panel-specific glyphs for the modifier stack (group / card controls) and the settings
// sections. The topbar / file-action set lives in ../icons.js; only `trace` is shared.
export const ICONS = {
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

  trace: SHARED_ICONS.trace,
};
