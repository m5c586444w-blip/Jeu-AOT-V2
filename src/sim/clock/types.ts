/** Preuve de l'identité d'un porteur : clés de `clock.json › suspicion.evidence`. */
export type EvidenceKind = string;

export type SuspicionLevel = "aucun" | "soupcon" | "fort";

/** Porteur suivi par l'Horloge (P5) : un personnage, ses facteurs de contrôle, sa couverture. Un personnage peut tenir plusieurs Titans (Eren). */
export interface Bearer {
  /** Personnage porteur. */
  id: string;
  /** Faction du porteur (elle connaît toujours son identité). */
  faction: string;
  /** Rôle de couverture : clé de `cover.initial` (infiltre, civil, connu). */
  role: string;
  /** Couverture 0..100 : plus elle est haute, moins les preuves portent. */
  cover: number;
  /** Volonté, stress, liens : 0..100. */
  will: number;
  stress: number;
  bonds: number;
  /** Convictions : ordre général → alignement [-1, 1] (1 : conforme, -1 : contraire). Absent = indifférent. */
  convictions: Record<string, number>;
  /** Années d'usure accumulées par les projections (arbitrage de roster, `roster.ts`). */
  wearYears: number;
  /** Factions qui connaissent son identité (triées ; contient sa propre faction). */
  exposedTo: string[];
}

/** Suspicion d'un observateur envers un personnage (porteur ou innocent : l'observateur ne le sait pas). */
export interface SuspectRecord {
  value: number;
  lastEvidenceDay: number;
  /** Clos : démasquage ou fausse accusation déjà déclenché(e) ; plus aucune preuve n'est retenue. */
  closed: boolean;
}

export interface ClockState {
  bearers: Record<string, Bearer>;
  /** cible → observateur → suspicion. */
  suspects: Record<string, Record<string, SuspectRecord>>;
  /** Événements déclenchés, du plus ancien au plus récent. */
  events: ClockEvent[];
}

export type ClockEvent =
  | { type: "unmasked"; day: number; bearer: string; observer: string }
  | { type: "false_accusation"; day: number; target: string; observer: string };

export interface BearerInput {
  id: string;
  faction: string;
  role: string;
  will: number;
  stress: number;
  bonds: number;
  convictions?: Record<string, number>;
}

export type GeneralAction =
  | { kind: "order"; order: string }
  | { kind: "own"; ability: string }
  | { kind: "ignore"; order: string };

export interface TransformInput {
  control: number;
  handsBound: boolean;
  surprised: boolean;
  endurance: number;
  cooldownS: number;
}

export interface TransformGate {
  ok: boolean;
  /** Clé de message d'erreur si refusé. */
  reason: string | null;
  /** Délai de transformation en secondes (si accepté). */
  delayS: number;
}

export type ExtractionOutcome = "capture" | "mort" | "fuite";

export interface ExtractionOdds {
  kill: number;
  capture: number;
  escape: number;
}

export interface RosterEntry {
  bearer: string;
  titans: string[];
  yearsLeft: number;
  effectiveYears: number;
  exhausted: boolean;
  advice: "utiliser" | "garder";
}

/** Vue d'une faction (ou d'un siège) : jamais d'identité inconnue ni de valeur exacte de suspicion adverse. */
export interface ClockView {
  faction: string;
  /** Porteurs que la faction connaît (les siens, les démasqués). */
  known: { id: string; titans: string[]; own: boolean; cover: number | null; yearsLeft: number | null }[];
  /** Personnages que la faction soupçonne (porteurs ou non : indiscernable), niveau grossier seulement. */
  suspects: { character: string; level: SuspicionLevel }[];
}
