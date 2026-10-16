// npm run places:couverture — tableau de couverture des provinces par un lieu jouable (C18) ; écrit docs/reports/C18-couverture.md.
// Outil de rapport : code 0 même s'il manque des lieux (pour échouer : `npm run places:valider -- --couverture`).
import { mkdirSync, writeFileSync } from "node:fs";
import { analyserCouverture, enMarkdown, manquantes, REGIONS, totaux } from "./places/couverture";

const l = analyserCouverture();
const { parRegion, general } = totaux(l);
console.log("Région".padEnd(28), "total couvertes manquantes sans-objet");
for (const t of parRegion) console.log(t.region.padEnd(28), String(t.total).padStart(5), String(t.couvertes).padStart(9), String(t.manquantes).padStart(10), String(t.sansObjet).padStart(10));
console.log("TOTAL".padEnd(28), String(general.total).padStart(5), String(general.couvertes).padStart(9), String(general.manquantes).padStart(10), String(general.sansObjet).padStart(10));
for (const r of REGIONS) {
  const m = manquantes(l).filter((x) => x.region === r);
  if (m.length > 0) console.log(`\nSans lieu (${r}, ${m.length}) : ${m.map((x) => x.code).join(" ")}`);
}
if (!process.argv.includes("--sans-fichier")) {
  mkdirSync("docs/reports", { recursive: true });
  writeFileSync("docs/reports/C18-couverture.md", enMarkdown(l));
  console.log("\nécrit : docs/reports/C18-couverture.md");
}
