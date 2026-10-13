/** Pilier P4 (spec 26 §5) : types du module Signal. Données JSON pures (sérialisables), aucun accès DOM ni aléa global. Plan 2D en mètres. */

/** Couleurs de fusée retenues (03 §7) [C] : rouge, vert, noir (Corps) ; jaune (Garnison). */
export type SignalColor = "rouge" | "vert" | "noir" | "jaune";
export type SignalBranch = "corps" | "garnison";

/** Niveau de communication d'une faction : « signal » (fusées) ou « moderne » (télégraphe/radio, Marley [?]). */
export type CommsTier = "signal" | "moderne";

export interface Signal {
  id: string;
  faction: string;
  branch: SignalBranch;
  color: SignalColor;
  x: number;
  y: number;
  /** Secteur émetteur (« est », « ouest »…), utilisé par la doctrine. */
  sector?: string;
  /** Instant d'émission (s). */
  issuedAtS: number;
  /** Durée pendant laquelle la fusée reste visible (s). */
  durationS: number;
}

/** Conditions de visibilité, toutes dans [0, 1] sauf `night`. */
export interface SignalConditions {
  rain: number;
  smoke: number;
  night: boolean;
  /** Occultation par le relief (0 = dégagé, 1 = masqué). */
  relief: number;
}

export interface SignalUnit {
  id: string;
  faction: string;
  x: number;
  y: number;
  /** Formation (clé de `errors.formation_mult`) ; absente = « defaut ». */
  formation?: string;
  /** La formation de l'unité répète les fusées (éventail, 03 §6). */
  relays: boolean;
  /** Moral 0–1. */
  morale: number;
  /** Siège qui commande l'unité (27 §1). */
  owner?: string;
}

export type SignalError = "mauvais_code" | "fusee_mouillee" | "fumee" | "incomprehension";

export interface Reception {
  unitId: string;
  /** 0 = vue directe ; n = après n relais. */
  hops: number;
  /** Délai depuis l'émission (s). */
  delayS: number;
  /** Couleur comprise (peut différer de l'émise). */
  color: SignalColor;
  error: SignalError | null;
  /** Chaîne d'unités : relais successifs jusqu'à celle-ci (incluse). */
  path: string[];
}

export interface RelayResult {
  signalId: string;
  faction: string;
  range: number;
  /** Une réception par unité atteinte, triée par id. */
  receptions: Reception[];
  /** Unités de la faction non atteintes (chaîne coupée), triées. */
  unreached: string[];
}

/** Fantôme d'information : dernière position connue d'une entité, avec l'âge de l'information. */
export interface Ghost {
  entityId: string;
  /** Faction propriétaire de l'entité observée. */
  faction: string;
  x: number;
  y: number;
  seenAtS: number;
  /** Vitesse supposée (m/s) pour l'incertitude. */
  speedMps: number;
}

/** Carnet de fantômes par faction observatrice : aucune fuite entre factions (clé = observateur). */
export interface GhostBook {
  byObserver: Record<string, Record<string, Ghost>>;
}

export interface GhostView extends Ghost {
  ageS: number;
  /** Rayon d'incertitude (m), croissant avec l'âge. */
  uncertaintyM: number;
}

export interface WorldEntity {
  id: string;
  faction: string;
  x: number;
  y: number;
  speedMps?: number;
  owner?: string;
}

export type FogLevel = "recit" | "normal" | "rude";

export interface SignalMarker {
  signalId: string;
  color: SignalColor;
  meaning: string | null;
  x: number;
  y: number;
  sector?: string;
  /** Âge de la réception côté observateur (s). */
  ageS: number;
  error: SignalError | null;
}

export interface FogViewResult {
  level: FogLevel;
  faction: string;
  /** Entités affichées en position exacte. */
  visible: WorldEntity[];
  /** Fantômes (informations datées). */
  ghosts: GhostView[];
  /** Signaux reçus et lisibles. */
  signals: SignalMarker[];
}

/** Doctrine programmable (spec 26 §5). */
export type OrderKind = "tenir" | "avancer" | "detourner" | "escorter" | "evacuer" | "incendier" | "couvrir" | "retraite";

export type Condition =
  | { kind: "signal"; color: SignalColor; sector?: string; branch?: SignalBranch }
  | { kind: "depot_gaz"; maxKm: number; gasBelowPct: number };

export interface DoctrineOrder {
  kind: OrderKind;
  /** Aile ou groupe visé (« est », « aile_nord », « tous »). */
  target: string;
  /** Déviation de cap en degrés (positif = vers l'est/horaire) pour « detourner ». */
  headingDeltaDeg?: number;
}

export interface DoctrineRule {
  id: string;
  /** Plus grand = plus prioritaire. */
  priority: number;
  when: Condition;
  then: DoctrineOrder;
}

export interface DoctrineContext {
  /** Signaux reçus et compris par l'IA de l'expédition. */
  signals: SignalMarker[];
  gasPct: number;
  /** Distance au dépôt le plus proche (km), null si aucun. */
  depotKm: number | null;
}

export interface IssuedOrder extends DoctrineOrder {
  ruleId: string;
  /** Délai de descente de la chaîne de commandement (s) ; null = coupée. */
  delayS: number | null;
}
