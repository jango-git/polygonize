import { Ferrsign0 } from "ferrsign";

// Theme override, persisted in localStorage. "dark"/"light" force that theme; "auto"
// follows the system preference (the default, and what having both toggles on means).
// The concrete resolved theme is written to <html data-theme="dark|light">, which drives
// the token overrides in tokens.css. An inline script in index.html applies the same
// resolution before first paint to avoid a flash; initTheme() re-applies and keeps auto
// mode in sync with system changes.
export type ThemeMode = "auto" | "dark" | "light";

const THEME_KEY = "polygonize:theme";
const darkQuery = matchMedia("(prefers-color-scheme: dark)");

export const themeChanged = new Ferrsign0();

let mode: ThemeMode = read();

function read(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === "dark" || raw === "light" || raw === "auto") return raw;
  } catch (err) {
    console.warn("Failed to read theme", err);
  }
  return "auto";
}

// The concrete theme in effect: the forced mode, or the system preference under auto.
function resolved(): "dark" | "light" {
  if (mode === "auto") return darkQuery.matches ? "dark" : "light";
  return mode;
}

function apply(): void {
  document.documentElement.dataset.theme = resolved();
}

export function getThemeMode(): ThemeMode {
  return mode;
}

export function setThemeMode(next: ThemeMode): void {
  if (next === mode) return;
  mode = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (err) {
    console.warn("Failed to save theme", err);
  }
  apply();
  themeChanged.emit();
}

export function initTheme(): void {
  apply();
  // A forced theme ignores the system; only auto tracks it.
  darkQuery.addEventListener("change", () => {
    if (mode !== "auto") return;
    apply();
    themeChanged.emit();
  });
}
