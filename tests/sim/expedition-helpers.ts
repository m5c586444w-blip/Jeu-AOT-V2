import { loadWorld } from "../../src/data/worldNode";
import { applyCommand } from "../../src/sim/core/commands";
import type { Command } from "../../src/sim/core/commands";
import { createInitialState } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { standardPlan } from "../../src/sim/military/plan";
import type { ExpeditionPlan, MilitaryState } from "../../src/sim/military/state";

export const world = loadWorld("data", "scn_sandbox_850");

export const cmd = (s: GameState, c: Command): GameState => applyCommand(s, c, undefined, world);

/** État 850 après 120 jours (capital politique constitué), à une graine donnée. */
export function ready(seed = 42, days = 120): GameState {
  return cmd(createInitialState(seed, world), { type: "AdvanceDays", n: days });
}

export function mil(s: GameState): MilitaryState {
  if (!s.military) throw new Error("pas de couche militaire");
  return s.military;
}

export function plan(s: GameState, target = "prov_maria_est", formation: ExpeditionPlan["formation"] = "eventail", squads = 20, officers: string[] = []): ExpeditionPlan {
  const p = standardPlan(world, mil(s), target, formation, squads, officers);
  if (!p) throw new Error("aucun plan");
  return p;
}

/** Avance jour par jour jusqu'au retour de toutes les expéditions (au plus `max` jours). */
export function untilBack(s: GameState, max = 60): GameState {
  let x = s;
  for (let d = 0; d < max && mil(x).expeditions.length > 0; d++) x = cmd(x, { type: "AdvanceDays", n: 1 });
  return x;
}

export function strat(s: GameState): NonNullable<GameState["strategic"]> {
  if (!s.strategic) throw new Error("pas de couche stratégique");
  return s.strategic;
}

export function pol(s: GameState): NonNullable<GameState["politics"]> {
  if (!s.politics) throw new Error("pas de couche politique");
  return s.politics;
}
