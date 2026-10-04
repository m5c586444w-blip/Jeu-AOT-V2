import type { StrategicState } from "../strategic/economy";
import type { GeoGraph, World } from "../strategic/world";
import type { Depot, MilitaryState } from "./state";
import { militaryWorld } from "./state";

/** Itinéraires et rayons de ravitaillement (F-LOG-01, F-LOG-02, D-52). Fonctions pures. */

const isWall = (g: GeoGraph, id: string): boolean => (g.nodes.get(id)?.zone ?? "").startsWith("mur_");

/** Zone « habitable » d'une province (le segment de mur n'en a pas). */
function zoneOf(g: GeoGraph, id: string): string {
  return g.nodes.get(id)?.zone ?? "?";
}

/**
 * Raison pour laquelle l'étape `a → seg → b` est interdite, ou null : passer d'une zone à une autre par un segment
 * de mur exige une porte (D-52) ; longer le mur reste possible.
 */
export function crossingProblem(g: GeoGraph, a: string, seg: string, b: string): string | null {
  if (!isWall(g, seg) || isWall(g, a) || isWall(g, b)) return null;
  if (zoneOf(g, a) === zoneOf(g, b)) return null;
  return g.gates.has(seg) ? null : `route.no_gate`;
}

export function edgeKm(g: GeoGraph, a: string, b: string): number | null {
  return g.adj.get(a)?.find((e) => e.to === b)?.km ?? null;
}

export function routeKm(g: GeoGraph, route: readonly string[]): number {
  let km = 0;
  for (let i = 1; i < route.length; i++) km += edgeKm(g, route[i - 1] as string, route[i] as string) ?? 0;
  return km;
}

/** Vérifie un itinéraire : provinces connues, voisines deux à deux, franchissements de murs par les portes. */
export function routeProblem(g: GeoGraph, route: readonly string[]): { key: string; params: Record<string, string | number> } | null {
  if (route.length < 2) return { key: "route.too_short", params: {} };
  for (const id of route) if (!g.nodes.has(id)) return { key: "route.unknown", params: { province: id } };
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1] as string;
    const b = route[i] as string;
    if (edgeKm(g, a, b) === null) return { key: "route.not_adjacent", params: { a, b } };
  }
  // Un segment entre deux provinces de zones différentes doit être une porte ; idem pour un segment en début ou fin de chemin.
  for (let i = 1; i < route.length - 1; i++) {
    const p = crossingProblem(g, route[i - 1] as string, route[i] as string, route[i + 1] as string);
    if (p) return { key: p, params: { segment: route[i] as string } };
  }
  return null;
}

/** Plus court chemin (Dijkstra) respectant la règle des portes ; null si aucun. Chemin de `from` à `to` inclus. */
export function shortestRoute(g: GeoGraph, from: string, to: string): string[] | null {
  if (!g.nodes.has(from) || !g.nodes.has(to)) return null;
  // État = (province, précédente) pour appliquer la règle des portes sur les triplets.
  const key = (cur: string, prev: string): string => `${cur}|${prev}`;
  const dist = new Map<string, number>([[key(from, ""), 0]]);
  const back = new Map<string, string>();
  const open: { k: string; cur: string; prev: string; d: number }[] = [{ k: key(from, ""), cur: from, prev: "", d: 0 }];
  while (open.length > 0) {
    open.sort((x, y) => x.d - y.d || (x.k < y.k ? -1 : 1));
    const n = open.shift() as { k: string; cur: string; prev: string; d: number };
    if (n.d > (dist.get(n.k) ?? Infinity)) continue;
    if (n.cur === to) {
      const path = [n.cur];
      let k = n.k;
      while (back.has(k)) {
        k = back.get(k) as string;
        path.unshift(k.split("|")[0] as string);
      }
      return path;
    }
    for (const e of g.adj.get(n.cur) ?? []) {
      if (e.to === n.prev) continue;
      if (n.prev && crossingProblem(g, n.prev, n.cur, e.to)) continue;
      const k = key(e.to, n.cur);
      const d = n.d + e.km;
      if (d < (dist.get(k) ?? Infinity)) {
        dist.set(k, d);
        back.set(k, n.k);
        open.push({ k, cur: e.to, prev: n.cur, d });
      }
    }
  }
  return null;
}

export interface SupplyInfo {
  inSupply: boolean;
  /** Distance à la source la plus proche (km) et nature de cette source. */
  km: number;
  source: string | null;
  kind: "mur" | "depot" | null;
  depot: Depot | null;
}

/**
 * Rayon de ravitaillement (F-LOG-01) : une province est ravitaillée si son ancre est à moins de `radius_km.source`
 * d'une province tenue (hors outre-murs), ou de `radius_km.depot` d'un dépôt non vide.
 */
export function supplyAt(world: World, st: StrategicState, mil: MilitaryState | null, province: string): SupplyInfo {
  const m = militaryWorld(world);
  const g = m.geo;
  const here = g.nodes.get(province);
  if (!here) return { inSupply: false, km: Infinity, source: null, kind: null, depot: null };
  let best: SupplyInfo = { inSupply: false, km: Infinity, source: null, kind: null, depot: null };
  for (const [id, n] of g.nodes) {
    if (n.zone === "outre") continue;
    if (st.provinces[id]?.control !== "paradis") continue;
    const km = Math.hypot(n.x - here.x, n.y - here.y);
    if (km < best.km) best = { inSupply: km <= m.log.radius_km.source, km, source: id, kind: "mur", depot: null };
  }
  for (const d of mil?.depots ?? []) {
    if (d.stocks.food <= 0 && d.stocks.gas <= 0) continue;
    const n = g.nodes.get(d.province);
    if (!n) continue;
    const km = Math.hypot(n.x - here.x, n.y - here.y);
    if (km <= m.log.radius_km.depot && (!best.inSupply || km < best.km)) best = { inSupply: true, km, source: d.province, kind: "depot", depot: d };
  }
  return best;
}

/** Densité de Titans d'une province dans le scénario (D-51). */
export function titanDensity(world: World, province: string): number {
  return world.scenario.titan_density[province] ?? world.provinceById.get(province)?.titan_density ?? 0;
}

/**
 * Planificateur de relais (F-LOG-15) : provinces de l'itinéraire hors rayon ; pour chaque tronçon hors rayon,
 * la dernière province ravitaillée avant lui est proposée comme emplacement de dépôt avancé.
 */
export function suggestRelays(world: World, st: StrategicState, mil: MilitaryState | null, route: readonly string[]): { outside: string[]; depots: string[] } {
  const outside = route.filter((p) => !supplyAt(world, st, mil, p).inSupply);
  const depots: string[] = [];
  for (let i = 1; i < route.length; i++) {
    const prev = route[i - 1] as string;
    const cur = route[i] as string;
    if (!outside.includes(prev) && outside.includes(cur)) {
      // Premier pas hors rayon : un dépôt sur `cur` prolonge le rayon d'un cran.
      if (!depots.includes(cur)) depots.push(cur);
    }
  }
  return { outside, depots };
}
