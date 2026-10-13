import { canonicalClone, stateHash } from "../core/canonical";
import type { EventBus } from "../core/bus";
import type { SimEvents } from "../core/commands";
import type { GameState } from "../core/state";
import type { World } from "../strategic/world";
import { applyEnveloped } from "./apply";
import type { CommandEnvelope } from "./schema";

/** Journal des enveloppes appliquées (JSON pur) : source du rejeu, des sauvegardes rejouables et, plus tard, du réseau. */
export class EnvelopeJournal {
  private readonly entries: CommandEnvelope[] = [];

  record(env: CommandEnvelope): void {
    this.entries.push(JSON.parse(JSON.stringify(env)) as CommandEnvelope);
  }

  list(): readonly CommandEnvelope[] {
    return this.entries;
  }

  get length(): number {
    return this.entries.length;
  }

  toJSON(): string {
    return JSON.stringify(this.entries);
  }
}

/** Applique et journalise. Une enveloppe refusée n'entre pas au journal. */
export function submit(state: GameState, journal: EnvelopeJournal, env: CommandEnvelope, bus?: EventBus<SimEvents>, world?: World): GameState {
  const next = applyEnveloped(state, env, bus, world);
  journal.record(env);
  return next;
}

/** Rejoue un journal d'enveloppes : même état initial + même journal = même état final. */
export function replayEnvelopes(initial: GameState, envelopes: readonly CommandEnvelope[], world?: World): GameState {
  return envelopes.reduce<GameState>((s, e) => applyEnveloped(s, e, undefined, world), canonicalClone(initial));
}

/** Empreinte hexadécimale de l'état (pour comparer des exécutions). */
export function fingerprint(state: GameState): string {
  return stateHash(state);
}
