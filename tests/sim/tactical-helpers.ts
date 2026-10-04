import { loadWorld } from "../../src/data/worldNode";
import { createBattle } from "../../src/sim/tactical/battle";
import type { Battle } from "../../src/sim/tactical/battle";
import { skirmishSetup } from "../../src/sim/tactical/setup";

export const world = loadWorld("data", "scn_sandbox_850");
const tw = world.tactical;
if (!tw) throw new Error("couche tactique absente");
export const tb = tw.balance;

export function battle(map = "tmap_plaine", titan = "ttype_moyen_errant", n = 12, seed = 1, night = false): Battle {
  return createBattle(world, skirmishSetup(world, map, [{ type: titan, count: 1 }], n, seed, night));
}
