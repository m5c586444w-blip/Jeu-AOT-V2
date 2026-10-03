import { Rng } from "./rng";
import { advance, DAYS_PER_MONTH, START_DATE } from "./time";
import type { GameDate } from "./time";
import { applyDay, applyMonth, createStrategicState, planDay, planMonth } from "../strategic/economy";
import type { StrategicState } from "../strategic/economy";
import type { World } from "../strategic/world";

export const CURRENT_SCHEMA_VERSION = 2 as const;

/** État complet et sérialisable de la partie (P0 + couche stratégique de P1). */
export interface GameState {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  seed: number;
  rng: { state: number };
  date: GameDate;
  world: { noise: number; flags: Record<string, boolean> };
  commandIndex: number;
  /** null quand la partie tourne sans monde chargé (tests de fondation P0). */
  strategic: StrategicState | null;
}

export function createInitialState(seed: number, world?: World): GameState {
  const s = seed >>> 0;
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    seed: s,
    rng: { state: s | 0 },
    date: world ? { ...world.scenario.start } : { ...START_DATE },
    world: { noise: 0, flags: {} },
    commandIndex: 0,
    strategic: world ? createStrategicState(world) : null,
  };
}

/**
 * Avance d'un jour. Un tirage du RNG par jour alimente `world.noise` (système témoin de P0) ;
 * si un monde est chargé, l'économie du jour est appliquée, puis les flux mensuels au 1er du mois.
 */
export function tickDay(state: GameState, world?: World): GameState {
  const rng = Rng.fromState({ seed: state.seed, state: state.rng.state });
  const noise = rng.next();
  let strategic = state.strategic;
  const date = advance(state.date, 1);
  if (world && strategic) {
    strategic = applyDay(world, strategic, planDay(world, strategic, state.date));
    if (date.day % DAYS_PER_MONTH === 1) strategic = applyMonth(world, strategic, planMonth(world, strategic), date);
  }
  return { ...state, rng: { state: rng.serialize().state }, date, world: { ...state.world, noise }, strategic };
}
