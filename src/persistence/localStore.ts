// Guarded localStorage access. Every touch is wrapped: storage can throw (private mode,
// quota exceeded, cookies disabled) and a persistence failure must never break the app.
// Callers own their own validation/merge/notify on top of these primitives; this module
// only guarantees the raw get/set never throws.

export function readString(key: string): string | undefined {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch (err) {
    console.warn("localStorage read failed", key, err);
    return undefined;
  }
}

export function writeString(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn("localStorage write failed", key, err);
    return false;
  }
}

export function readJson<T>(key: string): T | undefined {
  const raw = readString(key);
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn("localStorage parse failed", key, err);
    return undefined;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  let json: string;
  try {
    json = JSON.stringify(value);
  } catch (err) {
    console.warn("localStorage serialize failed", key, err);
    return false;
  }
  return writeString(key, json);
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn("localStorage remove failed", key, err);
  }
}
