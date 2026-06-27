import { Preview } from "./preview/preview.js";
import { connectPreview } from "./preview/receiving.js";
import { mountPanel } from "./ui/panel.js";
import { mountTopbar } from "./ui/topbar.js";
import { mountModifierPalette } from "./ui/modifierPalette.js";
import { attachInteraction } from "./ui/interaction.js";
import { attachHighlight } from "./ui/highlight.js";
import { ToolController } from "./ui/tools.js";
import { attachHotkeys, mountHotkeyHelp } from "./ui/hotkeys.js";
import { mountStatsOverlay } from "./ui/stats.js";
import { startAutosave } from "./persistence/autosave.js";
import { autoload } from "./persistence/autoload.js";
import { signals } from "./document/signals.js";
import { extractAccentHue } from "./domain/accentColor.js";

async function main(): Promise<void> {
  const topbar = document.getElementById("topbar");
  const stage = document.getElementById("stage");
  const modifiers = document.getElementById("modifiers");
  const panel = document.getElementById("panel");
  if (!topbar || !stage || !modifiers || !panel) {
    throw new Error("Containers #topbar / #stage / #modifiers / #panel not found");
  }

  const preview = new Preview(stage);
  connectPreview(preview);

  const themeMQ = matchMedia("(prefers-color-scheme: dark)");
  const syncBackground = (): void => {
    preview.setBackground(
      getComputedStyle(document.documentElement).getPropertyValue("--stage-bg").trim()
    );
  };
  themeMQ.addEventListener("change", syncBackground);

  attachInteraction(preview);
  attachHighlight(preview);

  const tools = new ToolController(preview);
  mountTopbar(topbar);
  mountModifierPalette(modifiers, tools);
  mountPanel(panel);
  attachHotkeys(tools);
  mountHotkeyHelp(stage);
  mountStatsOverlay(stage);

  signals.image.on(({ image }) => {
    const root = document.documentElement.style;
    if (!image) {
      root.removeProperty("--accent-h");
      root.removeProperty("--accent-s");
      return;
    }
    const hue = extractAccentHue();
    if (hue === null) {
      root.removeProperty("--accent-h");
      root.removeProperty("--accent-s");
    } else {
      root.setProperty("--accent-h", String(hue));
      root.setProperty("--accent-s", "65%");
    }
  });

  startAutosave();
  await autoload();
}

main().catch((err) => {
  console.error(err);
});
