/** Pilier P1 (spec 26 §2) : types du module Le Mur. Données JSON pures (sérialisables), aucun accès DOM ni aléa global. */
import type { SeatId } from "../core/seat";

export type Ring = "maria" | "rose" | "sina";
export type DistrictStatus = "intact" | "breach" | "abandoned" | "reconquered";
export type PressureLevel = "calme" | "tendu" | "critique" | "rupture";

export interface District {
  id: string;
  ring: Ring;
  /** Siège qui dirige le district (27) ; absent = siège de sa faction. */
  owner?: SeatId;
  population: number;
  /** Capacité alimentaire : nombre de personnes nourries par la surface agricole et les réserves. */
  foodCapacity: number;
  /** Part des rations distribuées (1 = pleines). */
  rations: number;
  /** Ordre public 0–100. */
  order: number;
  status: DistrictStatus;
  /** Nettoyage des Titans après reconquête, 0–1. */
  cleanup: number;
  /** Districts voisins (flux de réfugiés). */
  neighbors: string[];
}

/** Registre de population : la population totale vaut toujours départ + naissances − décès + importé − exporté. */
export interface PopulationLedger {
  start: number;
  births: number;
  deaths: number;
  /** Envoyés hors des murs (désengorgement) : sortent du registre. */
  exported: number;
}

export interface Evacuation {
  id: string;
  from: string;
  to: string;
  /** Civils encore à faire partir (retirés du district d'origine, exposés aux Titans). */
  waiting: number;
  /** Lots en marche vers l'anneau d'accueil. */
  batches: Array<{ n: number; hoursLeft: number }>;
  distanceM: number;
  hoursElapsed: number;
  done: boolean;
}

export interface Project {
  id: string;
  district: string;
  monthsLeft: number;
  gain: number;
}

export interface WallState {
  districts: Record<string, District>;
  /** Portes d'accueil ouvertes, par anneau. */
  gates: Record<Ring, boolean>;
  evacuations: Evacuation[];
  ledger: PopulationLedger;
  /** Mois consécutifs au-dessus du seuil de désengorgement, par anneau. */
  monthsOver: Record<Ring, number>;
  projects: Project[];
  /** Effets politiques cumulés à appliquer par l'appelant (légitimité, ordre) ; remis à zéro par `drainEffects`. */
  effects: { legitimacy: number };
  nextId: number;
}

export interface Decision {
  ring: Ring;
  options: DecisionKind[];
  pressure: number;
}
export type DecisionKind = "rationner" | "desengorger" | "nouvelles_terres";

export interface DecisionResult {
  state: WallState;
  legitimacy: number;
  note: string;
}
