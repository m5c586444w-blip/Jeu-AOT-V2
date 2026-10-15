import type { TideBalance } from "../../data/balance";
import type { Season } from "../core/time";
import { addSpike, cellOf, createGrid, localDensity, stepGrid } from "./grid";
import type { Pile, TideGrid } from "./types";

/**
 * Marée régionale à la demande (C9.7, D-173/D-177) : pas de grille mondiale (≈ 316 000 cellules) ; une fenêtre de grille n'existe qu'autour
 * d'une armée exposée aux Titans, naît à l'équilibre de la densité statique de la province, évolue pendant le séjour, puis s'oublie.
 * Pur : aucun DOM, aucun `Math.random`, aucun `Date.now`.
 */
export interface TideRegion {
  /** Jours consécutifs sans armée exposée dans la région. */
  idle: number;
  grid: TideGrid;
}

export interface TideState {
  regions: Record<string, TideRegion>;
}

export const initTide = (): TideState => ({ regions: {} });

/** Armée exposée : sa province (nœud en km), sa faction, ses effectifs par type de régiment (hommes), et si elle marche. */
export interface TideArmy {
  id: string;
  province: string;
  faction: string;
  /** Position du nœud de la province, en kilomètres. */
  xKm: number;
  yKm: number;
  /** Hommes par type de régiment (clés de `region.kind_weapon`). */
  byKind: Record<string, number>;
  moving: boolean;
}

export interface TideDay {
  /** Armées dans une province où les Titans rôdent (la glue exclut les provinces tenues par Paradis). */
  armies: readonly TideArmy[];
  /** Densité statique (0–1) d'une province : celle que la région prolonge. */
  baseDensity: (province: string) => number;
  /** Provinces où une rencontre s'est ouverte aujourd'hui (pic d'attention). */
  clashes: ReadonlySet<string>;
  season: Season;
}

const KM = 1000;

function pileOf(a: TideArmy, b: TideBalance): Pile {
  const r = b.region;
  const troops: Record<string, number> = {};
  for (const [kind, men] of Object.entries(a.byKind).sort(([x], [y]) => x.localeCompare(y))) {
    const w = r.kind_weapon[kind] ?? r.default_weapon;
    troops[w] = (troops[w] ?? 0) + men;
  }
  return {
    id: a.id, faction: a.faction, x: a.xKm * KM, y: a.yKm * KM, troops, ammo: {}, gas: 0, morale: 1, suppression: 0, cover: 0, anchors: 0,
    noise: a.moving ? r.march_noise : r.halt_noise, smoke: 0, scouts: 0, intel: 0, concealment: 0, wounded: 0, dead: 0, evacuated: 0, routed: false,
  };
}

/** Région neuve : fenêtre carrée centrée sur le nœud, densité d'équilibre = densité statique × `per_density`. */
export function createRegion(xKm: number, yKm: number, dens: number, b: TideBalance): TideRegion {
  const r = b.region;
  const n = 2 * r.half_cells + 1;
  const half = r.half_cells * b.grid.cell_m;
  const grid = createGrid(
    { w: n, h: n, originX: xKm * KM - half - b.grid.cell_m / 2, originY: yKm * KM - half - b.grid.cell_m / 2, density: new Array<number>(n * n).fill(dens * r.per_density), capacity: dens * r.capacity_per_density },
    b,
  );
  return { idle: 0, grid };
}

/**
 * Un jour de Marée : crée les régions des armées exposées (ordre des identifiants de province, au plus `max_regions`), fait avancer
 * chaque région aux heures `hours`, ajoute le pic d'attention des rencontres, oublie les régions inoccupées depuis `idle_days` jours.
 */
export function tickTide(s: TideState, day: TideDay, b: TideBalance): TideState {
  const r = b.region;
  const byProvince = new Map<string, TideArmy[]>();
  for (const a of day.armies) byProvince.set(a.province, [...(byProvince.get(a.province) ?? []), a]);
  const regions: Record<string, TideRegion> = {};
  for (const [id, reg] of Object.entries(s.regions)) regions[id] = reg;
  for (const id of [...byProvince.keys()].sort()) {
    if (regions[id] || Object.keys(regions).length >= r.max_regions) continue;
    const first = (byProvince.get(id) as TideArmy[])[0] as TideArmy;
    regions[id] = createRegion(first.xKm, first.yKm, day.baseDensity(id), b);
  }
  const out: Record<string, TideRegion> = {};
  const dtH = 24 / r.hours.length;
  for (const id of Object.keys(regions).sort()) {
    const reg = regions[id] as TideRegion;
    const here = byProvince.get(id) ?? [];
    const idle = here.length > 0 ? 0 : reg.idle + 1;
    if (idle >= r.idle_days) continue;
    const piles = here.map((a) => pileOf(a, b));
    let grid = reg.grid;
    if (day.clashes.has(id)) for (const p of piles) grid = addSpike(grid, r.spike_on_encounter, p.x, p.y, 1, b);
    if (here.length > 0 || grid.density.some((v) => v > 0)) for (const hour of r.hours) grid = stepGrid(grid, { piles, posts: [], hour, season: day.season, dtH }, b).grid;
    out[id] = { idle, grid };
  }
  return { regions: out };
}

/**
 * Facteur d'attraction (≥ 0) ressenti par une armée : densité locale de la région rapportée à l'équilibre de sa création (`base × per_density`).
 * 1 = équilibre ; > 1 : les Titans se sont rassemblés autour des humains ; < 1 : ils ont été saignés. `null` sans région ou hors fenêtre.
 */
export function tideFactor(s: TideState, province: string, xKm: number, yKm: number, base: number, b: TideBalance): number | null {
  const reg = s.regions[province];
  if (!reg || !(base > 0)) return null;
  const x = xKm * KM;
  const y = yKm * KM;
  if (cellOf(reg.grid, x, y) < 0) return null;
  return localDensity(reg.grid, x, y, b) / (base * b.region.per_density);
}

/**
 * Densité de Titans effective (0–1) que ressent une armée : la densité statique multipliée par le facteur d'attraction (plafonné à
 * `amplify_max`, jamais au-dessus de 1). Une province sans Titans n'en reçoit pas. `null` sans région : la densité statique s'applique.
 */
export function tideDensity(s: TideState, province: string, xKm: number, yKm: number, base: number, b: TideBalance): number | null {
  const f = tideFactor(s, province, xKm, yKm, base, b);
  return f === null ? null : Math.max(0, Math.min(1, base * Math.min(b.region.amplify_max, f)));
}
