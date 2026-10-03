import type { EventBus } from "./bus";
import { tickDay } from "./state";
import type { GameState } from "./state";
import type { GameDate } from "./time";
import { RATIONING_LEVELS } from "../strategic/resources";
import type { RationingLevel } from "../strategic/resources";
import type { World } from "../strategic/world";

export const MAX_ADVANCE_DAYS = 3650;

export type Command =
  | { type: "AdvanceDays"; n: number }
  | { type: "SetFlag"; key: string; value: boolean }
  | { type: "SetRationing"; level: RationingLevel }
  | { type: "Noop" };

export type Validation = { ok: true } | { ok: false; error: string };

/** Événements publiés par la simulation (l'UI s'y abonne ; elle ne modifie jamais l'état directement). */
export interface SimEvents {
  commandApplied: { index: number; command: Command };
  commandRejected: { command: unknown; error: string };
  dayAdvanced: { date: GameDate };
  flagSet: { key: string; value: boolean };
}

const FLAG_KEY = /^[a-z0-9_.:-]{1,64}$/;

/** Validation défensive : les commandes peuvent venir de l'UI, d'un Worker ou d'un fichier. */
export function validateCommand(cmd: unknown): Validation {
  if (typeof cmd !== "object" || cmd === null || !("type" in cmd)) return { ok: false, error: "commande sans type" };
  const c = cmd as Record<string, unknown>;
  switch (c["type"]) {
    case "AdvanceDays": {
      const n = c["n"];
      if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > MAX_ADVANCE_DAYS) {
        return { ok: false, error: `AdvanceDays.n doit être un entier entre 1 et ${MAX_ADVANCE_DAYS} (reçu ${String(n)})` };
      }
      return { ok: true };
    }
    case "SetFlag": {
      if (typeof c["key"] !== "string" || !FLAG_KEY.test(c["key"])) return { ok: false, error: "SetFlag.key invalide" };
      if (typeof c["value"] !== "boolean") return { ok: false, error: "SetFlag.value doit être un booléen" };
      return { ok: true };
    }
    case "SetRationing":
      if (typeof c["level"] !== "string" || !(RATIONING_LEVELS as readonly string[]).includes(c["level"])) {
        return { ok: false, error: `SetRationing.level doit valoir ${RATIONING_LEVELS.join(", ")}` };
      }
      return { ok: true };
    case "Noop":
      return { ok: true };
    default:
      return { ok: false, error: `type de commande inconnu : ${String(c["type"])}` };
  }
}

/** Applique une commande validée ; renvoie un nouvel état (l'état d'entrée n'est pas modifié). */
export function applyCommand(state: GameState, cmd: Command, bus?: EventBus<SimEvents>, world?: World): GameState {
  const v = validateCommand(cmd);
  if (!v.ok) {
    bus?.emit("commandRejected", { command: cmd, error: v.error });
    throw new Error(`Commande rejetée : ${v.error}`);
  }
  let next = state;
  switch (cmd.type) {
    case "AdvanceDays":
      for (let i = 0; i < cmd.n; i++) {
        next = tickDay(next, world);
        bus?.emit("dayAdvanced", { date: next.date });
      }
      break;
    case "SetFlag":
      next = { ...next, world: { ...next.world, flags: { ...next.world.flags, [cmd.key]: cmd.value } } };
      bus?.emit("flagSet", { key: cmd.key, value: cmd.value });
      break;
    case "SetRationing":
      if (!next.strategic) throw new Error("SetRationing : aucune partie stratégique chargée");
      next = { ...next, strategic: { ...next.strategic, rationing: cmd.level } };
      break;
    case "Noop":
      break;
  }
  next = { ...next, commandIndex: next.commandIndex + 1 };
  bus?.emit("commandApplied", { index: next.commandIndex, command: cmd });
  return next;
}

/** Journal des commandes appliquées : source des replays et des sauvegardes rejouables. */
export class CommandJournal {
  private readonly entries: Command[] = [];

  record(cmd: Command): void {
    this.entries.push(structuredClone(cmd));
  }

  list(): readonly Command[] {
    return this.entries;
  }

  get length(): number {
    return this.entries.length;
  }
}

/** Rejoue un journal depuis un état initial : même état initial + mêmes commandes = même état final. */
export function replay(initial: GameState, commands: readonly Command[], world?: World): GameState {
  return commands.reduce<GameState>((s, c) => applyCommand(s, c, undefined, world), initial);
}
