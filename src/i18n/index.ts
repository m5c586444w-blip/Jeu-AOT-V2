import fr from "./fr.json";
import en from "./en.json";

export type Locale = "fr" | "en";
export type Dictionary = Readonly<Record<string, string>>;
export type Params = Readonly<Record<string, string | number>>;

const DICTIONARIES: Record<Locale, Dictionary> = { fr, en };

/** Remplace `{nom}` par la valeur du paramètre ; un paramètre absent reste visible pour être repéré. */
export function interpolate(template: string, params: Params = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

/** Traducteur : la langue demandée, puis le français (langue de référence), puis la clé elle-même. */
export function createTranslator(locale: Locale, dictionaries: Record<Locale, Dictionary> = DICTIONARIES) {
  return (key: string, params?: Params): string => {
    const template = dictionaries[locale][key] ?? dictionaries.fr[key] ?? key;
    return interpolate(template, params);
  };
}

let current: Locale = "fr";
let translate = createTranslator(current);

export function setLocale(locale: Locale): void {
  current = locale;
  translate = createTranslator(locale);
}

export function getLocale(): Locale {
  return current;
}

export function t(key: string, params?: Params): string {
  return translate(key, params);
}

export function hasKey(key: string, locale: Locale = "fr"): boolean {
  return key in DICTIONARIES[locale];
}
