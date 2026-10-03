import { loadWorld } from "../../src/data/worldNode";
import { applyCommand } from "../../src/sim/core/commands";
import type { Command } from "../../src/sim/core/commands";
import { createInitialState } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import type { PoliticalState } from "../../src/sim/politics/state";
import type { StrategicState } from "../../src/sim/strategic/economy";

export const world850 = loadWorld("data", "scn_sandbox_850");

export function start(): GameState {
  return createInitialState(42, world850);
}

export function run(s: GameState, ...cmds: Command[]): GameState {
  return cmds.reduce((acc, c) => applyCommand(acc, c, undefined, world850), s);
}

export function pol(s: GameState): PoliticalState {
  if (!s.politics) throw new Error("pas d'état politique");
  return s.politics;
}

export function strat(s: GameState): StrategicState {
  if (!s.strategic) throw new Error("pas d'état stratégique");
  return s.strategic;
}
