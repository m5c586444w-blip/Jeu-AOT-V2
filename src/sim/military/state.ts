import { Rng } from "../core/rng";
import type { GameDate } from "../core/time";
import type { MilitaryWorld, World } from "../strategic/world";
import { clamp, gaussian, weighted } from "./random";
import type { FieldDeathCause, Formation, Objective, RetreatCondition, Signal, SoldierRole } from "./vocabulary";

/** Soldat du Corps d'exploration (F-CHR-17) : individu généré [A], avec dossier de mort éventuel (03 §9). */
export interface Soldier {
  id: string;
  given: string;
  family: string;
  female: boolean;
  age: number;
  role: SoldierRole;
  squad: string;
  leader: boolean;
  odm: number;
  melee: number;
  courage: number;
  endurance: number;
  /** pret : disponible ; mission : en expédition ; blesse : indisponible jusqu'à `recovers` ; mort. */
  status: "pret" | "mission" | "blesse" | "mort";
  recovers: number | null;
  expeditions: number;
  kills: number;
  death: SoldierDeath | null;
}

export interface SoldierDeath {
  date: GameDate;
  province: string;
  cause: FieldDeathCause;
  expedition: string;
  squad: string;
}

export interface Squad {
  id: string;
  unit: string;
  members: string[];
}

export interface Supplies {
  food: number;
  gas: number;
  steel: number;
}

export interface RetreatPlan {
  losses_pct: number;
  gas_pct: number;
  abnormal: number;
  max_days: number;
}

/** Plan d'expédition (F-EXP-01) : tout ce que le joueur fixe avant le départ. */
export interface ExpeditionPlan {
  objective: Objective;
  /** Itinéraire aller, de la base à l'objectif inclus (provinces voisines). */
  route: string[];
  formation: Formation;
  squads: string[];
  /** Personnages nommés qui accompagnent l'expédition ; le premier commande. */
  officers: string[];
  horses: number;
  wagons: number;
  /** Provisions emportées en unités de stock (gaz : recharges en plus des réservoirs pleins). */
  supplies: Supplies;
  /** Objectif « dépôt » : chargement déposé à l'arrivée (F-LOG-04). */
  depotCargo: Supplies;
  retreat: RetreatPlan;
}

export interface ExpeditionStats {
  departed: number;
  encounters: number;
  detected: number;
  evaded: number;
  engagements: number;
  abnormal: number;
  titansKilled: number;
  byClass: Record<string, number>;
  gasUsedOdm: number;
  bladesUsed: number;
  foodUsed: number;
  horsesLost: number;
  wounded: number;
  deathsByCause: Partial<Record<FieldDeathCause, number>>;
  daysOutside: number;
}

export interface SignalEntry {
  day: number;
  province: string;
  color: Signal;
  misread: boolean;
}

export interface FieldLogEntry {
  day: number;
  key: string;
  params: Record<string, string | number>;
}

export interface Expedition {
  id: string;
  number: number;
  plan: ExpeditionPlan;
  status: "en_route" | "terminee";
  phase: "aller" | "objectif" | "retour";
  launched: GameDate;
  day: number;
  /** Chemin restant à parcourir (première case = province actuelle). */
  path: string[];
  /** Provinces parcourues depuis la base (dernière case = province actuelle) : chemin du retour. */
  trail: string[];
  progressKm: number;
  objectiveDaysLeft: number;
  objectiveReached: boolean;
  retreat: RetreatCondition | null;
  soldiers: string[];
  officers: string[];
  horses: number;
  horseFatigue: number;
  morale: number;
  gasOdm: number;
  gasOdmStart: number;
  bladePairs: number;
  food: number;
  foodStart: number;
  seriousWounded: string[];
  /** Alertes de seuil déjà émises (F-LOG-13), pour ne les signaler qu'une fois. */
  alerted: string[];
  stats: ExpeditionStats;
  signals: SignalEntry[];
  log: FieldLogEntry[];
  dead: string[];
  namedDead: string[];
  /** Coût politique payé au départ (F-EXP-07). */
  capitalPaid: number;
  goldPaid: number;
}

export interface Depot {
  id: string;
  province: string;
  stocks: Supplies;
  built: GameDate;
  /** Alerte « vivres bas » déjà émise (réarmée quand le dépôt est réapprovisionné). */
  lowAlerted: boolean;
}

export interface Convoy {
  id: string;
  number: number;
  /** Chemin restant (première case = province actuelle) jusqu'au dépôt. */
  path: string[];
  progressKm: number;
  depot: string;
  cargo: Supplies;
  wagons: number;
  escort: number;
  /** Garnison qui fournit l'escorte (première garnison de la Garnison sur le chemin, en général la porte). */
  escortFrom: string | null;
  status: "en_route" | "livre" | "perdu";
  launched: GameDate;
  log: FieldLogEntry[];
}

export interface DeadRecord {
  id: string;
  name: string;
  leader: boolean;
  squad: string;
  cause: FieldDeathCause;
  province: string;
  date: GameDate;
  named: boolean;
}

/** Rapport post-mission (F-EXP-06, 04 §5.12) : figé au retour, lisible sans l'état de l'expédition. */
export interface ExpeditionReport {
  id: string;
  number: number;
  objective: Objective;
  target: string;
  formation: Formation;
  launched: GameDate;
  returned: GameDate;
  days: number;
  outcome: "reussie" | "partielle" | "echec";
  retreat: RetreatCondition | null;
  stats: ExpeditionStats;
  dead: DeadRecord[];
  signals: SignalEntry[];
  log: FieldLogEntry[];
  lessons: FieldLogEntry[];
  politics: { capital: number; legitimacy: number; corpsLoyalty: number };
}

export interface MilitaryState {
  soldiers: Record<string, Soldier>;
  squads: Squad[];
  seq: { expedition: number; convoy: number; depot: number };
  expeditions: Expedition[];
  depots: Depot[];
  convoys: Convoy[];
  reports: ExpeditionReport[];
}

export const REPORTS_LIMIT = 30;

export function militaryWorld(world: World): MilitaryWorld {
  if (!world.military) throw new Error("monde sans couche militaire (P3)");
  return world.military;
}

/** Effectif du Corps d'exploration au départ : garnisons `survey_corps` du scénario. */
export function corpsSize(world: World): number {
  return Object.values(world.scenario.garrisons)
    .filter((g) => g.org === "survey_corps")
    .reduce((s, g) => s + g.soldiers, 0);
}

const ROLE_UNIT: Record<SoldierRole, string> = { eclaireur: "unit_p01", tueur: "unit_p02", soutien: "unit_p03", cavalier: "unit_p04", medecin: "unit_p13" };
/** Attribut renforcé par le rôle (03 §3.1). */
const ROLE_BONUS: Record<SoldierRole, keyof Pick<Soldier, "odm" | "melee" | "courage" | "endurance">> = { eclaireur: "endurance", tueur: "odm", soutien: "endurance", cavalier: "endurance", medecin: "courage" };

/**
 * Corps généré par graine (fork « roster ») : mêmes données et même graine → mêmes soldats (AC3-02).
 * Escouades de la taille du type d'unité, bornée par `roster.squad_size` ; rôle tiré selon `roster.roles`.
 */
export function createMilitaryState(world: World, seed: number): MilitaryState {
  const m = militaryWorld(world);
  const rng = new Rng(seed).fork(`roster:${world.scenario.id}`);
  const r = m.exp.roster;
  const roles = Object.entries(r.roles) as [SoldierRole, number][];
  const total = corpsSize(world);
  const soldiers: Record<string, Soldier> = {};
  const squads: Squad[] = [];
  const used = new Set<string>();
  let n = 0;
  const attr = (): number => Math.round(clamp(r.attribute_mean + r.attribute_sd * gaussian(rng), 5, 95));
  while (n < total) {
    const role = weighted(rng, roles);
    const unit = m.units.get(ROLE_UNIT[role]);
    // Escouade de 4 à 6 (03 §6) quel que soit le type ; une section de cavalerie (10–20, 10 §1.1) regroupe plusieurs escouades.
    const lo = clamp(unit?.size[0] ?? r.squad_size[0], r.squad_size[0], r.squad_size[1]);
    const hi = clamp(unit?.size[1] ?? r.squad_size[1], lo, r.squad_size[1]);
    const size = Math.min(total - n, rng.int(lo, hi));
    const squad: Squad = { id: `esc_${String(squads.length + 1).padStart(2, "0")}`, unit: ROLE_UNIT[role], members: [] };
    for (let i = 0; i < size; i++) {
      n++;
      const female = rng.next() < r.female_share;
      let given = "";
      let family = "";
      for (let tries = 0; tries < 50; tries++) {
        given = rng.pick(female ? m.names.given_f : m.names.given_m);
        family = rng.pick(m.names.family);
        if (!used.has(`${given} ${family}`)) break;
      }
      used.add(`${given} ${family}`);
      const s: Soldier = {
        id: `sol_${String(n).padStart(3, "0")}`,
        given,
        family,
        female,
        age: rng.int(r.age[0], r.age[1]),
        role,
        squad: squad.id,
        leader: i === 0,
        odm: attr(),
        melee: attr(),
        courage: attr(),
        endurance: attr(),
        status: "pret",
        recovers: null,
        expeditions: rng.int(0, 3),
        kills: 0,
        death: null,
      };
      const key = ROLE_BONUS[role];
      s[key] = Math.min(95, s[key] + 8);
      if (s.leader) s.courage = Math.min(95, s.courage + 5);
      soldiers[s.id] = s;
      squad.members.push(s.id);
    }
    squads.push(squad);
  }
  return { soldiers, squads, seq: { expedition: 0, convoy: 0, depot: 0 }, expeditions: [], depots: [], convoys: [], reports: [] };
}

export function soldierName(s: Pick<Soldier, "given" | "family">): string {
  return `${s.given} ${s.family}`;
}

/** Soldats disponibles d'une escouade (ni morts, ni blessés, ni déjà en mission). */
export function readyMembers(mil: MilitaryState, squadId: string): Soldier[] {
  const sq = mil.squads.find((x) => x.id === squadId);
  return (sq?.members ?? []).map((id) => mil.soldiers[id]).filter((s): s is Soldier => !!s && s.status === "pret");
}
