import type { EconomyBalance, EventsBalance, ExpeditionsBalance, IntelBalance, LogisticsBalance, ShiftersBalance, WorldBalance, PoliticsBalance, ResearchBalance, SocietyBalance, TacticalBalance, TimeBalance } from "../../data/balance";
import type { GeoData, GeoZone } from "../../data/geo";
import type { Mission, MissionsBalance } from "../../data/missionSchemas";
import type { ArmiesBalance, ArmiesEntry, ArmyStart, ArtilleryEntry, FleetStart, Munition, Piece, Regiment, Sea, Ship } from "../../data/armySchemas";
import type { Building, Character, EventDef, Law, NameList, Organisation, Province, Role, Faction, Formation, Scenario, Shifter, Stratum, TacticalMap, WorldProvince, Tech, TitanClass, TitanType, Trait, Unit } from "../../data/schemas";
import type { DifficultyBalance, DifficultyId, EndingRules, EndingsBalance } from "../../data/endingSchemas";
import { applyDifficulty } from "./difficulty";

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
  /** Combat tactique (P4) : absent sans équilibrage tactique, types de Titans ou cartes. */
  tactical: TacticalWorld | null;
  /** Événements canon et génériques (P5) : absents sans équilibrage ou hors scénario politique. */
  chronicle: ChronicleWorld | null;
  /** Recherche (P5). */
  research: ResearchWorld | null;
  /** Renseignement (P5). */
  intel: IntelWorld | null;
  /** Titans-porteurs (P6) : absents sans données des Neuf ou hors scénario politique. */
  shifters: ShifterWorld | null;
  /** Monde des nations (P7) : absent hors d'un scénario à couche `world`. */
  nations: NationsWorld | null;
  /** Armées, artillerie et marine (PA) : absentes sans données ou sans armée de départ pour le scénario. */
  armies?: ArmiesWorld | null;
  /** Missions nationales (MIS) : absentes sans équilibrage ou sans mission pour le scénario. */
  missions?: MissionsWorld | null;
  /** P9 : objectifs et défaites du scénario, par camp joué (absents : pas de fin de partie). */
  endings?: readonly EndingRules[];
  /** P9 : difficulté appliquée (absente : « normal », monde des données). */
  difficulty?: DifficultyId;
}

export interface MissionsWorld {
  balance: MissionsBalance;
  /** Missions offertes dans le scénario, dans l'ordre des données. */
  order: readonly Mission[];
  byId: ReadonlyMap<string, Mission>;
}

export interface ArmiesWorld {
  balance: ArmiesBalance;
  pieces: ReadonlyMap<string, Piece>;
  munitions: ReadonlyMap<string, Munition>;
  regiments: ReadonlyMap<string, Regiment>;
  ships: ReadonlyMap<string, Ship>;
  seas: ReadonlyMap<string, Sea>;
  /** Armées et flottes de départ du scénario, dans l'ordre des données. */
  starts: readonly ArmyStart[];
  fleets: readonly FleetStart[];
}

export interface NationsWorld {
  balance: WorldBalance;
  provinces: ReadonlyMap<string, WorldProvince>;
  order: readonly WorldProvince[];
  factions: ReadonlyMap<string, Faction>;
  formations: ReadonlyMap<string, Formation>;
}

export interface ShifterWorld {
  balance: ShiftersBalance;
  defs: ReadonlyMap<string, Shifter>;
  /** Ordre d'affichage et d'itération (ordre des données). */
  order: readonly Shifter[];
}

export interface ChronicleWorld {
  balance: EventsBalance;
  /** Mode du scénario : « aucun » = seuls les génériques tournent. */
  mode: "canon_fidele" | "aucun";
  events: ReadonlyMap<string, EventDef>;
  /** Événements canon jouables, dans l'ordre de leur code (E09, E10…). */
  canon: readonly EventDef[];
  generic: readonly EventDef[];
  /** Événements de fond (CHR.2) : sans décision, tirés chaque mois. */
  fond: readonly EventDef[];
  /** Successeurs directs dans le graphe (12 §3). */
  successors: ReadonlyMap<string, readonly string[]>;
}

export interface ResearchWorld {
  balance: ResearchBalance;
  techs: ReadonlyMap<string, Tech>;
  /** Ordre d'affichage : arbre puis code. */
  order: readonly Tech[];
}

export interface SecretDef {
  id: string;
  character: string;
  /** Ce que cache le secret (clés des champs `hidden` du personnage). */
  fields: readonly string[];
}

export interface IntelWorld {
  balance: IntelBalance;
  /** Secrets tirés des champs `hidden` des personnages (identités, porteurs, allégeances). */
  secrets: readonly SecretDef[];
}

export interface TacticalWorld {
  balance: TacticalBalance;
  titanTypes: ReadonlyMap<string, TitanType>;
  titanClasses: ReadonlyMap<string, TitanClass>;
  maps: ReadonlyMap<string, TacticalMap>;
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
  /** P9 : fins de partie et difficultés (`data/balance/endings.json`, `difficulty.json`). */
  endings?: EndingsBalance;
  difficulty?: DifficultyBalance;
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
  tactical?: TacticalBalance;
  titanTypes?: readonly TitanType[];
  tacticalMaps?: readonly TacticalMap[];
  events?: readonly EventDef[];
  techs?: readonly Tech[];
  eventsBalance?: EventsBalance;
  research?: ResearchBalance;
  intel?: IntelBalance;
  shifters?: readonly Shifter[];
  shiftersBalance?: ShiftersBalance;
  worldProvinces?: readonly WorldProvince[];
  factions?: readonly Faction[];
  formations?: readonly Formation[];
  worldBalance?: WorldBalance;
  artillery?: readonly ArtilleryEntry[];
  armies?: readonly ArmiesEntry[];
  armiesBalance?: ArmiesBalance;
  missions?: readonly Mission[];
  missionsBalance?: MissionsBalance;
}

/** Couche MIS : construite si l'équilibrage existe et si au moins une mission est offerte dans le scénario. */
export function buildMissionsWorld(src: WorldSource, scenarioId: string): MissionsWorld | null {
  if (!src.missionsBalance || !src.missions) return null;
  const order = src.missions.filter((m) => m.scenarios.includes(scenarioId));
  if (order.length === 0) return null;
  return { balance: src.missionsBalance, order, byId: new Map(order.map((m) => [m.id, m])) };
}

/** Couche PA : construite si l'équilibrage, la couche militaire (graphe) et au moins une armée de départ existent. */
export function buildArmiesWorld(src: WorldSource, scenarioId: string, hasGeo: boolean): ArmiesWorld | null {
  if (!src.armiesBalance || !hasGeo || !src.armies) return null;
  const starts = src.armies.filter((a): a is ArmyStart => a.type === "army" && a.scenario === scenarioId);
  if (starts.length === 0) return null;
  const art = src.artillery ?? [];
  return {
    balance: src.armiesBalance,
    pieces: new Map(art.filter((a): a is Piece => a.type === "piece").map((a) => [a.id, a])),
    munitions: new Map(art.filter((a): a is Munition => a.type === "munition").map((a) => [a.id, a])),
    regiments: new Map(src.armies.filter((a): a is Regiment => a.type === "regiment").map((a) => [a.id, a])),
    ships: new Map(src.armies.filter((a): a is Ship => a.type === "ship").map((a) => [a.id, a])),
    seas: new Map(src.armies.filter((a): a is Sea => a.type === "sea").map((a) => [a.id, a])),
    starts,
    fleets: src.armies.filter((a): a is FleetStart => a.type === "fleet" && a.scenario === scenarioId),
  };
}

export function buildGeo(g: GeoData): GeoGraph {
  const adj = new Map<string, { to: string; km: number }[]>();
  for (const [a, b, km] of g.edges) {
    adj.set(a, [...(adj.get(a) ?? []), { to: b, km }]);
    adj.set(b, [...(adj.get(b) ?? []), { to: a, km }]);
  }
  return { nodes: new Map(Object.entries(g.provinces)), adj, gates: new Set(g.gates) };
}

export function buildWorld(source: WorldSource, scenarioId: string, opts: { difficulty?: DifficultyId } = {}): World {
  // P9.3 : la difficulté transforme une copie de la source ; « normal » la laisse telle quelle.
  const level: DifficultyId = opts.difficulty ?? "normal";
  const src = applyDifficulty(source, scenarioId, level);
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
  const military: MilitaryWorld | null =
    src.geo && src.expeditions && src.logistics && src.names?.[0] && src.titans?.length
      ? { geo: buildGeo(src.geo), units: new Map((src.units ?? []).map((u) => [u.id, u])), titans: src.titans, names: src.names[0], exp: src.expeditions, log: src.logistics }
      : null;
  const armies = buildArmiesWorld(src, scenarioId, military !== null);
  const missions = buildMissionsWorld(src, scenarioId);
  const endings = (src.endings?.fins ?? []).filter((r) => r.scenario === scenarioId);
  return {
    ...(armies ? { armies } : {}),
    ...(missions ? { missions } : {}),
    ...(endings.length > 0 ? { endings } : {}),
    ...(level !== "normal" ? { difficulty: level } : {}),
    provinces: src.provinces,
    provinceById: new Map(src.provinces.map((p) => [p.id, p])),
    buildings: new Map(src.buildings.map((b) => [b.id, b])),
    economy: src.economy,
    time: src.time,
    scenario,
    politics,
    military,
    tactical:
      src.tactical && src.titanTypes?.length && src.tacticalMaps?.length
        ? { balance: src.tactical, titanTypes: new Map(src.titanTypes.map((t) => [t.id, t])), titanClasses: new Map((src.titans ?? []).map((t) => [t.id, t])), maps: new Map(src.tacticalMaps.map((m) => [m.id, m])) }
        : null,
    chronicle: politics && src.eventsBalance ? buildChronicle(src.events ?? [], src.eventsBalance, scenario.events_mode) : null,
    research: politics && src.research && src.techs?.length ? { balance: src.research, techs: new Map(src.techs.map((t) => [t.id, t])), order: [...src.techs].sort((a, b) => a.tree.localeCompare(b.tree) || (a.code ?? a.id).localeCompare(b.code ?? b.id)) } : null,
    intel: politics && src.intel ? { balance: src.intel, secrets: secretsOf(src.characters ?? []) } : null,
    shifters: politics && src.shiftersBalance && src.shifters?.length ? { balance: src.shiftersBalance, defs: new Map(src.shifters.map((d) => [d.id, d])), order: src.shifters } : null,
    nations:
      scenario.world && src.worldBalance && src.worldProvinces?.length && src.factions?.length
        ? { balance: src.worldBalance, provinces: new Map(src.worldProvinces.map((p) => [p.id, p])), order: src.worldProvinces, factions: new Map(src.factions.map((f) => [f.id, f])), formations: new Map((src.formations ?? []).map((f) => [f.id, f])) }
        : null,
  };
}

const preds = (e: EventDef): string[] => (e.window.after === null ? [] : Array.isArray(e.window.after) ? e.window.after : [e.window.after]);

export function buildChronicle(events: readonly EventDef[], balance: EventsBalance, mode: "canon_fidele" | "aucun"): ChronicleWorld {
  const playable = events.filter((e) => e.playable);
  const canon = playable.filter((e) => e.kind === "canon").sort((a, b) => (a.code ?? a.id).localeCompare(b.code ?? b.id));
  const successors = new Map<string, string[]>();
  for (const e of canon) for (const p of preds(e)) successors.set(p, [...(successors.get(p) ?? []), e.id]);
  return { balance, mode, events: new Map(events.map((e) => [e.id, e])), canon, generic: playable.filter((e) => e.kind === "generic"), fond: playable.filter((e) => e.kind === "fond"), successors };
}

/** Un secret par personnage portant des champs `hidden` (D-36 : chargés en P2, jamais affichés avant révélation). */
export function secretsOf(characters: readonly Character[]): SecretDef[] {
  return characters.filter((c) => c.hidden && Object.keys(c.hidden).length > 0).map((c) => ({ id: `secret_${c.id.replace(/^char_/, "")}`, character: c.id, fields: Object.keys(c.hidden ?? {}).sort() }));
}

export function predecessorsOf(e: EventDef): string[] {
  return preds(e);
}
