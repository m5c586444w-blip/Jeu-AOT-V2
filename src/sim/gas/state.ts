import type { AnchorLedger } from "./types";
import { createLedger } from "./anchors";

/**
 * État du pilier P3 (D-171) : un registre de pertes d'ancrage par carte tactique (`mapId`), séparé de la carte elle-même (la carte reste
 * une donnée immuable). Le registre ne change que par la bataille (destruction d'ancrages) : aucune dynamique quotidienne, donc pas de
 * pas de tick. Données JSON pures.
 */
export interface GasState {
  ledgers: Record<string, AnchorLedger>;
}

export const initGas = (): GasState => ({ ledgers: {} });

/** Registre d'une carte (vide si la carte n'a jamais été touchée). Pur. */
export const ledgerOf = (s: GasState, mapId: string): AnchorLedger => s.ledgers[mapId] ?? createLedger();

/** Nouvel état avec le registre de `mapId` remplacé (l'état d'origine n'est pas modifié). Pur. */
export const withLedger = (s: GasState, mapId: string, ledger: AnchorLedger): GasState => ({ ledgers: { ...s.ledgers, [mapId]: ledger } });
