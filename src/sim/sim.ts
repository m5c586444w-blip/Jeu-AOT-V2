import { stateHash } from "./core/canonical";
import { applyCommand, CommandJournal } from "./core/commands";
import type { Command } from "./core/commands";
import { createInitialState } from "./core/state";
import type { GameState } from "./core/state";
import { buildWorld } from "./strategic/world";
import type { World, WorldSource } from "./strategic/world";
import type { DifficultySetting } from "../data/endingSchemas";

/** Simulation autonome : seul point d'entrée pour faire évoluer l'état (direct ou dans un Worker). */
export interface Sim {
  state(): GameState;
  dispatch(cmd: Command): GameState;
  reset(seed: number): GameState;
  load(state: GameState): GameState;
  hash(): string;
  journal(): readonly Command[];
}

export function createSim(seed: number, world?: World): Sim {
  let state = createInitialState(seed, world);
  let journal = new CommandJournal();
  return {
    state: () => state,
    dispatch(cmd) {
      state = applyCommand(state, cmd, undefined, world);
      journal.record(cmd);
      return state;
    },
    reset(newSeed) {
      state = createInitialState(newSeed, world);
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
  | { id: number; op: "init"; seed: number; scenario: string | null; difficulty?: DifficultySetting }
  | { id: number; op: "dispatch"; cmd: Command }
  | { id: number; op: "reset"; seed: number }
  | { id: number; op: "load"; state: GameState }
  | { id: number; op: "state" };

export type SimResponse =
  | { id: number; ok: true; state: GameState; hash: string; source?: WorldSource }
  | { id: number; ok: false; error: string };

/**
 * Point d'accès d'une simulation distante. `loadSource` fournit le monde validé (lu une seule fois, à l'init) ;
 * avec `scenario: null`, la simulation tourne sans monde (tests de fondation).
 */
export function createSimEndpoint(loadSource: () => WorldSource): (req: SimRequest) => SimResponse {
  let sim = createSim(42);
  return (req) => {
    try {
      let source: WorldSource | undefined;
      switch (req.op) {
        case "init": {
          if (req.scenario === null) sim = createSim(req.seed);
          else {
            source = loadSource();
            sim = createSim(req.seed, buildWorld(source, req.scenario, req.difficulty ? { difficulty: req.difficulty } : {}));
          }
          break;
        }
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
      return { id: req.id, ok: true, state: sim.state(), hash: sim.hash(), ...(source ? { source } : {}) };
    } catch (e) {
      return { id: req.id, ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };
}
