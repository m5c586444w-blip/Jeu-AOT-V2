import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FrozenPlanSchema, PlaceSchema, WallsParamsSchema } from "../../data/placeSchema";
import type { FrozenPlan, Place, WallsParams } from "../../data/placeSchema";
import { jsonPath } from "../../data/validate";
import { isConvex } from "../../render/tactical3d/places/geom";
import { layoutPlace, placeMetrics } from "../../render/tactical3d/places/layout";
import type { PlaceLayout, PlaceMetrics } from "../../render/tactical3d/places/layout";
import { traceLength } from "../../render/tactical3d/places/walls";
import { placePopulations, simPopulations } from "./population";

/**
 * Contrôle des lieux (R1e, CR1e-02 à CR1e-05) : schéma, renvois internes, population lue dans la simulation, surface bâtie
 * (±25 % de population ÷ densité), arbres, fichiers du dossier `docs/places/<id>/`. Utilisé par `npm run places:valider` et
 * par les tests.
 */
export const PLACES_DIR = "data/places";
export const DOCS_DIR = "docs/places";
export const TOLERANCE = 0.25;
export const TREES_BUILT_MIN = 8;
export const TREES_PARK_MIN = 20;

export interface PlaceReport {
  id: string;
  errors: string[];
  metrics: PlaceMetrics | null;
  layout: PlaceLayout | null;
  place: Place | null;
}

export function readWalls(dir = PLACES_DIR): { walls: WallsParams | null; errors: string[] } {
  const file = join(dir, "_murs.json");
  const parsed = WallsParamsSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed.success) return { walls: null, errors: parsed.error.issues.map((i) => `${file} ${jsonPath(i.path)} : ${i.message}`) };
  return { walls: parsed.data, errors: [] };
}

export function placeIds(dir = PLACES_DIR): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => f.slice(0, -5))
    .sort();
}

export function frozenIds(dir = PLACES_DIR): string[] {
  const g = join(dir, "generated");
  return existsSync(g)
    ? readdirSync(g)
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.slice(0, -5))
        .sort()
    : [];
}

export function readPlace(id: string, dir = PLACES_DIR): { place: Place | null; errors: string[] } {
  const file = join(dir, `${id}.json`);
  const parsed = PlaceSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed.success) return { place: null, errors: parsed.error.issues.slice(0, 20).map((i) => `${file} ${jsonPath(i.path)} : ${i.message}`) };
  if (parsed.data.id !== id) return { place: null, errors: [`${file} : id « ${parsed.data.id} » ≠ nom de fichier`] };
  return { place: parsed.data, errors: [] };
}

export function readFrozen(id: string, dir = PLACES_DIR): { plan: FrozenPlan | null; errors: string[] } {
  const file = join(dir, "generated", `${id}.json`);
  const parsed = FrozenPlanSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed.success) return { plan: null, errors: parsed.error.issues.slice(0, 20).map((i) => `${file} ${jsonPath(i.path)} : ${i.message}`) };
  return { plan: parsed.data, errors: [] };
}

function dupes(kind: string, ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of ids) {
    if (seen.has(i)) out.push(`${kind} en double : ${i}`);
    seen.add(i);
  }
  return out;
}

/** Renvois internes d'un lieu (ids, gabarits, tracés, états) ; îlots convexes. */
export function crossCheck(p: Place, provinces: ReadonlySet<string>): string[] {
  const e: string[] = [];
  e.push(...dupes("rue", p.rues.map((r) => r.id)), ...dupes("îlot", p.ilots.map((b) => b.id)), ...dupes("bâtiment", p.batiments.map((b) => b.id)), ...dupes("porte", p.portes.map((g) => g.id)), ...dupes("vue", p.points_de_vue.map((v) => v.id)), ...dupes("état", p.etats.map((s) => s.id)));
  for (const prov of [p.province, p.population.province, ...p.zones.map((z) => z.population.province)]) if (prov && !provinces.has(prov)) e.push(`province inconnue : ${prov}`);
  const quarters = new Set(p.quartiers.map((q) => q.id));
  const zones = new Set(p.zones.map((z) => z.id));
  for (const b of p.ilots) {
    if (!p.gabarits[b.gabarit]) e.push(`îlot ${b.id} : gabarit inconnu ${b.gabarit}`);
    if (!quarters.has(b.quartier)) e.push(`îlot ${b.id} : quartier inconnu ${b.quartier}`);
    if (b.zone && !zones.has(b.zone)) e.push(`îlot ${b.id} : zone inconnue ${b.zone}`);
    if (!isConvex(b.polygone, 0.02)) e.push(`îlot ${b.id} : polygone non convexe`);
  }
  const streets = new Set(p.rues.map((r) => r.id));
  for (const a of p.vegetation.alignements) if (!streets.has(a.rue)) e.push(`alignement : rue inconnue ${a.rue}`);
  const traces = new Map((p.enceinte?.traces ?? []).map((t) => [t.id, t] as const));
  for (const g of p.portes) {
    const t = traces.get(g.trace);
    if (!t) e.push(`porte ${g.id} : tracé inconnu ${g.trace}`);
    else if (g.s_m > traceLength(t)) e.push(`porte ${g.id} : abscisse ${g.s_m} m au-delà du tracé (${Math.round(traceLength(t))} m)`);
    if (g.vantail.largeur_m < g.passage.largeur_m * 0.9) e.push(`porte ${g.id} : vantail plus étroit que le passage`);
  }
  for (const s of p.enceinte?.escaliers ?? []) if (!traces.has(s.trace)) e.push(`escalier : tracé inconnu ${s.trace}`);
  for (const t of p.enceinte?.canons.traces ?? []) if (!traces.has(t)) e.push(`canons : tracé inconnu ${t}`);
  const gates = new Set(p.portes.map((g) => g.id));
  for (const s of p.etats) for (const g of Object.keys(s.portes)) if (!gates.has(g)) e.push(`état ${s.id} : porte inconnue ${g}`);
  if (!p.etats.some((s) => s.id === p.etat_defaut)) e.push(`état par défaut inconnu : ${p.etat_defaut}`);
  return e;
}

/** Fichiers attendus dans `docs/places/<id>/` (consigne §3.2 et §5). */
export function expectedDocs(p: Place): string[] {
  const out = ["plan.svg", "vue-ensemble.png", "inspirations.md", "lore.md"];
  if (p.enceinte) out.push("mur-coupe.svg");
  for (const g of p.portes) for (const v of GATE_VIEWS) out.push(`porte-${g.id}-${v}.png`);
  for (const v of p.points_de_vue) out.push(`vue-${v.id}.png`);
  if (p.etats.length > 1) for (const s of p.etats) out.push(`etat-${s.id}.png`);
  return out;
}
export const GATE_VIEWS = ["exterieure-face", "exterieure-detail", "interieure-face", "interieure-detail", "passage", "haut", "echelle"] as const;

export function checkPlace(id: string, opts: { docs: boolean; dir?: string; docsDir?: string; provinces?: Record<string, number> }): PlaceReport {
  const { place, errors } = readPlace(id, opts.dir);
  if (!place) return { id, errors, metrics: null, layout: null, place: null };
  const provs = opts.provinces ?? simPopulations();
  const provinceIds = new Set<string>();
  for (const f of readdirSync("data/provinces").filter((x) => x.endsWith(".json"))) for (const x of JSON.parse(readFileSync(join("data/provinces", f), "utf8")) as { id: string }[]) provinceIds.add(x.id);
  const e = [...crossCheck(place, provinceIds)];
  let layout: PlaceLayout | null = null;
  let metrics: PlaceMetrics | null = null;
  try {
    layout = layoutPlace(place);
    metrics = placeMetrics(layout, placePopulations(place, provs));
  } catch (err) {
    e.push(`mise en place : ${String(err)}`);
  }
  if (metrics) {
    for (const z of metrics.zones) {
      if (z.population <= 0) e.push(`zone ${z.zone} : population nulle`);
      if (Math.abs(z.ecart) > TOLERANCE) e.push(`zone ${z.zone} : surface bâtie ${z.batie_ha.toFixed(1)} ha ≠ ${z.population} ÷ ${z.densite} = ${z.cible_ha.toFixed(1)} ha (écart ${(z.ecart * 100).toFixed(1)} %, tolérance 25 %)`);
      if (z.arbres_par_ha_bati < TREES_BUILT_MIN) e.push(`zone ${z.zone} : ${z.arbres_par_ha_bati.toFixed(1)} arbres/ha bâti (< ${TREES_BUILT_MIN})`);
      if (z.classe === "faubourg" && z.arbres_ilots_par_ha < TREES_PARK_MIN) e.push(`zone ${z.zone} (faubourg) : ${z.arbres_ilots_par_ha.toFixed(1)} arbres/ha d'îlot (< ${TREES_PARK_MIN})`);
    }
    for (const k of metrics.parcs) if (k.par_ha < TREES_PARK_MIN) e.push(`parc ${k.id} : ${k.par_ha.toFixed(1)} arbres/ha (< ${TREES_PARK_MIN})`);
  }
  if (opts.docs) {
    const d = join(opts.docsDir ?? DOCS_DIR, id);
    for (const f of expectedDocs(place)) if (!existsSync(join(d, f))) e.push(`docs : fichier manquant ${join(d, f)}`);
  }
  return { id, errors: e, metrics, layout, place };
}
