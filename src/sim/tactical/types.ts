/** Types de la bataille tactique (P4). Tout l'état est de la donnée sérialisable ; la carte se régénère depuis (définition, graine). */

export const TACTICAL_ORDERS = ["tuer", "tenir", "repli", "couvrir"] as const;
export type TacticalOrder = (typeof TACTICAL_ORDERS)[number];

/** Causes de mort au combat (03 §9) ; « devore » = saisi et non secouru (03 §4.3). */
export const BATTLE_DEATH_CAUSES = ["frappe", "devore", "chute", "hemorragie", "eclat"] as const;
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
  /** Titans-porteurs engagés (P6), d'un côté ou de l'autre. */
  shifters?: ShifterSpec[];
  /** Lances de foudre (T-ANT-08) : dotation de chaque soldat. */
  thunderSpears?: boolean;
  /** Drapeaux de partie utiles au combat (contact royal pour le Fondateur, 02 §10). */
  flags?: string[];
  /** Batteries d'artillerie (PA.5) : absentes des batailles antérieures (même hash). */
  artillery?: BatterySpec[];
}

/** Batterie engagée (PA.5) : « allie » tire pour Paradis (Titans, contre-batterie), « ennemi » contre ses soldats. */
export interface BatterySpec {
  id: string;
  piece: string;
  munition: string;
  side: "allie" | "ennemi";
  count: number;
}

export interface BatteryUnit extends BatterySpec {
  x: number;
  y: number;
  /** Pièces encore en état de tirer. */
  alive: number;
  reload: number;
  shots: number;
  /** Point visé du dernier coup (zone de danger affichée). */
  aim: { x: number; y: number; r: number } | null;
}

export interface Impact {
  t: number;
  x: number;
  y: number;
  r: number;
  side: "allie" | "ennemi";
}

/** Porteur engagé dans une bataille (P6). « allie » : au service de Paradis ; « ennemi » : contre lui. */
export interface ShifterSpec {
  shifter: string;
  side: "allie" | "ennemi";
  /** Nom du porteur (affiché) ; personnage le cas échéant. */
  name: string;
  character: string | null;
  /** Stress de départ (0–100) : nourrit la perte de contrôle. */
  stress: number;
}

export type ShifterPhase = "humain" | "transformation" | "titan" | "epuise" | "vaincu";

/** Porteur en bataille : l'humain, puis le corps de Titan (une entrée de `titans` liée par `body`). */
export interface ShifterUnit {
  id: number;
  shifter: string;
  side: "allie" | "ennemi";
  name: string;
  character: string | null;
  phase: ShifterPhase;
  x: number;
  y: number;
  /** Index du corps dans `titans` (null tant que non transformé). */
  body: number | null;
  /** Compte à rebours de la transformation, puis recharge avant une nouvelle (s). */
  timer: number;
  cooldown: number;
  endurance: number;
  maxEndurance: number;
  hp: { nape: number; armL: number; armR: number; legs: number };
  maxHp: { nape: number; arm: number; leg: number };
  /** Durcissement (armure locale) restant (s). */
  hardened: number;
  /** Recharge et durée restante de chaque capacité. */
  cd: Record<string, number>;
  active: Record<string, number>;
  stress: number;
  /** Perte de contrôle restante (s) (F-TIT-14). */
  rampage: number;
  attackCooldown: number;
  kills: number;
}

/** Mesure de chaque capacité : emplois et effet produit (unités propres à l'effet ; voir sim:shifters). */
export interface AbilityStat {
  uses: number;
  effect: number;
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
  /** Lances de foudre restantes (P6, T-ANT-08). */
  spears?: number;
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
  /** Corps d'un porteur (P6) : index dans `shifters` ; ses points de vie y vivent. */
  shifter?: number;
  /** Corps d'un porteur allié : jamais visé par les soldats. */
  ally?: boolean;
  /** Attiré par un cri d'appel (03 §8.2) : point de ralliement et durée restante. */
  lure?: { x: number; y: number; t: number };
  /** Rallié par la Coordonnée du Fondateur : ne frappe plus les soldats (s restantes). */
  commanded?: number;
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
  /** P6 : capacités des porteurs, lances de foudre, lames sur un porteur, pertes de contrôle, transformations. */
  abilities?: Record<string, AbilityStat>;
  spears?: { thrown: number; hits: number; damage: number };
  bladeDamage?: number;
  rampages?: number;
  transformations?: number;
  /** R0 : coupes qui ont porté (nuque ou membre), à distinguer des tentatives (`cuts`). */
  cutsLanded?: number;
  /** R0 : Titans abattus par cause : lame, lance de foudre, porteur allié, Titan pur (contre un porteur). */
  killedBy?: Partial<Record<KillSource, number>>;
  /** PA.5 : tirs, Titans touchés, soldats tués par éclats (dont tirs amis), pièces réduites au silence. */
  artillery?: { shots: number; titanHits: number; soldierKills: number; friendlyKills: number; piecesSilenced: number };
}

export type KillSource = "lame" | "lance" | "porteur" | "pur";

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
  /** Porteurs (P6). */
  shifters?: ShifterUnit[];
  /** Batteries (PA.5), derniers impacts et tirage propre à l'artillerie (les batailles sans canon gardent leur suite de tirages). */
  batteries?: BatteryUnit[];
  impacts?: Impact[];
  artRng?: number;
  log: BattleLogEntry[];
  signals: BattleSignal[];
  stats: BattleStats;
  ended: null | { reason: "victoire" | "defaite" | "repli" | "temps"; t: number };
}
