/** Pilier P2 (spec 26 §3 et §3 bis) : types du module Marée. Données JSON pures, aucun accès DOM ni aléa global. Plan 2D en mètres, durées de campagne en heures. */
import type { SeatId } from "../core/seat";
import type { Season } from "../core/time";

/** Grille de densité de Titans. Indice d'une cellule : `y * w + x`. Une cellule bloquée (mur) n'accueille aucun Titan. */
export interface TideGrid {
  w: number;
  h: number;
  cellM: number;
  originX: number;
  originY: number;
  /** Titans par cellule (≥ 0, ≤ max_density). */
  density: number[];
  /** Pics d'attention persistants (combat, canon…), décroissants. */
  spike: number[];
  /** Cellule bloquée : mur ou obstacle infranchissable. */
  blocked: boolean[];
  /** Densité maximale de repeuplement par cellule (0 = protégée : intérieur des murs). */
  capacity: number[];
}

export interface GridSpec {
  w: number;
  h: number;
  originX?: number;
  originY?: number;
  density?: readonly number[];
  blocked?: readonly number[];
  capacity?: number | readonly number[];
}

/** Humains postés sur un mur : attirent les Titans qui s'y accumulent (03 §5.3). */
export interface WallPost {
  x: number;
  y: number;
  men: number;
}

/** Une pile (armée, détachement ou place forte) : effectifs par arme, munitions, moral, position. */
export interface Pile {
  id: string;
  faction: string;
  owner?: SeatId;
  x: number;
  y: number;
  /** Effectifs par identifiant d'arme (clés de `weapons`), en équivalents hommes. */
  troops: Record<string, number>;
  /** Munitions par identifiant d'arme. */
  ammo: Record<string, number>;
  /** Réserve de gaz (ODM). */
  gas: number;
  morale: number;
  suppression: number;
  /** Couvert du terrain 0–1. */
  cover: number;
  /** Densité d'ancrages disponible 0–1 (P3). */
  anchors: number;
  /** Bruit de marche/de combat 0–1 et fumée 0–1. */
  noise: number;
  smoke: number;
  /** Part d'éclaireurs 0–1 et qualité du renseignement 0–1 (P6). */
  scouts: number;
  intel: number;
  /** Dissimulation par le terrain 0–1. */
  concealment: number;
  wounded: number;
  dead: number;
  evacuated: number;
  routed: boolean;
  /** Place forte : ne se déplace pas. */
  fixed?: boolean;
}

export interface Conditions {
  /** Visibilité météo 0–1 (1 = claire). */
  visibility: number;
  hour: number;
  season: Season;
}

export interface TitanEncounter {
  id: string;
  pile: string;
  faction: string;
  titans: number;
  lambdaPerH: number;
}

export type Hostility = (a: string, b: string) => boolean;

export interface HumanEncounter {
  id: string;
  a: string;
  b: string;
  distanceM: number;
  seen: { a: boolean; b: boolean };
  /** Camp qui a vu l'autre sans être vu : embuscade ("a" | "b"), sinon null. */
  ambusher: "a" | "b" | null;
}

/** Ce qu'une faction sait d'une pile qu'elle ne commande pas : position et effectif arrondi, jamais la composition. */
export interface SeenPile {
  id: string;
  faction: string;
  x: number;
  y: number;
  sizeEstimate: number;
}

/** Rencontre humaine telle qu'une faction la connaît (voir `projectEncounterForFaction`). */
export interface EncounterView {
  id: string;
  own: string;
  /** Sa pile a-t-elle repéré l'adversaire ? */
  spotted: boolean;
  /** Identité de l'adversaire : seulement si repéré. */
  other: string | null;
  otherFaction: string | null;
  distanceM: number | null;
}

export interface FactionView {
  faction: string;
  own: Pile[];
  seen: SeenPile[];
}

export interface Geometry {
  distanceM: number;
  /** Part de flanquement de "a" sur "b", 0–1 (bonus de feu de "a", pénalité de moral de "b"). */
  flankA: number;
  /** Part de flanquement de "b" sur "a", 0–1 (symétrique de `flankA`). */
  flankB: number;
  /** Visibilité 0–1 : réduit la précision de tir des deux camps (`combat.fire_vis_floor`). */
  visibility: number;
  /** Nuit : réduit la précision de tir des deux camps (`combat.fire_night_mult`). */
  night: boolean;
  seen: { a: boolean; b: boolean };
  ambusher: "a" | "b" | null;
}

export interface Casualties {
  killed: number;
  wounded: number;
}

export interface EngageReport {
  a: Casualties;
  b: Casualties;
  /** Munitions tirées par camp (somme sur les armes). */
  roundsA: number;
  roundsB: number;
}

export type SizeClass = string;
export type Behavior = "marcheur" | "anormal";

export interface Titan {
  id: string;
  x: number;
  y: number;
  sizeClass: SizeClass;
  behavior: Behavior;
  focus: { target: string; strength: number } | null;
  /** Délai restant avant la prochaine saisie (s) ; absent = prêt. */
  cooldownS?: number;
}

export interface Human {
  id: string;
  x: number;
  y: number;
  /** Taille du groupe représenté. */
  group: number;
  noise: number;
  moving: boolean;
  /** Appât : bruit et mouvement sans groupe. */
  bait?: boolean;
}

export type TitanMode = "actif" | "immobile";
