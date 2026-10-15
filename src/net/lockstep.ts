import { stateHash } from "../sim/core/canonical";
import { applyCommand } from "../sim/core/commands";
import type { GameState } from "../sim/core/state";
import { applyEnveloped } from "../sim/commands/apply";
import type { World } from "../sim/strategic/world";
import type { Turn } from "./protocol";

export interface TurnReport {
  /** Enveloppes refusées à l'exécution (même résultat chez tous les clients : l'état est identique). */
  rejected: { seq: number; code: string }[];
}

/**
 * Exécute un tour : chaque enveloppe dans l'ordre fixé par l'hôte (un refus n'interrompt pas le tour), puis l'avance du temps.
 * Fonction pure et déterministe ; c'est le SEUL chemin par lequel l'état d'un client change (hôte compris).
 */
export function applyTurn(state: GameState, turn: Turn, world: World): { state: GameState; report: TurnReport } {
  let s = state;
  const rejected: TurnReport["rejected"] = [];
  for (const { seq, env } of turn.envs) {
    try {
      s = applyEnveloped(s, env, undefined, world);
    } catch (e) {
      rejected.push({ seq, code: String((e as Error).message).split(" : ")[0] ?? "command.err" });
    }
  }
  if (turn.advance > 0) s = applyCommand(s, { type: "AdvanceDays", n: turn.advance }, undefined, world);
  return { state: s, report: { rejected } };
}

export const hashOf = (s: GameState): string => stateHash(s);
