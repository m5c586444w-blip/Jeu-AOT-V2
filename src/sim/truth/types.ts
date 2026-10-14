export const GRADES = ["A", "B", "C", "D"] as const;
/** Fiabilité d'un fait pour une faction : A (établi) à D (invérifié ou contradictoire). */
export type Grade = (typeof GRADES)[number];

/** Rang numérique d'une fiabilité : 0 (A) à 3 (D). */
export const gradeRank = (g: Grade): number => GRADES.indexOf(g);

/** Vérité du monde : jamais exposée à une vue, seulement comparée à la croyance (conséquence d'une erreur, découverte). */
export interface FactTruth {
  veracity: boolean;
  /** Jour de création du fait. */
  day: number;
}

/** Pièce du dossier d'une faction : une source affirme (ou nie) un fait. Un même `origin` ne compte qu'une fois : sa dernière pièce remplace les précédentes. */
export interface Evidence {
  id: string;
  fact: string;
  /** Clé de `truth.json › sources`. */
  source: string;
  /** Ce que la source affirme : le fait est vrai (true) ou faux (false). */
  claim: boolean;
  day: number;
  /** Origine indépendante (un agent, un registre, un Chemin…) : la corroboration compte des origines distinctes. */
  origin: string;
  /** Qualité de la source (0..1), par exemple la fiabilité de l'agent ; multiplie le poids. */
  quality: number;
}

export type TruthEvent =
  | { type: "discovery"; day: number; faction: string; fact: string; corrected: boolean }
  | { type: "contradiction"; day: number; faction: string; fact: string }
  | { type: "act_reached"; day: number; faction: string; act: string };

export interface TruthState {
  /** Vérité du monde. */
  facts: Record<string, FactTruth>;
  /** Dossier : faction → fait → pièces. */
  dossiers: Record<string, Record<string, Evidence[]>>;
  /** Faits dont une faction a vérifié la vérité : faction → fait → jour. */
  discovered: Record<string, Record<string, number>>;
  /** Acte atteint par faction (identifiant d'acte). */
  acts: Record<string, string>;
  canon: {
    /** Écart cumulé aux conditions de l'histoire (s'ajoute à la divergence du moteur d'événements). */
    drift: number;
    /** Dernier jour pour lequel les attracteurs ont été évalués (idempotence). */
    lastDay: number;
    /** Événements canon déclenchés par un attracteur : id → jour. */
    pulled: Record<string, number>;
  };
  events: TruthEvent[];
  seq: number;
}

/** Évaluation d'un fait par une faction (jamais la véracité). */
export interface Assessment {
  /** Ce que la faction croit ; null : pas assez de marge entre les deux versions. */
  belief: boolean | null;
  /** null : aucune pièce (inconnu). */
  grade: Grade | null;
  /** Score de confiance (interne au calcul de grade). */
  confidence: number;
  /** Origines distinctes soutenant la croyance (0 si aucune croyance). */
  backing: number;
  /** Les deux versions existent dans le dossier. */
  contradicted: boolean;
  /** Âge (jours) de la pièce la plus récente ; null sans pièce. */
  ageDays: number | null;
  verified: boolean;
}

export interface DossierLine {
  fact: string;
  belief: boolean | null;
  grade: Grade | null;
  backing: number;
  contradicted: boolean;
  ageDays: number | null;
  verified: boolean;
  /** Pièces affichables : source, affirmation, âge. */
  evidence: { source: string; claim: boolean; ageDays: number; origin: string }[];
}

export interface TruthView {
  faction: string;
  act: string;
  capabilities: string[];
  dossier: DossierLine[];
}

export interface Decision {
  believed: boolean | null;
  grade: Grade | null;
  /** La croyance contredit la vérité (information fausse suivie). */
  mistaken: boolean;
  /** Coût réel de l'erreur (0 si la croyance est juste). */
  cost: number;
}

export class TruthError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "TruthError";
  }
}
