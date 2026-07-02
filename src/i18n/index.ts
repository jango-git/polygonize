import { readString, writeString } from "../persistence/localStore.js";

// Locale dictionaries are fetched at runtime (see initI18n), not bundled, so the
// browser downloads only the active locale plus the English fallback. The dict
// type is derived from en.json via `typeof import(...)`, which is type-only and
// emits no runtime import - en.json stays out of the bundle.
type Dict = typeof import("./locales/en.json");

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

type Leaves<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : `${K}.${Leaves<T[K]>}`;
    }[keyof T & string];

export type TKey = Leaves<Dict>;

type Params = Record<string, string | number>;

type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>>;

export const LOCALE_NAMES: Record<string, string> = {
  en: "English",
  "zh-Hans": "中文（简体）",
  hi: "हिन्दी",
  es: "Español",
  fr: "Français",
  bn: "বাংলা",
  pt: "Português",
  ru: "Русский",
  id: "Bahasa Indonesia",
  de: "Deutsch",
  ja: "日本語",
  tr: "Türkçe",
  vi: "Tiếng Việt",
  ko: "한국어",
  it: "Italiano",
  pl: "Polski",
  uk: "Українська",
  uz: "Oʻzbekcha",
  az: "Azərbaycan",
  kk: "Қазақша",
  be: "Беларуская",
};

export function localeBadge(code: string): string {
  return code.split("-")[0].toUpperCase();
}

const DEFAULT_LOCALE = "en";
const STORAGE_KEY = "polygonize:locale";

export function availableLocales(): string[] {
  return Object.keys(LOCALE_NAMES);
}

function detectLocale(): string {
  const stored = readString(STORAGE_KEY);
  if (stored && LOCALE_NAMES[stored]) return stored;
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const pref of prefs) {
    if (!pref) continue;
    if (LOCALE_NAMES[pref]) return pref;
    const base = pref.toLowerCase().split("-")[0];
    const hit = availableLocales().find((code) => code.toLowerCase().split("-")[0] === base);
    if (hit) return hit;
  }
  return DEFAULT_LOCALE;
}

// Detection is deferred to initI18n (awaited before any t() call), so the module-load
// value only needs to be a valid locale for a stray pre-init getLocale().
let active = DEFAULT_LOCALE;
let activeDict: DeepPartial<Dict> = {};
let fallbackDict: DeepPartial<Dict> = {};

async function loadDict(code: string): Promise<DeepPartial<Dict>> {
  // Resolve next to the bundle (dist/locales/...), mirroring the wasm asset.
  const url = new URL(`locales/${code}.json`, import.meta.url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load locale "${code}": ${res.status}`);
  return (await res.json()) as DeepPartial<Dict>;
}

// Must be awaited before any t() call. Loads the English fallback and (if
// different) the detected active locale; a failed active load falls back to en.
export async function initI18n(): Promise<void> {
  active = detectLocale();
  const [fallback, current] = await Promise.all([
    loadDict(DEFAULT_LOCALE),
    active === DEFAULT_LOCALE
      ? Promise.resolve(null)
      : loadDict(active).catch((err) => {
          console.warn(err);
          return null;
        }),
  ]);
  fallbackDict = fallback;
  activeDict = current ?? fallback;
}

export function getLocale(): string {
  return active;
}

export function setLocale(code: string): void {
  if (!LOCALE_NAMES[code] || code === active) return;
  // Only reload if the choice was actually persisted; otherwise the reload would revert.
  if (!writeString(STORAGE_KEY, code)) return;
  location.reload();
}

function lookup(dict: DeepPartial<Dict>, key: string): unknown {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node == null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function resolve(key: string): string | PluralForms | undefined {
  const fromActive = lookup(activeDict, key);
  if (fromActive !== undefined) return fromActive as string | PluralForms;
  return lookup(fallbackDict, key) as string | PluralForms | undefined;
}

const interpolate = (template: string, params?: Params): string =>
  params
    ? template.replace(/\{(\w+)\}/g, (whole, name: string) =>
        name in params ? formatValue(params[name]) : whole,
      )
    : template;

function formatValue(value: string | number): string {
  return typeof value === "number" ? new Intl.NumberFormat(active).format(value) : value;
}

function selectPlural(forms: PluralForms, count: number): string {
  const category = new Intl.PluralRules(active).select(count);
  return forms[category] ?? forms.other ?? Object.values(forms)[0] ?? "";
}

export function t(key: TKey, params?: Params): string {
  const entry = resolve(key);
  if (entry === undefined) return key;
  if (typeof entry === "string") return interpolate(entry, params);
  const count = typeof params?.count === "number" ? params.count : 0;
  return interpolate(selectPlural(entry, count), params);
}
