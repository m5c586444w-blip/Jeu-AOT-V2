// npm run canon:check [dossier] — règles R1–R15 ; code de sortie 1 si une règle échoue.
import { checkCanon, formatViolation } from "../data/canonRules";
import { COLLECTION_NAMES } from "../data/collections";
import { loadRawDir } from "../data/loadRaw";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkCreationEntry } from "../data/emblemSchemas";

const dir = process.argv[2] ?? "data";
const { raw, errors } = loadRawDir(dir);
const violations = checkCanon(raw);
// R15 — créations de lore (emblèmes) : canon A, raison, inscription dans docs/lore/creations.md.
const embFile = join(dir, "emblems", "emblems.json");
if (existsSync(embFile)) {
  const listing = existsSync("docs/lore/creations.md") ? readFileSync("docs/lore/creations.md", "utf8") : "";
  const parsed = JSON.parse(readFileSync(embFile, "utf8")) as { emblems?: { id: string }[] };
  for (const e of parsed.emblems ?? []) for (const m of checkCreationEntry(e, listing)) violations.push({ rule: "R15", file: embFile, id: e.id, message: m });
}
for (const e of errors) console.error(`LECTURE ${e}`);
for (const v of violations) console.error(formatViolation(v));
if (errors.length > 0 || violations.length > 0) {
  console.error(`canon:check : ${violations.length} violation(s), ${errors.length} erreur(s) de lecture dans « ${dir} ».`);
  process.exit(1);
}
const total = COLLECTION_NAMES.reduce((n, c) => n + raw[c].length, 0);
console.log(`canon:check : « ${dir} » conforme (R1–R15, ${total} entrées).`);
