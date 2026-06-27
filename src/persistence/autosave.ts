import { serializeDocument } from "../document/selectors/document.js";
import { signals } from "../document/signals.js";
import { idbPut } from "./idb.js";

export const STORAGE_KEY = "polygonize:document";

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
  }
}
