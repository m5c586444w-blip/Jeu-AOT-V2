/** Types de la bataille tactique (P4). Tout l'état est de la donnée sérialisable ; la carte se régénère depuis (définition, graine). */

export const TACTICAL_ORDERS = ["tuer", "tenir", "repli", "couvrir"] as const;
export type TacticalOrder = (typeof TACTICAL_ORDERS)[number];

/**
 * R2+ : ordres du temps réel fin, journalisés comme les ordres classiques (même rejeu). « deplacer » (vers un point) et
 * « suivre » (une escouade) sont des ordres d'escouade ou d'unité ; « formation » règle la disposition ; « tir_zone » et
 * « cessez_feu » s'adressent à une batterie ; « porteur » donne un ordre général (objectif, zone, retenue) à un porteur allié.
 */
export const RT_ORDERS = ["deplacer", "suivre", "formation", "tir_zone", "cessez_feu", "porteur"] as const;
export type RtOrder = (typeof RT_ORDERS)[number];
export type BattleOrder = TacticalOrder | RtOrder;
/** Ordre en cours d'une escouade ou d'une unité. */
export type SquadOrder = TacticalOrder | "deplacer" | "suivre";
/** Formations [A] : ligne (front large), colonne (deux de front), coin (pointe en avant), carré. */
export const FORMATIONS = ["ligne", "colonne", "coin", "carre"] as const;
export type Formation = (typeof FORMATIONS)[number];
/** Ordres généraux d'un porteur [A] : l'IA le mène, le joueur ne fixe que l'objectif, la zone et la retenue. */
export const SHIFTER_OBJECTIVES = ["libre", "titans", "troupes", "proteger"] as const;
export type ShifterObjective = (typeof SHIFTER_OBJECTIVES)[number];
export const RESTRAINTS = ["libre", "mesuree", "stricte"] as const;
export type Restraint = (typeof RESTRAINTS)[number];
export interface ShifterDirective {
  objective: ShifterObjective;
  zone: { x: number; y: number; r: number } | null;
  restraint: Restraint;
}
/** Ordre propre à une unité (R2+) : il prime sur celui de son escouade jusqu'au prochain ordre d'escouade. */
export interface UnitOrder {
  order: SquadOrder;
  x?: number;
  y?: number;
  target?: number;
  foe?: number;
}

/** Causes de mort au combat (03 §9) ; « devore » = saisi et non secouru (03 §4.3). */
export const BATTLE_DEATH_CAUSES = ["frappe", "devore", "chute", "hemorragie", "eclat", "balle", "lame"] as const;
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
  /** R2+ : sections d'infanterie des deux camps (bataille d'armées) ; absentes des batailles antérieures. */
  troops?: TroopSpec[];
  /** R2+ : durée maximale propre (s) ; sinon celle de l'équilibrage. */
  timeLimit?: number;
}

/** R2+ : armes des sections d'infanterie [A] (fusils à répétition, mitrailleuses, troupes d'assaut, cavalerie, fusils anti-Titans). */
export const TROOP_KINDS = ["fusilier", "mitrailleur", "assaut", "cavalier", "antititan"] as const;
export type TroopKind = (typeof TROOP_KINDS)[number];

/** Section d'infanterie engagée (R2+). `faction` sert à l'uniforme et au bilan ; `count` hommes. */
export interface TroopSpec {
  id: string;
  side: "allie" | "ennemi";
  kind: TroopKind;
  count: number;
  faction: string;
}

/** Fantassin en bataille (R2+). */
export interface TroopUnit {
  id: number;
  section: string;
  side: "allie" | "ennemi";
  kind: TroopKind;
  faction: string;
  x: number;
  y: number;
  mode: "ligne" | "marche" | "mort" | "fui";
  /** Blessé : tire moins bien et ne court plus. */
  wounded: boolean;
  reload: number;
  /** Cible : soldat (indice de `soldiers`), fantassin (indice de `troops`) ou Titan. */
  target: { kind: "soldat" | "troupe" | "titan"; index: number } | null;
  heading: number;
  kills: number;
  /** Dernier tir (pour l'affichage : lueur du coup). */
  shot: number;
  death: { t: number; cause: BattleDeathCause; x: number; y: number } | null;
  /** Ordre propre (R2+). */
  rt?: UnitOrder;
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
  /** R2+ : zone de tir imposée par le joueur ; cessez-le-feu. */
  zone?: { x: number; y: number; r: number } | null;
  hold?: boolean;
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
  /** R2+ : ordre général du joueur (porteur allié seulement). */
  directive?: ShifterDirective;
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
  /** R2+ : ordre propre à ce soldat. */
  rt?: UnitOrder;
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
  order: SquadOrder;
  /** Titans signalés à l'escouade (fusée vue ou contact). */
  known: number[];
  /** Point de repli (bord de déploiement). */
  rally: { x: number; y: number };
  /** R2+ (temps réel) : destination, cap, escouade suivie, formation, ordre à reprendre à l'arrivée, file d'ordres. */
  dest?: { x: number; y: number } | null;
  heading?: number;
  follow?: string | null;
  formation?: Formation;
  stance?: TacticalOrder;
  queue?: QueuedOrder[];
  /** Section ennemie visée (indice dans `troops`). */
  foe?: number | null;
  /** R2+ : section d'infanterie (troupes) d'un camp, et non escouade de soldats ; moral de la section (0–100) et effectif de départ. */
  side?: "allie" | "ennemi";
  morale?: number;
  size?: number;
}

/** Ordre en file (R2+) : exécuté quand le précédent est accompli. */
export type QueuedOrder = Omit<TimedOrder, "tick" | "queue">;

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
  /** R2+ : tirs et coups au but des fantassins, morts par camp, coups de lame des soldats sur les fantassins, déroutes. */
  troops?: { shots: number; hits: number; deadAllied: number; deadEnemy: number; melee: number; routs: number; byTitans: number; byArtillery: number };
}

export type KillSource = "lame" | "lance" | "porteur" | "pur";

/** Ordre horodaté (en pas de simulation) : la bataille se rejoue exactement avec la graine et la liste d'ordres (F-CMB-30). */
export interface TimedOrder {
  tick: number;
  squad: string;
  order: BattleOrder;
  target?: number;
  /** R2+ (facultatifs) : unité visée (ordre par unité), point (x, y) et rayon, escouade suivie, formation, ajout à la file,
   * section ennemie visée, ordre général d'un porteur. */
  unit?: number;
  x?: number;
  y?: number;
  r?: number;
  follow?: string;
  formation?: Formation;
  queue?: boolean;
  troop?: number;
  objective?: ShifterObjective;
  restraint?: Restraint;
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
  /** R2+ : vrai dès qu'un ordre temps réel est donné ou que des troupes sont en scène (pas temps réel actif). */
  rt?: boolean;
  /** R2+ : sections d'infanterie des deux camps, et leur tirage propre. */
  troops?: TroopUnit[];
  trRng?: number;
  log: BattleLogEntry[];
  signals: BattleSignal[];
  stats: BattleStats;
  ended: null | { reason: "victoire" | "defaite" | "repli" | "temps"; t: number };
}
