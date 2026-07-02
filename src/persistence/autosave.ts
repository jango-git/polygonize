import { serializeDocument } from "../document/selectors/document.js";
import { signals } from "../document/signals.js";
import { t } from "../i18n/index.js";
import { notify } from "../ui/noticeStack.js";
import { STORAGE_KEY, idbPut } from "./idb.js";

const SAVE_DELAY_MS = 300;
let timer: number | undefined;

export function startAutosave(): void {
  signals.document.on(() => {
    if (timer !== undefined) clearTimeout(timer);
    timer = window.setTimeout(save, SAVE_DELAY_MS);
  });
}

async function save(): Promise<void> {
  try {
    await idbPut(STORAGE_KEY, serializeDocument());
  } catch (err) {
    console.warn("Autosave failed", err);
    // De-duped in the notice stack, so a persistent failure on the 300ms debounce
    // loop refreshes one message instead of flooding.
    notify(t("notice.autosaveFailed"));
  }
}
