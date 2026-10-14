import type { TruthBalance } from "../../data/balance";
import { advanceActs, initActs } from "./acts";
import { createTruthState } from "./dossier";
import type { World } from "../strategic/world";
import type { TruthState } from "./types";

/**
 * Factions suivies par le pilier P6 : celles du monde des nations s'il existe (scn_854), sinon la faction du scénario (bacs à sable).
 * Triées. Pur.
 */
export function truthFactions(world: Pick<World, "nations" | "scenario">): string[] {
  const ids = world.nations ? [...world.nations.factions.keys()] : [world.scenario.faction];
  return [...new Set(ids)].sort();
}

/**
 * État initial du pilier P6 (D-170) : vérité du monde de `truth.json`, aucun dossier, acte de départ des factions d'après l'année
 * du scénario (845 : I, 850 : II, 854 : III). `day` est le jour absolu ; `factions` est trié pour un résultat indépendant de l'ordre. Pur.
 */
export function initTruth(b: TruthBalance, factions: readonly string[], year: number, day: number): TruthState {
  return initActs(createTruthState(b, day), [...factions].sort(), year, b);
}

/**
 * Pas d'un jour du pilier P6 (D-170), en lecture seule sur le reste du monde : chaque faction passe à l'acte suivant si elle en connaît
 * réellement les faits requis (par dossier, jamais par menu). Les attracteurs de canon (`stepAttractors`) ne sont PAS appelés ici : ils
 * modifient la divergence des événements et seront branchés séparément. Idempotent (un acte atteint n'est jamais perdu). Pur.
 */
export function tickTruth(prev: TruthState, b: TruthBalance, factions: readonly string[], day: number): TruthState {
  let s = prev;
  for (const f of [...factions].sort()) s = advanceActs(s, f, day, b);
  return s;
}
