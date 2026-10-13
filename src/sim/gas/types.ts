/** Pilier P3 (spec 26 §4) : types du module Gaz et Ancrage. Données JSON pures (sérialisables), aucun accès DOM ni aléa global. */

/** Dégâts cumulés par ancrage (0 = intact, 1 = détruit). Clé = identifiant d'ancrage ; seules les entrées > 0 existent. */
export interface AnchorLedger {
  damage: Record<string, number>;
}

export type DestructionCause = "titan" | "incendie" | "demolition" | "artillerie";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface SectorDensity {
  sx: number;
  sy: number;
  /** Nombre d'ancrages valides dans le secteur. */
  count: number;
  /** Ancrages valides par hectare. */
  perHa: number;
  klass: "rare" | "moyen" | "riche";
}

export interface DensityEstimate extends SectorDensity {
  /** Incertitude relative (± fraction de perHa) : fonction du renseignement (P6). */
  error: number;
  low: number;
  high: number;
}

export interface CutInput {
  /** Vitesse d'approche (m/s). */
  speed: number;
  /** Écart angulaire à l'axe de la nuque (rad, 0 = plein axe). */
  angle: number;
  /** Compétence ODM 0–100. */
  skill: number;
  /** Usure de la lame 0–1. */
  bladeWear: number;
  /** Stress 0–1. */
  stress: number;
}

export interface CutWindow {
  /** Probabilité de nuque tranchée. */
  probability: number;
  /** Durée de la fenêtre (s). */
  durationS: number;
  /** Demi-angle du cône d'ouverture (rad), pour l'affichage en pause active. */
  coneHalfAngle: number;
}

/** Stock stratégique (sous-ensemble de `StockMap` : gaz et acier des lames). */
export interface GasStock {
  gas: number;
  steel: number;
}

export interface BattleCostInput {
  soldiers: number;
  /** Densité d'ancrage moyenne du champ de bataille (par ha). */
  densityPerHa: number;
  /** Coupes attendues (Titans visés). */
  expectedCuts: number;
}

export interface BattleCost {
  gas: number;
  steel: number;
}

export interface DrawResult {
  stock: GasStock;
  drawn: BattleCost;
  /** Manque non couvert (0 si le stock suffit). */
  shortfall: BattleCost;
}
