import { readFileSync } from "node:fs";
import { GasBalanceSchema } from "../../../src/data/balance";
import { createBattle } from "../../../src/sim/tactical/battle";
import { skirmishSetup } from "../../../src/sim/tactical/setup";
import { world } from "../tactical-helpers";

export const gb = GasBalanceSchema.parse(JSON.parse(readFileSync("data/balance/gas.json", "utf8")));
export const hook = (() => {
  const t = world.tactical;
  if (!t) throw new Error("couche tactique absente");
  return t.balance.odm.hook_range_m;
})();
export const mapOf = (id: string) => createBattle(world, skirmishSetup(world, id, [{ type: "ttype_moyen_errant", count: 1 }], 4, 1, false)).map;
