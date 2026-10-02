import { Rng } from "./rng";
import { advance, START_DATE } from "./time";
import type { GameDate } from "./time";

export const CURRENT_SCHEMA_VERSION = 1 as const;

/** État minimal de P0 (fichier 14 §2). Toute la partie doit tenir dans cette structure sérialisable. */
export interface GameState {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  seed: number;
  rng: { state: number };
  date: GameDate;
  world: { noise: number; flags: Record<string, boolean> };
  commandIndex: number;
}

export function createInitialState(seed: number): GameState {
  const s = seed >>> 0;
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    seed: s,
    rng: { state: s | 0 },
    date: { ...START_DATE },
    world: { noise: 0, flags: {} },
    commandIndex: 0,
  };
}

/**
 * Avance d'un jour. Système de test de P0 : un tirage du RNG par jour alimente `world.noise`,
 * pour que le hash dépende de la graine et du nombre de ticks.
 */
export function tickDay(state: GameState): GameState {
  const rng = Rng.fromState({ seed: state.seed, state: state.rng.state });
  const noise = rng.next();
  return {
    ...state,
    rng: { state: rng.serialize().state },
    date: advance(state.date, 1),
    world: { ...state.world, noise },
  };
}
