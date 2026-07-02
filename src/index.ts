import { initColorWorker } from "./domain/colorWorkerClient.js";
import { applyColorGrid } from "./document/commands/recompute.js";
import { Preview } from "./preview/preview.js";
import { connectPreview } from "./preview/receiving.js";
import { mountPanel } from "./ui/panel/panel.js";
import { mountTopbar } from "./ui/topbar.js";
import { mountModifierPalette } from "./ui/modifierPalette.js";
import { attachInteraction } from "./ui/interaction.js";
import { attachHighlight } from "./ui/highlight.js";
import { attachPickModifier } from "./ui/pickModifier.js";
import { ToolController } from "./ui/tools.js";
import { attachHotkeys } from "./ui/hotkeys.js";
import { mountHotkeyHelp } from "./ui/hotkeyHelp.js";
import { mountStatsOverlay } from "./ui/stats.js";
import { mountNoticeStack } from "./ui/noticeStack.js";
import { openHelp } from "./ui/help.js";
import { startAutosave } from "./persistence/autosave.js";
import { autoload } from "./persistence/autoload.js";
import { initHistory } from "./document/history.js";
import { signals } from "./document/signals.js";
import { store } from "./document/store.js";
import { initPipelineWorker } from "./domain/pipelineWorkerClient.js";
import { extractAccentHue } from "./domain/accentColor.js";
import { getLocale, initI18n } from "./i18n/index.js";
import { initTheme } from "./ui/theme.js";

async function main(): Promise<void> {
  document.documentElement.lang = getLocale();
  // Re-apply the persisted theme and start tracking system changes in auto mode. The
  // inline script in index.html already set data-theme before paint; this keeps it live.
  initTheme();
  // Locale dictionaries are fetched, not bundled; load them (with the wasm)
  // before anything calls t().
  await initI18n();
  initPipelineWorker();
  initColorWorker(applyColorGrid);
  const topbar = document.getElementById("topbar");
  const stage = document.getElementById("stage");
  const modifiers = document.getElementById("modifiers");
  const panel = document.getElementById("panel");
  if (!topbar || !stage || !modifiers || !panel) {
    throw new Error("Containers #topbar / #stage / #modifiers / #panel not found");
  }

  const preview = new Preview(stage);
  connectPreview(preview);

  attachInteraction(preview);
  attachHighlight(preview);
  attachPickModifier(preview);

  const tools = new ToolController(preview);
  mountTopbar(topbar);
  mountModifierPalette(modifiers, tools);
  mountPanel(panel);
  attachHotkeys(tools, preview);
  mountHotkeyHelp(stage, tools);
  mountStatsOverlay(stage);
  mountNoticeStack(stage);

  signals.image.on(({ image }) => {
    const root = document.documentElement.style;
    if (!image) {
      root.removeProperty("--accent-h");
      root.removeProperty("--accent-s");
      return;
    }
    const hue = extractAccentHue();
    if (hue === undefined) {
      root.removeProperty("--accent-h");
      root.removeProperty("--accent-s");
    } else {
      root.setProperty("--accent-h", String(hue));
      root.setProperty("--accent-s", "65%");
    }
  });

  initHistory();
  startAutosave();
  await autoload();

  if (!store.data().image) openHelp();
}

main().catch((err) => {
  console.error(err);
});
