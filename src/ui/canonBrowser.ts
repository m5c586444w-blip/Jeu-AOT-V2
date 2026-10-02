import { checkCanon, formatViolation } from "../data/canonRules";
import type { RawData, RawEntry } from "../data/canonRules";
import { COLLECTION_NAMES } from "../data/collections";
import type { CollectionName } from "../data/collections";
import { t } from "../i18n";

// Les données ne sont chargées qu'à la demande (commande « canon ») : elles restent hors du paquet principal.
const DATA_FILES = import.meta.glob<unknown>("/data/**/*.json", { import: "default" });

/** Rapport canon:check calculé dans le navigateur, avec les mêmes règles pures que le CLI. */
export async function canonReportFromBundle(): Promise<string> {
  const raw: RawData = { provinces: [], characters: [], techs: [], events: [], placements: [] };
  for (const [path, load] of Object.entries(DATA_FILES)) {
    const collection = path.split("/")[2] as CollectionName;
    if (!COLLECTION_NAMES.includes(collection)) continue;
    const json = await load();
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
