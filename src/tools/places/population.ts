import { loadWorld } from "../../data/worldNode";
import { createInitialState } from "../../sim/core/state";
import type { Place } from "../../data/placeSchema";

/**
 * Population des lieux (R1e, docs/phases/R1e.md §2) : celle de la simulation au départ de `scn_sandbox_845`
 * (`state.strategic.provinces[<province>].population`), lue sans rien modifier de la simulation.
 */
export const POP_SCENARIO = "scn_sandbox_845";
export const POP_SEED = 845;

let cache: Record<string, number> | null = null;
export function simPopulations(dir = "data"): Record<string, number> {
  if (cache && dir === "data") return cache;
  const world = loadWorld(dir, POP_SCENARIO);
  const st = createInitialState(POP_SEED, world);
  const provs = (st.strategic?.provinces ?? {}) as Record<string, { population: number }>;
  const out: Record<string, number> = {};
  for (const [id, p] of Object.entries(provs)) out[id] = p.population;
  if (dir === "data") cache = out;
  return out;
}

type Pop = Place["population"];
export function popOf(p: Pop, provs: Record<string, number>): number {
  if (p.province === null) return p.valeur ?? 0;
  return Math.round((provs[p.province] ?? 0) * p.part);
}

/** Population de chaque zone d'un lieu (`principal`, puis les zones annexes). */
export function placePopulations(place: Place, provs: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { principal: popOf(place.population, provs) };
  for (const z of place.zones) out[z.id] = popOf(z.population, provs);
  return out;
}
