import type { RegistryBalance } from "../../data/balance";
import { Rng } from "../core/rng";
import { createRegistry, stepRegistry } from "./troop";
import type { RegistryState } from "./types";

/**
 * État initial du pilier P7 (D-166). Le monde ne fournit pas d'individus (les unités de données sont des types, pas des soldats) :
 * le registre démarre vide ; la troupe y entre par `enlistNamed` / `enlistGenerated` ou à la mort d'un personnage. Pur.
 */
export function initRegistry(): RegistryState {
  return createRegistry();
}

/**
 * Pas de tick du pilier P7 : un jour (récupération du moral et du stress, fin des refus, liens, promotions ; le deuil naît des
 * dossiers de mort déjà enregistrés). `day` est le jour absolu ; idempotent par `lastDay`. Pur ; l'aléa vient de forks de la graine.
 */
export function tickRegistry(prev: RegistryState, b: RegistryBalance, seed: number, day: number): RegistryState {
  return stepRegistry(prev, day, new Rng(seed), b);
}
