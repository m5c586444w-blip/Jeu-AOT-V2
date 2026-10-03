import type { EconomyBalance, PoliticsBalance, SocietyBalance, TimeBalance } from "../../data/balance";
import type { Building, Character, Law, Organisation, Province, Role, Scenario, Stratum, Trait } from "../../data/schemas";

/** Monde statique (données validées) : ne fait pas partie de la sauvegarde, il est rechargé depuis /data. */
export interface World {
  provinces: readonly Province[];
  provinceById: ReadonlyMap<string, Province>;
  buildings: ReadonlyMap<string, Building>;
  economy: EconomyBalance;
  time: TimeBalance;
  scenario: Scenario;
  /** Couche politique (P2) : absente pour un scénario sans `politics`. */
  politics: PoliticsWorld | null;
}

export interface PoliticsWorld {
  characters: ReadonlyMap<string, Character>;
  traits: ReadonlyMap<string, Trait>;
  strata: readonly Stratum[];
  organisations: ReadonlyMap<string, Organisation>;
  laws: ReadonlyMap<string, Law>;
  roles: readonly Role[];
  balance: PoliticsBalance;
  society: SocietyBalance;
}

export interface WorldSource {
  provinces: readonly Province[];
  buildings: readonly Building[];
  scenarios: readonly Scenario[];
  economy: EconomyBalance;
  time: TimeBalance;
  characters?: readonly Character[];
  traits?: readonly Trait[];
  strata?: readonly Stratum[];
  organisations?: readonly Organisation[];
  laws?: readonly Law[];
  roles?: readonly Role[];
  politics?: PoliticsBalance;
  society?: SocietyBalance;
}

export function buildWorld(src: WorldSource, scenarioId: string): World {
  const scenario = src.scenarios.find((s) => s.id === scenarioId);
  if (!scenario) throw new Error(`Scénario inconnu : ${scenarioId}`);
  let politics: PoliticsWorld | null = null;
  if (scenario.politics) {
    if (!src.politics || !src.society) throw new Error("Scénario politique sans data/balance/politics.json ou society.json");
    politics = {
      characters: new Map((src.characters ?? []).map((c) => [c.id, c])),
      traits: new Map((src.traits ?? []).map((t) => [t.id, t])),
      strata: src.strata ?? [],
      organisations: new Map((src.organisations ?? []).map((o) => [o.id, o])),
      laws: new Map((src.laws ?? []).map((l) => [l.id, l])),
      roles: [...(src.roles ?? [])].sort((a, b) => a.number - b.number),
      balance: src.politics,
      society: src.society,
    };
  }
  return {
    provinces: src.provinces,
    provinceById: new Map(src.provinces.map((p) => [p.id, p])),
    buildings: new Map(src.buildings.map((b) => [b.id, b])),
    economy: src.economy,
    time: src.time,
    scenario,
    politics,
  };
}
