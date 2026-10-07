// npm run map:terrain — carte réaliste de l'île (MAP.1, MAP.2) : terrain, côte, fleuves, villes, routes et dessin des
// provinces, générés de façon déterministe puis figés dans data/map/terrain/paradis.json (graine, version, empreinte).
// `-- --check` : régénère en mémoire et compare l'empreinte au fichier committé, sans rien écrire (CMAP-06).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fnv1a } from "../sim/core/hash";
import { generateTerrain, neighborDiff } from "./terrain/generate";
import type { ProvinceDef } from "./terrain/generate";
import type { Layout } from "./terrain/layout";

const OUT = "data/map/terrain/paradis.json";
const t0 = performance.now();
const layout = JSON.parse(readFileSync("data/map/paradis.layout.json", "utf8")) as Layout;
const provinces = JSON.parse(readFileSync("data/provinces/paradis.json", "utf8")) as ProvinceDef[];
const map = JSON.parse(readFileSync("data/map/paradis.json", "utf8")) as { neighbors: Record<string, string[]> };
const body = generateTerrain(layout, provinces, map.neighbors);
const hash = (fnv1a(JSON.stringify(body)) >>> 0).toString(16).padStart(8, "0");
const out = { ...body, hash };
const diff = neighborDiff(body.neighbors, map.neighbors);
const ms = Math.round(performance.now() - t0);
console.log(`map:terrain : graine ${body.seed}, empreinte ${hash}, ${Object.keys(body.provinces).length} provinces, ${body.rivers.length} fleuves, ${body.towns.length} villes, ${body.roads.length} routes, ${body.bridges.length} ponts, ${body.islets.length} îlots (${ms} ms).`);
console.log(`voisinage dessiné / données : ${diff.length === 0 ? "identique" : `${diff.length} écart(s)`}`);
for (const d of diff) console.log(`  - ${d}`);
if (process.argv.includes("--check")) {
  const committed = JSON.parse(readFileSync(OUT, "utf8")) as { hash: string };
  const same = committed.hash === hash;
  console.log(same ? `fichier figé reproduit à l'identique (${hash})` : `ÉCART : fichier ${committed.hash}, régénéré ${hash}`);
  process.exit(same && diff.length === 0 ? 0 : 1);
}
mkdirSync("data/map/terrain", { recursive: true });
writeFileSync(OUT, JSON.stringify(out) + "\n");
console.log(`écrit : ${OUT} (${Math.round(JSON.stringify(out).length / 1024)} Kio)`);
process.exit(diff.length === 0 ? 0 : 1);
