import { restoreDocument } from "../document/commands/image.js";
import type { DocumentData } from "../document/types.js";
import { t } from "../i18n/index.js";
import { notify } from "../ui/noticeStack.js";
import { STORAGE_KEY, idbGet, idbPut } from "./idb.js";
import { readJson, remove } from "./localStore.js";

export async function autoload(): Promise<boolean> {
  try {
    let doc = await idbGet<Partial<DocumentData>>(STORAGE_KEY);

    if (!doc) {
      // One-time migration of pre-IndexedDB saves (autosave now writes only to IDB).
      // Removable once no lingering localStorage documents are expected in the wild.
      const legacy = readJson<Partial<DocumentData>>(STORAGE_KEY);
      if (legacy) {
        doc = legacy;
        await idbPut(STORAGE_KEY, legacy);
        remove(STORAGE_KEY);
      }
    }

    if (!doc) return false;
    await restoreDocument(doc);
    return true;
  } catch (err) {
    console.warn("Autoload failed", err);
    notify(t("notice.autoloadFailed"));
    return false;
  }
}
