// npm run assets:check — fichiers externes de R1c (docs/art/assets/) : entrée au manifeste, licence CC0 ou CC-BY attribuée,
// source retenue (MakeHuman, Poly Haven), empreinte exacte. Code 1 au moindre écart.
import { checkAssets } from "./assetsCheck";

const root = process.argv[2] ?? "docs/art/assets";
const licenses = process.argv[3] ?? "docs/ASSETS_LICENSES.md";
const r = checkAssets(root, licenses);
for (const e of r.errors) console.error(`  KO  ${e}`);
if (r.errors.length > 0) {
  console.error(`assets:check : ${r.errors.length} écart(s) (${r.entries} entrées, ${r.files} fichiers).`);
  process.exit(1);
}
console.log(`assets:check : ${r.entries} entrées, ${r.files} fichiers ; licences, sources et empreintes conformes.`);
