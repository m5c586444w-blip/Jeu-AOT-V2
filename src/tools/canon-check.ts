// npm run canon:check [dossier] — règles R1–R10 ; code de sortie 1 si une règle échoue.
import { checkCanon, formatViolation } from "../data/canonRules";
import { COLLECTION_NAMES } from "../data/collections";
import { loadRawDir } from "../data/loadRaw";

const dir = process.argv[2] ?? "data";
const { raw, errors } = loadRawDir(dir);
const violations = checkCanon(raw);
for (const e of errors) console.error(`LECTURE ${e}`);
for (const v of violations) console.error(formatViolation(v));
if (errors.length > 0 || violations.length > 0) {
  console.error(`canon:check : ${violations.length} violation(s), ${errors.length} erreur(s) de lecture dans « ${dir} ».`);
  process.exit(1);
}
const total = COLLECTION_NAMES.reduce((n, c) => n + raw[c].length, 0);
console.log(`canon:check : « ${dir} » conforme (R1–R10, ${total} entrées).`);
