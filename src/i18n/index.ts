import en from "./locales/en.json";
import ru from "./locales/ru.json";
import uk from "./locales/uk.json";
import be from "./locales/be.json";
import kk from "./locales/kk.json";
import zhHans from "./locales/zh-Hans.json";
import es from "./locales/es.json";
import hi from "./locales/hi.json";
import pt from "./locales/pt.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";
import ja from "./locales/ja.json";
import tr from "./locales/tr.json";
import id from "./locales/id.json";
import bn from "./locales/bn.json";
import ko from "./locales/ko.json";
import vi from "./locales/vi.json";
import it from "./locales/it.json";
import pl from "./locales/pl.json";
import uz from "./locales/uz.json";
import az from "./locales/az.json";

export type Dict = typeof en;

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

const DICTS: Record<string, DeepPartial<Dict>> = {
  en,
  "zh-Hans": zhHans,
  hi,
  es,
  fr,
  bn,
  pt,
  ru,
  id,
  de,
  ja,
  tr,
  vi,
  ko,
  it,
  pl,
  uk,
  uz,
  az,
  kk,
  be,
};

export const DEFAULT_LOCALE = "en";
const STORAGE_KEY = "polygonize:locale";

export function availableLocales(): string[] {
  return Object.keys(DICTS);
}

function detectLocale(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && DICTS[stored]) return stored;
  } catch {}
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const pref of prefs) {
    if (!pref) continue;
    if (DICTS[pref]) return pref;
    const base = pref.toLowerCase().split("-")[0];
    const hit = availableLocales().find((code) => code.toLowerCase().split("-")[0] === base);
    if (hit) return hit;
  }
  return DEFAULT_LOCALE;
}

let active = detectLocale();

export function getLocale(): string {
  return active;
}

export function setLocale(code: string): void {
  if (!DICTS[code] || code === active) return;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    return;
  }
  location.reload();
}

function lookup(dict: DeepPartial<Dict> | Dict, key: string): unknown {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node == null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function resolve(key: string): string | PluralForms | undefined {
  const fromActive = lookup(DICTS[active], key);
  if (fromActive !== undefined) return fromActive as string | PluralForms;
  const fromEn = lookup(en, key);
  return fromEn as string | PluralForms | undefined;
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
