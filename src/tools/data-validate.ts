// npm run data:validate [dossier] — valide /data (ou un dossier de fixtures) ; code de sortie 1 en cas d'erreur.
import { loadDataDir } from "../data/loadNode";
import { formatIssue } from "../data/validate";

const dir = process.argv[2] ?? "data";
const { data, issues } = loadDataDir(dir);
if (issues.length > 0) {
  for (const i of issues) console.error(`ERREUR ${formatIssue(i)}`);
  console.error(`data:validate : ${issues.length} erreur(s) dans « ${dir} ».`);
  process.exit(1);
}
const counts = `${data.provinces.length} provinces, ${data.characters.length} personnages, ${data.techs.length} technologies, ${data.events.length} événements, ${data.placements.length} positionnements`;
console.log(`data:validate : « ${dir} » valide (${counts}).`);
