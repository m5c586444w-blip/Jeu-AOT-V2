import type { EconomyBalance, EventsBalance, ExpeditionsBalance, IntelBalance, LogisticsBalance, ShiftersBalance, PoliticsBalance, ResearchBalance, SocietyBalance, TacticalBalance, TimeBalance } from "../../data/balance";
import type { GeoData, GeoZone } from "../../data/geo";
import type { Building, Character, EventDef, Law, NameList, Organisation, Province, Role, Scenario, Shifter, Stratum, TacticalMap, Tech, TitanClass, TitanType, Trait, Unit } from "../../data/schemas";

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
    tactical:
      src.tactical && src.titanTypes?.length && src.tacticalMaps?.length
        ? { balance: src.tactical, titanTypes: new Map(src.titanTypes.map((t) => [t.id, t])), titanClasses: new Map((src.titans ?? []).map((t) => [t.id, t])), maps: new Map(src.tacticalMaps.map((m) => [m.id, m])) }
        : null,
    chronicle: politics && src.eventsBalance ? buildChronicle(src.events ?? [], src.eventsBalance, scenario.events_mode) : null,
    research: politics && src.research && src.techs?.length ? { balance: src.research, techs: new Map(src.techs.map((t) => [t.id, t])), order: [...src.techs].sort((a, b) => a.tree.localeCompare(b.tree) || (a.code ?? a.id).localeCompare(b.code ?? b.id)) } : null,
    intel: politics && src.intel ? { balance: src.intel, secrets: secretsOf(src.characters ?? []) } : null,
    shifters: politics && src.shiftersBalance && src.shifters?.length ? { balance: src.shiftersBalance, defs: new Map(src.shifters.map((d) => [d.id, d])), order: src.shifters } : null,
  };
}

const preds = (e: EventDef): string[] => (e.window.after === null ? [] : Array.isArray(e.window.after) ? e.window.after : [e.window.after]);

export function buildChronicle(events: readonly EventDef[], balance: EventsBalance, mode: "canon_fidele" | "aucun"): ChronicleWorld {
  const playable = events.filter((e) => e.playable);
  const canon = playable.filter((e) => e.kind === "canon").sort((a, b) => (a.code ?? a.id).localeCompare(b.code ?? b.id));
  const successors = new Map<string, string[]>();
  for (const e of canon) for (const p of preds(e)) successors.set(p, [...(successors.get(p) ?? []), e.id]);
  return { balance, mode, events: new Map(events.map((e) => [e.id, e])), canon, generic: playable.filter((e) => e.kind === "generic"), successors };
}

/** Un secret par personnage portant des champs `hidden` (D-36 : chargés en P2, jamais affichés avant révélation). */
export function secretsOf(characters: readonly Character[]): SecretDef[] {
  return characters.filter((c) => c.hidden && Object.keys(c.hidden).length > 0).map((c) => ({ id: `secret_${c.id.replace(/^char_/, "")}`, character: c.id, fields: Object.keys(c.hidden ?? {}).sort() }));
}

export function predecessorsOf(e: EventDef): string[] {
  return preds(e);
}
