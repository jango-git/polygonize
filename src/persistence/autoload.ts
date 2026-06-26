import { restoreDocument } from "../document/commands/image.js";
import type { DocumentData } from "../document/types.js";
import { STORAGE_KEY } from "./autosave.js";

export async function autoload(): Promise<boolean> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    const doc = JSON.parse(raw) as DocumentData;
    await restoreDocument(doc);
    return true;
  } catch (err) {
    console.warn("Autoload failed", err);
    return false;
  }
}
