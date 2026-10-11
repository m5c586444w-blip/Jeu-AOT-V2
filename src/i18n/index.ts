import fr from "./fr.json";
import en from "./en.json";

export type Locale = "fr" | "en";
export type Dictionary = Readonly<Record<string, string>>;
export type Params = Readonly<Record<string, string | number>>;

const DICTIONARIES: Record<Locale, Dictionary> = { fr, en };

/** Valeur numérique d'un paramètre, chiffres formatés compris (« 1 900 », « 2,5 ») ; NaN sinon. */
function numberOf(v: string | number): number {
  return typeof v === "number" ? v : Number(v.replace(/[\s\u00a0\u202f]/g, "").replace(",", "."));
}

/**
 * Remplace `{nom}` par la valeur du paramètre ; un paramètre absent reste visible pour être repéré. Accord en nombre
 * (dette n° 21) : `{nom|singulier|pluriel}` choisit la forme selon la valeur du paramètre : en français, singulier pour 0 et 1
 * (« 0 Titan », « 1 Titan », « 4 Titans ») ; en anglais, pour 1 seulement.
 */
export function interpolate(template: string, params: Params = {}, locale: Locale = "fr"): string {
  return template
    .replace(/\{(\w+)\|([^|{}]*)\|([^|{}]*)\}/g, (whole, name: string, one: string, many: string) => {
      if (!(name in params)) return whole;
      const n = Math.abs(numberOf(params[name] as string | number));
      return (locale === "fr" ? n < 2 : n === 1) ? one : many;
    })
    .replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

/**
 * Articles des toponymes à nom commun (dette n° 31) : `prov.<id>.article` (« le », « la », « les », « l' ») donne, pour le nom
 * `prov.<id>`, la forme contractée après « à » et « de » (« au Plateau du Nord », « des Hameaux de l'Est », « à la Forêt Morte »).
 */
function articlesOf(d: Dictionary): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(d)) {
    if (!k.endsWith(".article")) continue;
    const name = d[k.slice(0, -".article".length)];
    if (name) out.set(name, v);
  }
  return out;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Contractions françaises « à le » → « au », « de les » → « des »… pour les noms insérés qui ont un article. */
export function contractFr(text: string, inserted: readonly string[], articles: ReadonlyMap<string, string>): string {
  let out = text;
  for (const name of new Set(inserted)) {
    const a = articles.get(name);
    if (!a) continue;
    const sep = a.endsWith("'") ? "" : " ";
    const at = a === "le" ? "au " : a === "les" ? "aux " : `à ${a}${sep}`;
    const of = a === "le" ? "du " : a === "les" ? "des " : `de ${a}${sep}`;
    const n = escapeRe(name);
    out = out.replace(new RegExp(`(^|[\\s(«])à ${n}`, "g"), `$1${at}${name}`).replace(new RegExp(`(^|[\\s(«])de ${n}`, "g"), `$1${of}${name}`);
  }
  return out;
}

/** Traducteur : la langue demandée, puis le français (langue de référence), puis la clé elle-même. */
export function createTranslator(locale: Locale, dictionaries: Record<Locale, Dictionary> = DICTIONARIES) {
  const articles = articlesOf(dictionaries.fr);
  return (key: string, params?: Params): string => {
    const own = dictionaries[locale][key];
    const template = own ?? dictionaries.fr[key] ?? key;
    const text = interpolate(template, params, own !== undefined ? locale : "fr");
    if ((locale !== "fr" && own !== undefined) || !params || articles.size === 0) return text;
    return contractFr(text, Object.values(params).filter((v): v is string => typeof v === "string"), articles);
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
