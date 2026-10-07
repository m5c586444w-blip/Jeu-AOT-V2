import { checkCanon, emptyRaw, formatViolation } from "../data/canonRules";
import type { RawData, RawEntry } from "../data/canonRules";
import { COLLECTION_NAMES } from "../data/collections";
import type { CollectionName } from "../data/collections";
import { t } from "../i18n";

// Les données ne sont chargées qu'à la demande (commande « canon ») : elles restent hors du paquet principal.
const DATA_FILES = import.meta.glob<unknown>(["/data/**/*.json", "!/data/map/**", "!/data/balance/**", "!/data/art/**", "!/data/places/**"], { import: "default" });

/** Rapport canon:check calculé dans le navigateur, avec les mêmes règles pures que le CLI. */
export async function canonReportFromBundle(): Promise<string> {
  const raw: RawData = emptyRaw();
  // Chargement en parallèle : séquentiel, il dépassait 17 s en développement avec les données de P2.
  const files = Object.entries(DATA_FILES)
    .map(([path, load]) => ({ path, load, collection: path.split("/")[2] as CollectionName }))
    .filter((f) => COLLECTION_NAMES.includes(f.collection))
    .sort((a, b) => a.path.localeCompare(b.path));
  const loaded = await Promise.all(files.map(async (f) => ({ ...f, json: await f.load() })));
  for (const { path, collection, json } of loaded) {
    if (!Array.isArray(json)) continue;
    for (const e of json as Record<string, unknown>[]) {
      const entry: RawEntry = { file: path.slice(1), id: typeof e["id"] === "string" ? e["id"] : "?", v: e };
      raw[collection].push(entry);
    }
  }
  const violations = checkCanon(raw);
  const total = COLLECTION_NAMES.reduce((n, c) => n + raw[c].length, 0);
  if (violations.length === 0) return t("console.canon_ok", { n: total });
  return [t("console.canon_ko", { n: violations.length }), ...violations.map(formatViolation)].join("\n");
}
