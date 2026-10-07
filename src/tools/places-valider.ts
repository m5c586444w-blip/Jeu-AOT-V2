// npm run places:valider [-- <id>…] [-- --sans-docs] — lieux de data/places (R1e, CR1e-02 à CR1e-05) ; code 1 en cas d'erreur.
import { checkPlace, frozenIds, placeIds, readFrozen, readWalls } from "./places/check";
import { simPopulations } from "./places/population";
import { fr } from "../render/tactical3d/places/svg";

const args = process.argv.slice(2);
const docs = !args.includes("--sans-docs");
const only = args.filter((a) => !a.startsWith("--"));
let errors = 0;
const { walls, errors: wallErrors } = readWalls();
for (const e of wallErrors) console.error(`ERREUR ${e}`);
errors += wallErrors.length;
if (walls) console.log(`_murs.json : valide (Maria, Rose, Sina ; hauteur ${walls.anneaux.maria.hauteur_m.valeur} m [${walls.anneaux.maria.hauteur_m.canon}], base ${walls.anneaux.maria.epaisseur_base_m.valeur} m [${walls.anneaux.maria.epaisseur_base_m.canon}])`);
const provs = simPopulations();
const ids = only.length > 0 ? only.filter((i) => placeIds().includes(i)) : placeIds();
for (const id of ids) {
  const r = checkPlace(id, { docs, provinces: provs });
  const m = r.metrics;
  const head = `${r.errors.length === 0 ? "OK" : "KO"} ${id}`;
  console.log(m ? `${head} : ${fr(m.maisons)} maisons, ${fr(r.place?.batiments.length ?? 0)} repères, ${fr(m.arbres)} arbres` : head);
  for (const z of m?.zones ?? []) console.log(`   zone ${z.zone} (${z.classe}) : ${fr(z.population)} hab. ÷ ${z.densite} = ${fr(z.cible_ha, 1)} ha ; bâti ${fr(z.batie_ha, 1)} ha (îlots ${fr(z.ilots_ha, 1)}, rues ${fr(z.rues_ha, 1)}) ; écart ${z.ecart >= 0 ? "+" : ""}${fr(z.ecart * 100, 1)} % ; ${fr(z.arbres_par_ha_bati, 1)} arbres/ha bâti ; ${fr(z.arbres_ilots_par_ha, 1)} arbres/ha d'îlot`);
  for (const k of m?.parcs ?? []) console.log(`   parc ${k.id} : ${fr(k.ha, 2)} ha, ${k.arbres} arbres (${fr(k.par_ha, 1)}/ha)`);
  for (const e of r.errors) console.error(`   ERREUR ${e}`);
  errors += r.errors.length;
}
for (const id of only.length > 0 ? only.filter((i) => frozenIds().includes(i)) : frozenIds()) {
  const { plan, errors: fe } = readFrozen(id);
  console.log(`${fe.length === 0 ? "OK" : "KO"} ${id} (N2, figé) : ${plan ? `${fr(plan.b.length)} bâtiments, ${fr(plan.t.length)} arbres, population ${fr(plan.population)}, capacité ${fr(plan.capacite)}, générateur ${plan.generateur.nom} v${plan.generateur.version}, graine ${plan.generateur.graine}` : ""}`);
  for (const e of fe) console.error(`   ERREUR ${e}`);
  errors += fe.length;
}
if (errors > 0) {
  console.error(`places:valider : ${errors} erreur(s).`);
  process.exit(1);
}
console.log(`places:valider : ${ids.length} lieu(x) N1 et ${frozenIds().length} plan(s) figé(s) valides${docs ? "" : " (dossiers docs non contrôlés)"}.`);
