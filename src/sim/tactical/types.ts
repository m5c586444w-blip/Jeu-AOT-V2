/** Types de la bataille tactique (P4). Tout l'état est de la donnée sérialisable ; la carte se régénère depuis (définition, graine). */

export const TACTICAL_ORDERS = ["tuer", "tenir", "repli", "couvrir"] as const;
export type TacticalOrder = (typeof TACTICAL_ORDERS)[number];

/** Causes de mort au combat (03 §9) ; « devore » = saisi et non secouru (03 §4.3). */
export const BATTLE_DEATH_CAUSES = ["frappe", "devore", "chute", "hemorragie"] as const;
export type BattleDeathCause = (typeof BATTLE_DEATH_CAUSES)[number];

export interface SoldierSpec {
  id: string;
  name: string;
  squad: string;
  leader: boolean;
  /** Personnage nommé (P2) le cas échéant. */
  named: string | null;
  odm: number;
  melee: number;
  courage: number;
  reaction: number;
  ackerman: boolean;
  /** Expéditions déjà survécues (vétérans). */
  veteran: number;
}

export interface BattleSetup {
  map: string;
  seed: number;
  night: boolean;
  soldiers: SoldierSpec[];
  titans: { type: string; count: number }[];
  /** Chariot de soutien (F-CMB-14). */
  wagon: boolean;
}

export interface SoldierUnit extends SoldierSpec {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  mode: "sol" | "crochet" | "rail" | "vol" | "saisi" | "mort" | "fui";
  /** Ancrage visé : fixe (id) ou le corps d'un Titan (id de Titan). */
  anchor: { kind: "fixe"; id: number; x: number; y: number; z: number } | { kind: "titan"; titan: number } | null;
  hookTimer: number;
  gas: number;
  wear: number;
  pairs: number;
  changeTimer: number;
  cutCooldown: number;
  target: number | null;
  wound: "aucune" | "legere" | "grave";
  bleedTimer: number;
  stress: number;
  grabbedBy: number | null;
  /** Altitude maximale depuis le dernier appui (dégâts de chute). */
  apex: number;
  kills: number;
  death: { t: number; cause: BattleDeathCause; titan: number | null; x: number; y: number } | null;
}

export interface TitanUnit {
  id: number;
  type: string;
  behavior: string;
  cls: string;
  abnormal: boolean;
  /** Menace de la classe (03 §5.2, données de P3) : règle la cadence des attaques. */
  threat: number;
  height: number;
  speed: number;
  x: number;
  y: number;
  heading: number;
  target: number | null;
  alive: boolean;
  /** Membres coupés : temps restant avant repousse (s) ; 0 = intact (03 §5.2 : régénération). */
  armL: number;
  armR: number;
  legs: number;
  attackCooldown: number;
  grabbing: number | null;
  grabTimer: number;
  silhouette: number;
  killedBy: number | null;
}

export interface SquadState {
  id: string;
  order: TacticalOrder;
  /** Titans signalés à l'escouade (fusée vue ou contact). */
  known: number[];
  /** Point de repli (bord de déploiement). */
  rally: { x: number; y: number };
}

export interface BattleLogEntry {
  t: number;
  key: string;
  params: Record<string, string | number>;
}

export interface BattleSignal {
  t: number;
  squad: string;
  color: "rouge" | "noir" | "vert";
  x: number;
  y: number;
  misread: boolean;
}

export interface BattleStats {
  cuts: number;
  napes: number;
  limbs: number;
  misses: number;
  bladesBroken: number;
  gasUsed: number;
  dodges: number;
  grabs: number;
  rescues: number;
  falls: number;
  deathsByCause: Partial<Record<BattleDeathCause, number>>;
  titansKilled: Record<string, number>;
}

/** Ordre horodaté (en pas de simulation) : la bataille se rejoue exactement avec la graine et la liste d'ordres (F-CMB-30). */
export interface TimedOrder {
  tick: number;
  squad: string;
  order: TacticalOrder;
  target?: number;
}

export interface BattleState {
  setupHash: number;
  tick: number;
  rng: number;
  soldiers: SoldierUnit[];
  titans: TitanUnit[];
  squads: SquadState[];
  wagon: { x: number; y: number } | null;
  log: BattleLogEntry[];
  signals: BattleSignal[];
  stats: BattleStats;
  ended: null | { reason: "victoire" | "defaite" | "repli" | "temps"; t: number };
}
