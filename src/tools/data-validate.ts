// npm run data:validate [dossier] — valide /data (ou un dossier de fixtures) ; code de sortie 1 en cas d'erreur.
import { loadBalanceDir, loadDataDir } from "../data/loadNode";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkMap, MapSchema } from "../data/map";
import { FiguresR3FileSchema, MaterialsFileSchema, StylesFileSchema, TitansFileSchema, WallsFileSchema } from "../data/artSchemas";
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
// Données de rendu (R1b) : profils de style, matériaux, murs. Hors des collections de jeu (le worker ne les charge pas).
let artCount = 0;
for (const [file, schema] of [
  ["styles.json", StylesFileSchema],
  ["materiaux.json", MaterialsFileSchema],
  ["murs.json", WallsFileSchema],
  ["titans.json", TitansFileSchema],
  ["figures_r3.json", FiguresR3FileSchema],
] as const) {
  const full = join(dir, "art", file);
  if (!existsSync(full)) continue;
  const parsed = schema.safeParse(JSON.parse(readFileSync(full, "utf8")));
  if (!parsed.success) for (const i of parsed.error.issues) issues.push({ file: full, jsonPath: jsonPath(i.path), message: i.message });
  else if (Array.isArray(parsed.data)) artCount = parsed.data.length;
}
if (issues.length > 0) {
  for (const i of issues) console.error(`ERREUR ${formatIssue(i)}`);
  console.error(`data:validate : ${issues.length} erreur(s) dans « ${dir} ».`);
  process.exit(1);
}
const counts = `${data.provinces.length} provinces, ${data.characters.length} personnages, ${data.techs.length} technologies, ${data.events.length} événements, ${data.shifters.length} Titans-porteurs, ${data.placements.length} positionnements, ${data.buildings.length} bâtiments, ${data.scenarios.length} scénarios ; équilibrage : ${Object.keys(balance).join(", ") || "aucun"} ; rendu : ${artCount} profils de style`;
console.log(`data:validate : « ${dir} » valide (${counts}).`);
