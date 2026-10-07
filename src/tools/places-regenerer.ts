// npm run places:regenerer -- <id>… [--svg] — réécrit un lieu (R1e, consigne §4) :
// - lieu N1 : plan d'auteur (`src/tools/places/auteur/<id>.ts`) → data/places/<id>.json, puis ses plans SVG (plan coté, coupe
//   du mur, élévations des portes) dans docs/places/<id>/ ; avec `--svg`, seulement les plans SVG ;
// - lieu N2 : relance le générateur (plan figé data/places/generated/<id>.json) — seulement sur demande explicite.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { PlaceSchema } from "../data/placeSchema";
import type { Place } from "../data/placeSchema";
import { readPlace, readWalls } from "./places/check";
import { placeSvgs } from "./places/svgFiles";
import { AUTHORS } from "./places/auteur";
import { GENERATED } from "./places/generes";

const args = process.argv.slice(2);
const svgOnly = args.includes("--svg");
const ids = args.filter((a) => !a.startsWith("--"));
if (ids.length === 0) {
  console.error("places:regenerer : indiquer au moins un lieu (ex. npm run places:regenerer -- shiganshina).");
  process.exit(1);
}
const { walls, errors } = readWalls();
if (!walls) {
  console.error(errors.join("\n"));
  process.exit(1);
}
let failed = 0;
for (const id of ids) {
  const author = AUTHORS[id];
  const gen = GENERATED[id];
  if (gen) {
    const plan = gen();
    writeFileSync(`data/places/generated/${id}.json`, `${JSON.stringify(plan)}\n`);
    console.log(`${id} (N2) : plan figé réécrit (${plan.b.length} bâtiments, graine ${plan.generateur.graine}, générateur v${plan.generateur.version}).`);
    continue;
  }
  let place: Place;
  if (author && !svgOnly) {
    const parsed = PlaceSchema.safeParse(author());
    if (!parsed.success) {
      console.error(`${id} : plan d'auteur invalide :\n${parsed.error.issues.slice(0, 20).map((i) => `  ${i.path.join(".")} : ${i.message}`).join("\n")}`);
      failed++;
      continue;
    }
    place = parsed.data;
    writeFileSync(`data/places/${id}.json`, `${JSON.stringify(place, null, 1)}\n`);
    console.log(`${id} : data/places/${id}.json écrit (${place.rues.length} rues, ${place.ilots.length} îlots, ${place.batiments.length} bâtiments repères).`);
  } else if (existsSync(`data/places/${id}.json`)) {
    const r = readPlace(id);
    if (!r.place) {
      console.error(r.errors.join("\n"));
      failed++;
      continue;
    }
    place = r.place;
  } else {
    console.error(`${id} : lieu inconnu (ni plan d'auteur, ni générateur, ni fichier).`);
    failed++;
    continue;
  }
  const dir = `docs/places/${id}`;
  mkdirSync(dir, { recursive: true });
  for (const [file, text] of Object.entries(placeSvgs(place, walls))) writeFileSync(`${dir}/${file}`, `${text}\n`);
  console.log(`${id} : plans SVG écrits dans ${dir}/.`);
}
if (failed) process.exit(1);
