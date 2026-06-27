import { restoreDocument } from "../document/commands/image.js";
import type { DocumentData } from "../document/types.js";
import { STORAGE_KEY } from "./autosave.js";
import { idbGet, idbPut } from "./idb.js";

export async function autoload(): Promise<boolean> {
  try {
    let doc = await idbGet<Partial<DocumentData>>(STORAGE_KEY);

    if (!doc) {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        doc = JSON.parse(raw) as Partial<DocumentData>;
        await idbPut(STORAGE_KEY, doc);
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    if (!doc) return false;
    await restoreDocument(doc);
    return true;
  } catch (err) {
    console.warn("Autoload failed", err);
    return false;
  }
}
