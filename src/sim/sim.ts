import { stateHash } from "./core/canonical";
import { applyCommand, CommandJournal } from "./core/commands";
import type { Command } from "./core/commands";
import { createInitialState } from "./core/state";
import type { GameState } from "./core/state";

/** Simulation autonome : seul point d'entrée pour faire évoluer l'état (direct ou dans un Worker). */
export interface Sim {
  state(): GameState;
  dispatch(cmd: Command): GameState;
  reset(seed: number): GameState;
  load(state: GameState): GameState;
  hash(): string;
  journal(): readonly Command[];
}

export function createSim(seed: number): Sim {
  let state = createInitialState(seed);
  let journal = new CommandJournal();
  return {
    state: () => state,
    dispatch(cmd) {
      state = applyCommand(state, cmd);
      journal.record(cmd);
      return state;
    },
    reset(newSeed) {
      state = createInitialState(newSeed);
      journal = new CommandJournal();
      return state;
    },
    load(loaded) {
      state = loaded;
      journal = new CommandJournal();
      return state;
    },
    hash: () => stateHash(state),
    journal: () => journal.list(),
  };
}

/** Protocole de messages entre l'UI et une simulation distante (Worker navigateur ou worker_threads). */
export type SimRequest =
  | { id: number; op: "dispatch"; cmd: Command }
  | { id: number; op: "reset"; seed: number }
  | { id: number; op: "load"; state: GameState }
  | { id: number; op: "state" };

export type SimResponse =
  | { id: number; ok: true; state: GameState; hash: string }
  | { id: number; ok: false; error: string };

/** Traite une requête ; ne lève jamais : les erreurs reviennent dans la réponse. */
export function handleSimRequest(sim: Sim, req: SimRequest): SimResponse {
  try {
    switch (req.op) {
      case "dispatch":
        sim.dispatch(req.cmd);
        break;
      case "reset":
        sim.reset(req.seed);
        break;
      case "load":
        sim.load(req.state);
        break;
      case "state":
        break;
    }
    return { id: req.id, ok: true, state: sim.state(), hash: sim.hash() };
  } catch (e) {
    return { id: req.id, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
