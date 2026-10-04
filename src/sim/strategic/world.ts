import type { EconomyBalance, ExpeditionsBalance, LogisticsBalance, PoliticsBalance, SocietyBalance, TimeBalance } from "../../data/balance";
import type { GeoData, GeoZone } from "../../data/geo";
import type { Building, Character, Law, NameList, Organisation, Province, Role, Scenario, Stratum, TitanClass, Trait, Unit } from "../../data/schemas";

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
  /** Expéditions et logistique (P3) : absentes sans graphe, équilibrage ou listes de noms. */
  military: MilitaryWorld | null;
}

/** Graphe de routage (dérivé de la carte) : ancres en km, zones, voisins avec distances, portes. */
export interface GeoGraph {
  nodes: ReadonlyMap<string, { x: number; y: number; zone: GeoZone }>;
  adj: ReadonlyMap<string, readonly { to: string; km: number }[]>;
  gates: ReadonlySet<string>;
}

export interface MilitaryWorld {
  geo: GeoGraph;
  units: ReadonlyMap<string, Unit>;
  titans: readonly TitanClass[];
  names: NameList;
  exp: ExpeditionsBalance;
  log: LogisticsBalance;
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
  geo?: GeoData;
  units?: readonly Unit[];
  titans?: readonly TitanClass[];
  names?: readonly NameList[];
  expeditions?: ExpeditionsBalance;
  logistics?: LogisticsBalance;
}

export function buildGeo(g: GeoData): GeoGraph {
  const adj = new Map<string, { to: string; km: number }[]>();
  for (const [a, b, km] of g.edges) {
    adj.set(a, [...(adj.get(a) ?? []), { to: b, km }]);
    adj.set(b, [...(adj.get(b) ?? []), { to: a, km }]);
  }
  return { nodes: new Map(Object.entries(g.provinces)), adj, gates: new Set(g.gates) };
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
    military:
      src.geo && src.expeditions && src.logistics && src.names?.[0] && src.titans?.length
        ? { geo: buildGeo(src.geo), units: new Map((src.units ?? []).map((u) => [u.id, u])), titans: src.titans, names: src.names[0], exp: src.expeditions, log: src.logistics }
        : null,
  };
}
