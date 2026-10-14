import type { DoctrineRule, GhostBook } from "./types";
import { emptyGhostBook } from "./ghost";

/**
 * État du pilier P4 (D-172) : fantômes d'information par faction observatrice (aucune fuite entre factions : clé = observateur) et
 * doctrines programmées par faction (table de règles validée par `validateDoctrine`). Les signaux, relais et brouillards sont
 * des calculs de bataille (temps en secondes) : aucune dynamique quotidienne, donc pas de pas de tick. Données JSON pures.
 */
export interface SignalState {
  ghosts: GhostBook;
  doctrines: Record<string, DoctrineRule[]>;
}

export const initSignal = (): SignalState => ({ ghosts: emptyGhostBook(), doctrines: {} });

/** Doctrine d'une faction (table vide si aucune n'est programmée). Pur. */
export const doctrineOf = (s: SignalState, faction: string): readonly DoctrineRule[] => s.doctrines[faction] ?? [];

/** Nouvel état avec la doctrine de `faction` remplacée (l'état d'origine n'est pas modifié). Pur ; la validation est à l'appelant. */
export const withDoctrine = (s: SignalState, faction: string, rules: readonly DoctrineRule[]): SignalState => ({
  ...s,
  doctrines: { ...s.doctrines, [faction]: rules.map((r) => structuredClone(r)) },
});

/** Nouvel état avec le carnet de fantômes remplacé. Pur. */
export const withGhosts = (s: SignalState, ghosts: GhostBook): SignalState => ({ ...s, ghosts });
