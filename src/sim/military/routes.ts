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
 * Franchissement des murs (D-52) : une suite de segments de mur reliant deux provinces de zones différentes
 * doit contenir une porte ; longer le mur sans changer de zone reste possible. Renvoie la clé du problème ou null.
 */
export function crossingProblem(g: GeoGraph, route: readonly string[]): { key: string; params: Record<string, string | number> } | null {
  let entry: string | null = null;
  let gate = false;
  let first = "";
  for (let i = 0; i < route.length; i++) {
    const id = route[i] as string;
    if (isWall(g, id)) {
      if (entry === null) {
        entry = i > 0 ? zoneOf(g, route[i - 1] as string) : "";
        gate = false;
        first = id;
      }
      gate = gate || g.gates.has(id);
    } else {
      if (entry !== null && entry !== "" && entry !== zoneOf(g, id) && !gate) return { key: "route.no_gate", params: { segment: first } };
      entry = null;
    }
  }
  return null;
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
  return crossingProblem(g, route);
}

/**
 * Plus court chemin (Dijkstra) respectant la règle des portes ; null si aucun. Chemin de `from` à `to` inclus.
 * État de recherche : province, zone d'entrée dans le mur (si on le longe), porte déjà rencontrée sur ce tronçon.
 */
export function shortestRoute(g: GeoGraph, from: string, to: string): string[] | null {
  if (!g.nodes.has(from) || !g.nodes.has(to)) return null;
  interface Node {
    k: string;
    cur: string;
    entry: string;
    gate: boolean;
    d: number;
  }
  const key = (cur: string, entry: string, gate: boolean): string => `${cur}|${entry}|${gate ? 1 : 0}`;
  const startEntry = isWall(g, from) ? "" : "-";
  const start: Node = { k: key(from, startEntry, g.gates.has(from)), cur: from, entry: startEntry, gate: g.gates.has(from), d: 0 };
  const dist = new Map<string, number>([[start.k, 0]]);
  const back = new Map<string, string>();
  const open: Node[] = [start];
  while (open.length > 0) {
    open.sort((x, y) => x.d - y.d || (x.k < y.k ? -1 : 1));
    const n = open.shift() as Node;
    if (n.d > (dist.get(n.k) ?? Infinity)) continue;
    if (n.cur === to) {
      const path: string[] = [];
      let k: string | undefined = n.k;
      while (k !== undefined) {
        path.unshift(k.split("|")[0] as string);
        k = back.get(k);
      }
      return path;
    }
    for (const e of g.adj.get(n.cur) ?? []) {
      const nextWall = isWall(g, e.to);
      let entry = "-";
      let gate = false;
      if (nextWall) {
        // On monte sur (ou on longe) le mur : on retient la zone d'où l'on vient et si une porte a été rencontrée.
        entry = isWall(g, n.cur) ? n.entry : zoneOf(g, n.cur);
        gate = (isWall(g, n.cur) && n.gate) || g.gates.has(e.to);
      } else if (isWall(g, n.cur) && n.entry !== "" && n.entry !== zoneOf(g, e.to) && !n.gate) continue;
      const k = key(e.to, entry, gate);
      const d = n.d + e.km;
      if (d < (dist.get(k) ?? Infinity)) {
        dist.set(k, d);
        back.set(k, n.k);
        open.push({ k, cur: e.to, entry, gate, d });
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

/** Densité de Titans d'une province : celle du scénario (D-51), plus les effets des événements (P5) si l'état est fourni. */
export function titanDensity(world: World, province: string, st?: StrategicState): number {
  const base = world.scenario.titan_density[province] ?? world.provinceById.get(province)?.titan_density ?? 0;
  return Math.max(0, Math.min(1, base + (st?.titanMods?.[province] ?? 0)));
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
