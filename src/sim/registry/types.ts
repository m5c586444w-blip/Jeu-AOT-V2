/** Statut d'un soldat : exactement un (invariant de conservation). */
export type Status = "vivant" | "mort" | "disparu";

export interface Soldier {
  id: string;
  faction: string;
  /** Nommé : porte un nom, un rang et une renommée. Généré : tracé par identifiant (matricule) seulement, jusqu'à sa promotion. */
  named: boolean;
  name: string | null;
  rank: string;
  squad: string;
  status: Status;
  /** Jour d'engagement. */
  joined: number;
  battles: number;
  lastBattle: number | null;
  renown: number;
  morale: number;
  stress: number;
  /** Refuse les ordres jusqu'à ce jour (exclu). */
  refusingUntil: number | null;
  missingSince: number | null;
  /** Raison de la disparition (« desertion », ou texte fourni par l'appelant). */
  missingReason: string | null;
  /** Personnage du dossier politique (`PoliticalState.characters`) lié à ce soldat, le cas échéant. */
  character: string | null;
  promotedDay: number | null;
  /** Identifiant du dossier de mort (jamais deux). */
  death: string | null;
}

/** Lien entre deux soldats de la même faction (un seul par paire). */
export interface Bond {
  a: string;
  b: string;
  kind: string;
  /** 1..100. */
  strength: number;
  since: number;
}

export type MourningOutcome = "aucun" | "refus" | "desertion";

export interface Mourner {
  id: string;
  /** Type du lien avec le défunt ; null : simple camarade d'escouade ou témoin. */
  kind: string | null;
  moraleDelta: number;
  stressDelta: number;
  outcome: MourningOutcome;
}

/** Dossier de mort (02 §9.3 : pas de mort propre). */
export interface DeathFile {
  id: string;
  soldier: string;
  faction: string;
  /** Nom si nommé, sinon null (le matricule est `soldier`). */
  name: string | null;
  named: boolean;
  renown: number;
  rank: string;
  squad: string;
  day: number;
  cause: string;
  place: string;
  circumstances: string;
  witnesses: string[];
  mourners: Mourner[];
  /** Succession ouverte par cette mort (escouade), le cas échéant. */
  succession: string | null;
  /** Stèle où le nom est gravé. */
  inscribed: string | null;
  /** Reprise du dossier politique (`DeathRecord`) si le défunt est un personnage : clés de conséquences déjà appliquées côté politique. */
  political: { divergence: boolean; consequences: string[] } | null;
}

export interface Stele {
  id: string;
  faction: string;
  place: string;
  title: string;
  epitaph: string;
  day: number;
  /** Identifiants des soldats morts gravés, dans l'ordre. */
  inscribed: string[];
}

export interface Succession {
  id: string;
  faction: string;
  squad: string;
  vacated: string;
  rank: string;
  day: number;
  candidates: { id: string; score: number; interested: boolean }[];
  /** Soldat nommé à la tête ; null tant que la succession est ouverte. */
  appointed: string | null;
}

export type RegistryEvent =
  | { type: "enlisted"; day: number; soldier: string; named: boolean }
  | { type: "promoted"; day: number; soldier: string; name: string }
  | { type: "death"; day: number; soldier: string; cause: string; file: string }
  | { type: "refusal"; day: number; soldier: string; until: number }
  | { type: "desertion"; day: number; soldier: string }
  | { type: "missing"; day: number; soldier: string; reason: string }
  | { type: "found"; day: number; soldier: string }
  | { type: "bond"; day: number; a: string; b: string; kind: string }
  | { type: "stele"; day: number; stele: string }
  | { type: "inscribed"; day: number; stele: string; soldier: string }
  | { type: "succession_open"; day: number; succession: string }
  | { type: "appointed"; day: number; succession: string; soldier: string };

export interface RegistryState {
  soldiers: Record<string, Soldier>;
  bonds: Bond[];
  deaths: DeathFile[];
  steles: Stele[];
  successions: Succession[];
  /** Effectifs engagés par faction (jamais décrémenté : vivants + morts + disparus = engagés). */
  enlisted: Record<string, number>;
  events: RegistryEvent[];
  seq: { soldier: number; file: number; stele: number; succession: number };
  /** Dernier jour pour lequel `stepRegistry` a été appliqué (idempotence). */
  lastDay: number;
}

export interface DeathInput {
  soldier: string;
  day: number;
  cause: string;
  place: string;
  circumstances: string;
  /** Soldats présents à la mort (vivants, même faction). */
  witnesses?: string[];
}

export interface MournerLine {
  id: string;
  kind: string | null;
  outcome: MourningOutcome;
}

export interface DeathLine {
  file: string;
  /** Nom si nommé, sinon matricule. */
  label: string;
  named: boolean;
  rank: string;
  squad: string;
  day: number;
  cause: string;
  place: string;
  circumstances: string;
  inscribed: string | null;
}

export interface RosterLine {
  id: string;
  label: string;
  named: boolean;
  rank: string;
  squad: string;
  status: Status;
  morale: number;
  stress: number;
  refusing: boolean;
  renown: number;
}

export interface RegistryView {
  faction: string;
  counts: { enlisted: number; living: number; named: number; generated: number; missing: number; dead: number };
  roster: RosterLine[];
  deaths: DeathLine[];
  steles: { id: string; title: string; place: string; epitaph: string; inscribed: number; capacity: number }[];
  standing: { opinion: number; legitimacy: number; recruitment: number };
}

export class RegistryError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "RegistryError";
  }
}
