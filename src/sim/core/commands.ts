import type { EventBus } from "./bus";
import { tickDay } from "./state";
import type { GameState } from "./state";
import type { GameDate } from "./time";
import { RATIONING_LEVELS } from "../strategic/resources";
import type { RationingLevel } from "../strategic/resources";
import type { World } from "../strategic/world";
import { acceptProposal, rejectProposal } from "../politics/advisors";
import { characterDies, DEATH_CAUSES, nominate } from "../politics/characters";
import type { DeathCause } from "../politics/characters";
import { enactLaw, persuade, repealLaw, setBudget } from "../politics/politics";

export const MAX_ADVANCE_DAYS = 3650;

export type Command =
  | { type: "AdvanceDays"; n: number }
  | { type: "SetFlag"; key: string; value: boolean }
  | { type: "SetRationing"; level: RationingLevel }
  | { type: "EnactLaw"; law: string; override?: boolean }
  | { type: "RepealLaw"; law: string }
  | { type: "Persuade"; character: string }
  | { type: "SetBudget"; shares: Record<string, number> }
  | { type: "CharacterDies"; character: string; cause: DeathCause; circumstances?: string }
  | { type: "Nominate"; nomination: number; candidate: string }
  | { type: "AcceptProposal"; proposal: number }
  | { type: "RejectProposal"; proposal: number }
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
    case "EnactLaw":
    case "RepealLaw":
      return typeof c["law"] === "string" && /^law_[a-z0-9_]+$/.test(c["law"]) ? { ok: true } : { ok: false, error: `${String(c["type"])}.law invalide` };
    case "Persuade":
      return typeof c["character"] === "string" && /^char_[a-z0-9_]+$/.test(c["character"]) ? { ok: true } : { ok: false, error: "Persuade.character invalide" };
    case "SetBudget": {
      const sh = c["shares"];
      const valid = typeof sh === "object" && sh !== null && Object.entries(sh).every(([k, v]) => /^org_[a-z_]+$/.test(k) && typeof v === "number" && Number.isFinite(v) && v >= 0);
      return valid ? { ok: true } : { ok: false, error: "SetBudget.shares invalide" };
    }
    case "CharacterDies":
      if (typeof c["character"] !== "string" || !/^char_[a-z0-9_]+$/.test(c["character"])) return { ok: false, error: "CharacterDies.character invalide" };
      if (typeof c["cause"] !== "string" || !(DEATH_CAUSES as readonly string[]).includes(c["cause"])) return { ok: false, error: `CharacterDies.cause doit valoir ${DEATH_CAUSES.join(", ")}` };
      return { ok: true };
    case "Nominate":
      return Number.isInteger(c["nomination"]) && typeof c["candidate"] === "string" ? { ok: true } : { ok: false, error: "Nominate invalide" };
    case "AcceptProposal":
    case "RejectProposal":
      return Number.isInteger(c["proposal"]) ? { ok: true } : { ok: false, error: `${String(c["type"])}.proposal invalide` };
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
    case "EnactLaw":
    case "RepealLaw":
    case "Persuade":
    case "SetBudget":
    case "CharacterDies":
    case "Nominate":
    case "AcceptProposal":
    case "RejectProposal":
      next = applyPolitical(next, cmd, world);
      break;
    case "Noop":
      break;
  }
  next = { ...next, commandIndex: next.commandIndex + 1 };
  bus?.emit("commandApplied", { index: next.commandIndex, command: cmd });
  return next;
}

type PoliticalCommand = Extract<Command, { type: "EnactLaw" | "RepealLaw" | "Persuade" | "SetBudget" | "CharacterDies" | "Nominate" | "AcceptProposal" | "RejectProposal" }>;

/** Commandes de la couche politique (P2) : elles exigent un monde et un état politique. */
function applyPolitical(state: GameState, cmd: PoliticalCommand, world?: World): GameState {
  const pol = state.politics;
  const st = state.strategic;
  if (!world || !pol || !st) throw new Error(`${cmd.type} : aucune partie politique chargée`);
  const date = state.date;
  switch (cmd.type) {
    case "EnactLaw": {
      const r = enactLaw(world, pol, st, date, cmd.law, cmd.override ?? false);
      return { ...state, politics: r.state, strategic: r.strategic };
    }
    case "RepealLaw": {
      const r = repealLaw(world, pol, st, date, cmd.law);
      return { ...state, politics: r.state, strategic: r.strategic };
    }
    case "Persuade":
      return { ...state, politics: persuade(world, pol, cmd.character) };
    case "SetBudget":
      return { ...state, politics: setBudget(world, pol, cmd.shares) };
    case "CharacterDies": {
      const r = characterDies(world, pol, st, date, cmd.character, cmd.cause, cmd.circumstances ?? "death.circumstances.unknown");
      return { ...state, politics: r.state, strategic: r.strategic };
    }
    case "Nominate": {
      const r = nominate(world, pol, st, date, cmd.nomination, cmd.candidate);
      return { ...state, politics: r.state, strategic: r.strategic };
    }
    case "AcceptProposal": {
      const r = acceptProposal(world, pol, st, date, cmd.proposal);
      return { ...state, politics: r.state, strategic: r.strategic };
    }
    case "RejectProposal": {
      const r = rejectProposal(world, pol, st, date, cmd.proposal);
      return { ...state, politics: r.state, strategic: r.strategic };
    }
  }
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
