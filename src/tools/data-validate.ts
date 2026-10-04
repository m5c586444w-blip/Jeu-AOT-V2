// npm run data:validate [dossier] — valide /data (ou un dossier de fixtures) ; code de sortie 1 en cas d'erreur.
import { loadBalanceDir, loadDataDir } from "../data/loadNode";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkMap, MapSchema } from "../data/map";
import { formatIssue, jsonPath } from "../data/validate";

const dir = process.argv[2] ?? "data";
const { data, issues: dataIssues } = loadDataDir(dir);
const { balance, issues: balanceIssues } = loadBalanceDir(dir);
const issues = [...dataIssues, ...balanceIssues];
const mapFile = join(dir, "map", "paradis.json");
if (existsSync(mapFile)) {
  const parsed = MapSchema.safeParse(JSON.parse(readFileSync(mapFile, "utf8")));
  if (!parsed.success) for (const i of parsed.error.issues) issues.push({ file: mapFile, jsonPath: jsonPath(i.path), message: i.message });
  else for (const m of checkMap(parsed.data, data.provinces.map((p) => p.id))) issues.push({ file: mapFile, jsonPath: "$", message: m });
}
if (issues.length > 0) {
  for (const i of issues) console.error(`ERREUR ${formatIssue(i)}`);
  console.error(`data:validate : ${issues.length} erreur(s) dans « ${dir} ».`);
  process.exit(1);
}
const counts = `${data.provinces.length} provinces, ${data.characters.length} personnages, ${data.techs.length} technologies, ${data.events.length} événements, ${data.shifters.length} Titans-porteurs, ${data.placements.length} positionnements, ${data.buildings.length} bâtiments, ${data.scenarios.length} scénarios ; équilibrage : ${Object.keys(balance).join(", ") || "aucun"}`;
console.log(`data:validate : « ${dir} » valide (${counts}).`);
