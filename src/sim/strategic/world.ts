import type { EconomyBalance, TimeBalance } from "../../data/balance";
import type { Building, Province, Scenario } from "../../data/schemas";

/** Monde statique (données validées) : ne fait pas partie de la sauvegarde, il est rechargé depuis /data. */
export interface World {
  provinces: readonly Province[];
  provinceById: ReadonlyMap<string, Province>;
  buildings: ReadonlyMap<string, Building>;
  economy: EconomyBalance;
  time: TimeBalance;
  scenario: Scenario;
}

export interface WorldSource {
  provinces: readonly Province[];
  buildings: readonly Building[];
  scenarios: readonly Scenario[];
  economy: EconomyBalance;
  time: TimeBalance;
}

export function buildWorld(src: WorldSource, scenarioId: string): World {
  const scenario = src.scenarios.find((s) => s.id === scenarioId);
  if (!scenario) throw new Error(`Scénario inconnu : ${scenarioId}`);
  return {
    provinces: src.provinces,
    provinceById: new Map(src.provinces.map((p) => [p.id, p])),
    buildings: new Map(src.buildings.map((b) => [b.id, b])),
    economy: src.economy,
    time: src.time,
    scenario,
  };
}
