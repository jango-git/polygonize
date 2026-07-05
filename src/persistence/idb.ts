// Frozen at the old project name on purpose: renaming the DB would orphan every user's
// autosaved document. The stored name is an opaque identifier, not user-facing branding.
const DB_NAME = "polygonize";
const STORE = "state";
const DB_VERSION = 1;

/** Key under which the autosaved document lives (written by autosave, read by autoload). */
export const STORAGE_KEY = "polygonize:document";

let databasePromise: Promise<IDBDatabase> | undefined;

function getDB(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        databasePromise = undefined;
        reject(request.error);
      };
    });
  }
  return databasePromise;
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE, "readonly").objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function idbPut(key: string, value: unknown): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
