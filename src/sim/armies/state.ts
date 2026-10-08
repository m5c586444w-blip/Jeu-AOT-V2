import type { Regiment } from "../../data/armySchemas";
import type { Explained } from "../core/explain";
import type { GameDate } from "../core/time";
import { toAbsoluteDay } from "../core/time";
import type { ArmiesWorld, World } from "../strategic/world";
import type { NationsState } from "../world/nations";
import { atWar } from "../world/nations";

/**
 * Armées sur la carte (PA, 21 §7 et 23 §3.2) : piles de régiments avec un général, flottes (Marley, Alliés, Hizuru),
 * rencontres, sièges, succession. Couche facultative de l'état : absente d'une sauvegarde antérieure (son hash ne change pas).
 */

export interface RegimentStack {
  regiment: string;
  count: number;
  /** État moyen des régiments (0–1) : effectif réel = hommes × nombre × état. */
  strength: number;
}

export type ArmyStance = "marche" | "halte" | "retraite";

export interface ArmyState {
  id: string;
  faction: string;
  name_key: string;
  /** Numéro affiché (1re armée, 2e armée…) pour les armées levées en cours de partie. */
  number: number;
  insignia: string;
  general: string | null;
  general_key: string;
  /** Commandement intérimaire (général mort ou absent). */
  interim: boolean;
  /** Province ; null quand l'armée est embarquée. */
  province: string | null;
  fleet: string | null;
  regiments: RegimentStack[];
  morale: number;
  /** Jours de vivres et de gaz emportés. */
  supply: number;
  fatigue: number;
  /** Provinces à parcourir (sans la province actuelle). */
  route: string[];
  /** Kilomètres parcourus vers la première province de la route. */
  progress: number;
  forced: boolean;
  /** Armée ennemie à intercepter. */
  target: string | null;
  stance: ArmyStance;
  /** Rencontre en cours (l'armée ne bouge plus). */
  engaged: string | null;
  /** Jour du débarquement (pénalité au premier combat). */
  landed: number | null;
}

export interface ShipStack {
  ship: string;
  count: number;
  strength: number;
}

export type FleetMission = "patrouille" | "blocus" | "escorte";

export interface FleetState {
  id: string;
  faction: string;
  name_key: string;
  admiral: string | null;
  sea: string;
  ships: ShipStack[];
  route: string[];
  progress: number;
  embarked: string[];
  mission: FleetMission;
}

export type EncounterKind = "armees" | "titans" | "debarquement" | "naval";

export interface EncounterSide {
  faction: string;
  armies: string[];
}

export interface EncounterResult {
  mode: "auto" | "jouer" | "retraite";
  winner: string | null;
  /** Hommes perdus par faction. */
  losses: Record<string, number>;
  generals: string[];
  titansKilled: number;
  power: Record<string, Explained>;
}

export interface Encounter {
  id: string;
  day: number;
  province: string;
  kind: EncounterKind;
  sides: EncounterSide[];
  /** Titans rencontrés (rencontre « titans »). */
  titans: number;
  /** Côté qui tient le terrain (défenseur), null pour une rencontre en marche. */
  defender: string | null;
  status: "attente" | "resolue";
  result: EncounterResult | null;
}

export interface Siege {
  segment: string;
  faction: string;
  army: string;
  since: number;
  /** Pièces ennemies réduites au silence par la contre-batterie. */
  silenced: number;
  breached: boolean;
}

export interface Claimant {
  id: string;
  /** Force de la prétention (0–100), expliquée. */
  claim: number;
  reasons: { key: string; value: number }[];
}

export interface SuccessionCrisis {
  deceased: string;
  since: number;
  deadline: number;
  claimants: Claimant[];
}

export interface ArmyLogEntry {
  day: number;
  key: string;
  params: Record<string, string | number>;
}

export interface ArmyAiDecision {
  day: number;
  faction: string;
  army: string;
  action: string;
  reasons: { key: string; value: number }[];
}

export interface ArmiesState {
  seq: number;
  armies: ArmyState[];
  fleets: FleetState[];
  encounters: Encounter[];
  sieges: Siege[];
  /** Provinces de Paradis occupées : province → faction occupante. */
  occupied: Record<string, string>;
  /** Jours de présence ennemie sans défenseur (avant occupation). */
  pressure: Record<string, number>;
  /** Prélèvements du dernier jour dans les stocks nationaux (vivres, gaz, poudre, or), hors plan économique. */
  drawn?: Record<string, number>;
  succession: SuccessionCrisis | null;
  log: ArmyLogEntry[];
  ai: ArmyAiDecision[];
}

export const ENCOUNTER_CAP = 30;
export const ARMY_LOG_CAP = 120;

export function armiesWorld(world: World): ArmiesWorld {
  if (!world.armies) throw new Error("monde sans armées (PA)");
  return world.armies;
}

/** Couche des armées au départ du scénario (ou au premier ordre d'une sauvegarde antérieure, `RaiseArmies`). */
export function createArmiesState(world: World, date: GameDate): ArmiesState | null {
  const aw = world.armies;
  if (!aw) return null;
  void date;
  const armies: ArmyState[] = aw.starts.map((a, i) => ({
    id: a.id,
    faction: a.faction,
    name_key: a.name_key,
    number: i + 1,
    insignia: a.insignia,
    general: a.general,
    general_key: a.general_key,
    interim: false,
    province: a.province,
    fleet: null,
    regiments: a.regiments.map((r) => ({ regiment: r.regiment, count: r.count, strength: 1 })),
    morale: a.morale,
    supply: a.supply_days,
    fatigue: 0,
    route: [],
    progress: 0,
    forced: false,
    target: null,
    stance: "halte",
    engaged: null,
    landed: null,
  }));
  const fleets: FleetState[] = aw.fleets.map((f) => ({
    id: f.id,
    faction: f.faction,
    name_key: f.name_key,
    admiral: f.admiral,
    sea: f.sea,
    ships: f.ships.map((s) => ({ ship: s.ship, count: s.count, strength: 1 })),
    route: [],
    progress: 0,
    embarked: [...f.embarked],
    mission: "patrouille",
  }));
  for (const f of fleets) for (const id of f.embarked) {
    const a = armies.find((x) => x.id === id);
    if (a) {
      a.fleet = f.id;
      a.province = null;
    }
  }
  return { seq: armies.length, armies, fleets, encounters: [], sieges: [], occupied: {}, pressure: {}, succession: null, log: [], ai: [] };
}

export function pushArmyLog(s: ArmiesState, date: GameDate, key: string, params: Record<string, string | number>): void {
  s.log.push({ day: toAbsoluteDay(date), key, params });
  if (s.log.length > ARMY_LOG_CAP) s.log.splice(0, s.log.length - ARMY_LOG_CAP);
}

export function regimentOf(aw: ArmiesWorld, id: string): Regiment {
  const r = aw.regiments.get(id);
  if (!r) throw new Error(`régiment inconnu : ${id}`);
  return r;
}

/** Effectif réel d'une armée (hommes). */
export function armyMen(aw: ArmiesWorld, a: ArmyState): number {
  return Math.round(a.regiments.reduce((n, r) => n + (aw.regiments.get(r.regiment)?.men ?? 0) * r.count * r.strength, 0));
}

/** Pièces d'artillerie en état (nombre × état arrondi), par pièce. */
export function armyPieces(aw: ArmiesWorld, a: ArmyState): { piece: string; count: number }[] {
  const out = new Map<string, number>();
  for (const r of a.regiments) {
    const p = aw.regiments.get(r.regiment)?.pieces;
    if (!p) continue;
    out.set(p.piece, (out.get(p.piece) ?? 0) + Math.round(p.count * r.count * r.strength));
  }
  return [...out].filter(([, n]) => n > 0).map(([piece, count]) => ({ piece, count }));
}

/** Vitesse de base (km/jour) : celle du régiment le plus lent. */
export function armyBaseSpeed(aw: ArmiesWorld, a: ArmyState): number {
  return Math.min(...a.regiments.map((r) => aw.regiments.get(r.regiment)?.speed_km_day ?? 20));
}

export function isStatic(aw: ArmiesWorld, a: ArmyState): boolean {
  return a.regiments.some((r) => aw.regiments.get(r.regiment)?.static === true);
}

/** Deux factions s'affrontent sur l'île : guerre déclarée au monde (P7) ; sans monde des nations, Paradis n'a pas d'ennemi humain. */
export function hostile(ns: NationsState | null, a: string, b: string): boolean {
  if (a === b) return false;
  return ns ? atWar(ns, a, b) : false;
}

/** Faction jouée (Paradis sans monde des nations). */
export function playerOf(ns: NationsState | null): string {
  return ns?.player ?? "fac_paradis";
}

/** Conditions d'accès d'une arme ou d'un régiment (11 §8 : jamais avant sa date). */
export function requiresMet(req: { min_year: number; tech?: string | undefined; event?: string | undefined }, date: GameDate, techDone: (id: string) => boolean, eventDone: (id: string) => boolean): boolean {
  if (date.year < req.min_year) return false;
  if (req.tech && !techDone(req.tech)) return false;
  if (req.event && !eventDone(req.event)) return false;
  return true;
}
