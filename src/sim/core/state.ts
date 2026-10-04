import { Rng } from "./rng";
import { advance, DAYS_PER_MONTH, START_DATE } from "./time";
import type { GameDate } from "./time";
import { applyDay, applyMonth, createStrategicState, NO_MODS, planDay, planMonth } from "../strategic/economy";
import type { StrategicState } from "../strategic/economy";
import { economyMods } from "../politics/politics";
import { createPoliticalState } from "../politics/state";
import type { PoliticalState } from "../politics/state";
import { dailyPolitics, monthlyPolitics } from "../politics/tick";
import type { World } from "../strategic/world";
import { createMilitaryState } from "../military/state";
import type { MilitaryState } from "../military/state";

export const CURRENT_SCHEMA_VERSION = 4 as const;

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
  /** Couche politique (P2) ; null pour un scénario sans politique. */
  politics: PoliticalState | null;
  /** Expéditions et logistique (P3) ; null sans couche militaire, ou juste après migration d'une sauvegarde v3. */
  military: MilitaryState | null;
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
    politics: world ? createPoliticalState(world) : null,
    military: world?.military ? createMilitaryState(world, s) : null,
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
  let politics = state.politics;
  // Sauvegarde v3 migrée : le Corps est généré ici, de façon déterministe (même graine → mêmes soldats).
  const military = state.military ?? (world?.military ? createMilitaryState(world, state.seed) : null);
  const date = advance(state.date, 1);
  if (world && strategic) {
    const mods = politics && world.politics ? economyMods(world, politics, strategic) : NO_MODS;
    strategic = applyDay(world, strategic, planDay(world, strategic, state.date, mods));
    if (politics && world.politics) {
      politics = structuredClone(politics);
      dailyPolitics(world, politics, strategic, state.date);
    }
    if (date.day % DAYS_PER_MONTH === 1) {
      strategic = applyMonth(world, strategic, planMonth(world, strategic, mods), date);
      if (politics && world.politics) monthlyPolitics(world, politics, strategic, date);
    }
  }
  return { ...state, rng: { state: rng.serialize().state }, date, world: { ...state.world, noise }, strategic, politics, military };
}
