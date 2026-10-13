// npm run canon:check [dossier] — règles R1–R14 ; code de sortie 1 si une règle échoue.
// P9 : chaque campagne (data/campagnes) est vérifiée comme un jeu de données à part (scénario dérivé, événements propres,
// fenêtres de présence au départ).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkCampaigns } from "../campaign/canon";
import type { RawCampaign } from "../campaign/canon";
import { checkCanon, formatViolation } from "../data/canonRules";
import { COLLECTION_NAMES } from "../data/collections";
import { loadRawDir } from "../data/loadRaw";

const dir = process.argv[2] ?? "data";
const { raw, errors } = loadRawDir(dir);
const campaigns: RawCampaign[] = [];
const campDir = join(dir, "campagnes");
if (existsSync(campDir)) {
  for (const f of readdirSync(campDir).filter((x) => x.endsWith(".json")).sort()) {
    try {
      const json: unknown = JSON.parse(readFileSync(join(campDir, f), "utf8"));
      for (const c of Array.isArray(json) ? json : []) if (typeof c === "object" && c !== null) campaigns.push({ file: join(campDir, f), v: c as Record<string, unknown> });
    } catch (e) {
      errors.push(`${join(campDir, f)} : JSON invalide (${(e as Error).message})`);
    }
  }
}
const violations = [...checkCanon(raw), ...checkCampaigns(raw, campaigns)];
for (const e of errors) console.error(`LECTURE ${e}`);
for (const v of violations) console.error(formatViolation(v));
if (errors.length > 0 || violations.length > 0) {
  console.error(`canon:check : ${violations.length} violation(s), ${errors.length} erreur(s) de lecture dans « ${dir} ».`);
  process.exit(1);
}
const total = COLLECTION_NAMES.reduce((n, c) => n + raw[c].length, 0);
console.log(`canon:check : « ${dir} » conforme (R1–R14, ${total} entrées ; ${campaigns.length} campagnes : ${campaigns.map((c) => String(c.v["id"])).join(", ")}).`);
