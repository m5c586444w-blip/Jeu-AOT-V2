import type { ProvinceState } from "../strategic/economy";
import type { Ring, WallState } from "./types";

/**
 * Pont avec l'économie : construit un état « Mur » à partir des provinces (population réelle) et d'une table de capacités
 * alimentaires [A] fournie par l'appelant. Pur : ne modifie pas `provinces`. Les anneaux et le voisinage viennent des données de carte.
 */
export function wallFromProvinces(
  provinces: Record<string, ProvinceState>,
  layout: Record<string, { ring: Ring; capacity: number; neighbors: string[] }>,
): WallState {
  const districts: WallState["districts"] = {};
  let start = 0;
  for (const id of Object.keys(layout).sort()) {
    const l = layout[id];
    const p = provinces[id];
    if (!l || !p) continue;
    start += p.population;
    districts[id] = {
      id,
      ring: l.ring,
      population: p.population,
      foodCapacity: l.capacity,
      rations: 1,
      order: p.stability,
      status: "intact",
      cleanup: 1,
      neighbors: [...l.neighbors].sort(),
      ...(p.owner ? { owner: p.owner } : {}),
    };
  }
  return {
    districts,
    gates: { maria: true, rose: true, sina: true },
    evacuations: [],
    ledger: { start, births: 0, deaths: 0, exported: 0 },
    monthsOver: { maria: 0, rose: 0, sina: 0 },
    projects: [],
    effects: { legitimacy: 0 },
    nextId: 1,
  };
}
