import { existsSync, readdirSync, readFileSync } from "node:fs";
import { frozenIds, placeIds, readFrozen, readPlace, readWalls } from "./check";
import { simPopulations } from "./population";

/**
 * Couverture des lieux (C18, cadrage) : pour chaque province de l'atlas (`data/provinces/paradis.json`, 74) et du monde
 * (`data/world_provinces/world.json`, 61), existe-t-il un lieu jouable (`data/places/<id>.json`, N1, ou plan figé de
 * `data/places/generated/`) ? Outil de rapport : il ne mesure ni performance ni qualité, il ne lit rien dans `src/sim` sauf les
 * populations (comme `places:valider`).
 *
 * Rattachement : (1) `province` du lieu, `population.province` ou celle d'une zone annexe (schéma : identifiants `prov_…`) ;
 * (2) segment de mur : couvert quand `_murs.json` décrit l'anneau (Maria, Rose, Sina) ; (3) provinces du monde (`wprov_…`, hors
 * schéma de lieu) : table explicite `RATTACHEMENTS_MONDE` ci-dessous, un renvoi par lieu fait.
 */
export const REGIONS = ["Paradis (murs et anneaux)", "Hors-murs", "Marley", "Hizuru", "Alliés", "Mers", "Résumé de Paradis"] as const;
export type Region = (typeof REGIONS)[number];

/** Provinces du monde rattachées à un lieu fait (le schéma de lieu ne connaît que les `prov_…`). */
export const RATTACHEMENTS_MONDE: Record<string, string> = {
  wprov_liberio_internement: "liberio",
};

export interface Ligne {
  id: string;
  code: string;
  nom: string;
  region: Region;
  nature: string;
  population: number | null;
  poi: number;
  lieux: string[];
  /** Province qui n'a pas à avoir de lieu (mer, agrégat) : comptée à part. */
  sansObjet: boolean;
}

interface AtlasProv { id: string; atlas_code: string; name_key: string; kind: string; region: string; wall: string | null }
interface WorldProv { id: string; code: string; name_key: string; faction: string; type: string }

function lireJson<T>(f: string): T {
  return JSON.parse(readFileSync(f, "utf8")) as T;
}

/** Nombre de POI canon par code d'atlas (tableau « POI canon à modéliser » de docs/spec/06 §2). */
export function poiParCode(dir = "docs/spec"): Record<string, number> {
  const f = readdirSync(dir).find((n) => n.startsWith("06"));
  const out: Record<string, number> = {};
  if (!f) return out;
  let dedans = false;
  for (const l of readFileSync(`${dir}/${f}`, "utf8").split("\n")) {
    if (l.startsWith("## ")) dedans = l.startsWith("## 2.");
    if (!dedans || !l.startsWith("|")) continue;
    const c = (l.split("|")[2] ?? "").trim();
    if (/^[A-Z]\d{2}$/.test(c)) out[c] = (out[c] ?? 0) + 1;
  }
  return out;
}

function noms(dir = "src/i18n"): Record<string, string> {
  return lireJson<Record<string, string>>(`${dir}/fr.json`);
}

function regionAtlas(p: AtlasProv): Region {
  return p.region === "outre_murs" ? "Hors-murs" : "Paradis (murs et anneaux)";
}
function regionMonde(p: WorldProv): Region {
  if (p.faction === "fac_marley") return "Marley";
  if (p.faction === "fac_hizuru") return "Hizuru";
  if (p.faction === "fac_allies") return "Alliés";
  if (p.faction === "mer") return "Mers";
  return "Résumé de Paradis";
}

/** Lieux faits (N1 et plans figés) et provinces `prov_…` qu'ils portent. */
export function lieuxParProvince(dir = "data/places"): Map<string, string[]> {
  const m = new Map<string, string[]>();
  const add = (prov: string | null | undefined, lieu: string): void => {
    if (!prov) return;
    const l = m.get(prov) ?? [];
    if (!l.includes(lieu)) l.push(lieu);
    m.set(prov, l);
  };
  for (const id of placeIds(dir)) {
    const { place } = readPlace(id, dir);
    if (!place) continue;
    add(place.province, id);
    add(place.population.province, id);
    for (const z of place.zones) add(z.population.province, id);
  }
  for (const id of frozenIds(dir)) {
    const { plan } = readFrozen(id, dir);
    if (!plan) continue;
    add(plan.province, id);
  }
  return m;
}

export function analyserCouverture(opts: { places?: string; data?: string } = {}): Ligne[] {
  const placesDir = opts.places ?? "data/places";
  const dataDir = opts.data ?? "data";
  const atlas = lireJson<AtlasProv[]>(`${dataDir}/provinces/paradis.json`);
  const monde = lireJson<WorldProv[]>(`${dataDir}/world_provinces/world.json`);
  const pops = simPopulations();
  const poi = poiParCode();
  const fr = noms();
  const par = lieuxParProvince(placesDir);
  const existants = new Set([...placeIds(placesDir), ...frozenIds(placesDir)]);
  const { walls } = readWalls(placesDir);
  const lignes: Ligne[] = [];
  for (const p of atlas) {
    let lieux = [...(par.get(p.id) ?? [])];
    if (p.kind === "segment" && p.wall && walls && p.wall in walls.anneaux) lieux = [...lieux, `_murs (${p.wall})`];
    lignes.push({ id: p.id, code: p.atlas_code, nom: fr[p.name_key] ?? p.name_key, region: regionAtlas(p), nature: p.kind, population: pops[p.id] ?? null, poi: poi[p.atlas_code] ?? 0, lieux, sansObjet: false });
  }
  for (const p of monde) {
    const r = regionMonde(p);
    const cible = RATTACHEMENTS_MONDE[p.id];
    const lieux = cible && existants.has(cible) ? [cible] : [];
    lignes.push({ id: p.id, code: p.code, nom: fr[p.name_key] ?? p.name_key, region: r, nature: p.type, population: null, poi: poi[p.code] ?? 0, lieux, sansObjet: r === "Mers" || r === "Résumé de Paradis" });
  }
  return lignes;
}

export interface Total { region: Region; total: number; couvertes: number; manquantes: number; sansObjet: number }
export function totaux(l: readonly Ligne[]): { parRegion: Total[]; general: Total } {
  const calc = (region: Region, xs: readonly Ligne[]): Total => {
    const objet = xs.filter((x) => !x.sansObjet);
    const couvertes = objet.filter((x) => x.lieux.length > 0).length;
    return { region, total: objet.length, couvertes, manquantes: objet.length - couvertes, sansObjet: xs.length - objet.length };
  };
  const parRegion = REGIONS.map((r) => calc(r, l.filter((x) => x.region === r)));
  const general = parRegion.reduce((a, t) => ({ ...a, total: a.total + t.total, couvertes: a.couvertes + t.couvertes, manquantes: a.manquantes + t.manquantes, sansObjet: a.sansObjet + t.sansObjet }), { region: REGIONS[0], total: 0, couvertes: 0, manquantes: 0, sansObjet: 0 });
  return { parRegion, general };
}

export function manquantes(l: readonly Ligne[]): Ligne[] {
  return l.filter((x) => !x.sansObjet && x.lieux.length === 0);
}

const fmt = (n: number | null): string => (n === null ? "n/d" : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "));

export function enMarkdown(l: readonly Ligne[]): string {
  const { parRegion, general } = totaux(l);
  const out: string[] = [];
  out.push("# C18 — Couverture des lieux (rapport généré)", "");
  out.push("Généré par `npm run places:couverture` (src/tools/places-couverture.ts). Atlas : `data/provinces/paradis.json` (74) ; monde : `data/world_provinces/world.json` (61). Population : celle de `scn_sandbox_845` pour Paradis, `n/d` pour le monde (la simulation ne porte pas de population par province du monde). POI : lignes du tableau « POI canon » de docs/spec/06 §2. Un lieu couvre une province par `province`, `population.province` ou zone annexe ; un segment de mur par `_murs.json` ; une province du monde par la table `RATTACHEMENTS_MONDE`.", "");
  out.push("## Totaux", "", "| Région | Provinces | Couvertes | Non couvertes | Sans objet (mer, agrégat) |", "|---|---|---|---|---|");
  for (const t of parRegion) out.push(`| ${t.region} | ${t.total} | ${t.couvertes} | ${t.manquantes} | ${t.sansObjet} |`);
  out.push(`| **Total** | **${general.total}** | **${general.couvertes}** | **${general.manquantes}** | **${general.sansObjet}** |`, "");
  for (const r of REGIONS) {
    const xs = l.filter((x) => x.region === r);
    if (xs.length === 0) continue;
    out.push(`## ${r}`, "", "| Id | Code | Nom | Nature | Population | POI | Lieu jouable |", "|---|---|---|---|---|---|---|");
    for (const x of xs) out.push(`| ${x.id} | ${x.code} | ${x.nom} | ${x.nature} | ${fmt(x.population)} | ${x.poi} | ${x.sansObjet ? "sans objet" : x.lieux.length > 0 ? x.lieux.join(", ") : "**manquant**"} |`);
    out.push("");
  }
  return `${out.join("\n")}\n`;
}

export function fichierExiste(f: string): boolean {
  return existsSync(f);
}
