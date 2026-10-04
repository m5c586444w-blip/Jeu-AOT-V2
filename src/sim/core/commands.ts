import type { EventBus } from "./bus";
import { canonicalClone } from "./canonical";
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
import { launchExpedition, recallExpedition, resolveBattle } from "../military/expedition";
import type { TimedOrder } from "../tactical/types";
import { TACTICAL_ORDERS } from "../tactical/types";
import type { MilCtx } from "../military/expedition";
import { sendConvoy } from "../military/logistics";
import type { ConvoyOrder } from "../military/logistics";
import type { ExpeditionPlan } from "../military/state";
import { FORMATIONS, OBJECTIVES } from "../military/vocabulary";
import { chooseOption } from "../events/engine";
import { assignAgent, assignProblem, INTEL_OPS, recallAgent, recruitAgent, recruitProblem } from "../intel/intel";
import type { IntelOp } from "../intel/intel";
import { lockOf, techMods } from "../research/research";
import { inherit, retireProblem } from "../shifters/shifters";
import { buildProblem, moveForces, moveProblem, orderBuild } from "../world/nations";
import { projectProblem, projectTitan, recallTitan } from "../world/war";
import { toAbsoluteDay } from "./time";

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
  | { type: "LaunchExpedition"; plan: ExpeditionPlan }
  | { type: "RecallExpedition"; expedition: string }
  | { type: "SendConvoy"; order: ConvoyOrder }
  | { type: "ResolveBattle"; expedition: string; mode: "jouer" | "auto"; orders: TimedOrder[] }
  | { type: "ChooseEventOption"; event: string; choice: string }
  | { type: "SetResearch"; tech: string | null }
  | { type: "RecruitAgent" }
  | { type: "AssignAgent"; agent: string; op: IntelOp; target: string }
  | { type: "RecallAgent"; agent: string }
  | { type: "InheritTitan"; shifter: string; heir: string }
  | { type: "RetireShifter"; shifter: string; retired: boolean }
  | { type: "SetPlayerFaction"; faction: string }
  | { type: "BuildFormation"; formation: string; province: string; count: number }
  | { type: "MoveFormation"; formation: string; from: string; to: string; count: number }
  | { type: "ProjectTitan"; shifter: string; province: string }
  | { type: "RecallTitan"; shifter: string }
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
    case "LaunchExpedition":
      return validPlanShape(c["plan"]) ? { ok: true } : { ok: false, error: "LaunchExpedition.plan invalide" };
    case "RecallExpedition":
      return typeof c["expedition"] === "string" && /^exp_\d+$/.test(c["expedition"]) ? { ok: true } : { ok: false, error: "RecallExpedition.expedition invalide" };
    case "ResolveBattle": {
      const orders = c["orders"];
      const okOrders =
        Array.isArray(orders) &&
        orders.every((o) => typeof o === "object" && o !== null && Number.isInteger((o as Record<string, unknown>)["tick"]) && typeof (o as Record<string, unknown>)["squad"] === "string" && (TACTICAL_ORDERS as readonly string[]).includes(String((o as Record<string, unknown>)["order"])));
      const ok = typeof c["expedition"] === "string" && (c["mode"] === "jouer" || c["mode"] === "auto") && okOrders;
      return ok ? { ok: true } : { ok: false, error: "ResolveBattle invalide" };
    }
    case "SendConvoy": {
      const o = c["order"] as Record<string, unknown> | undefined;
      const ok = !!o && typeof o["depot"] === "string" && validSupplies(o["cargo"]) && Number.isInteger(o["wagons"]) && Number.isInteger(o["escort"]);
      return ok ? { ok: true } : { ok: false, error: "SendConvoy.order invalide" };
    }
    case "ChooseEventOption":
      return typeof c["event"] === "string" && typeof c["choice"] === "string" ? { ok: true } : { ok: false, error: "ChooseEventOption invalide" };
    case "SetResearch":
      return c["tech"] === null || typeof c["tech"] === "string" ? { ok: true } : { ok: false, error: "SetResearch.tech invalide" };
    case "RecruitAgent":
      return { ok: true };
    case "AssignAgent":
      return typeof c["agent"] === "string" && typeof c["target"] === "string" && (INTEL_OPS as readonly string[]).includes(String(c["op"])) ? { ok: true } : { ok: false, error: "AssignAgent invalide" };
    case "RecallAgent":
      return typeof c["agent"] === "string" ? { ok: true } : { ok: false, error: "RecallAgent invalide" };
    case "InheritTitan":
      return typeof c["shifter"] === "string" && typeof c["heir"] === "string" ? { ok: true } : { ok: false, error: "InheritTitan invalide" };
    case "RetireShifter":
      return typeof c["shifter"] === "string" && typeof c["retired"] === "boolean" ? { ok: true } : { ok: false, error: "RetireShifter invalide" };
    case "SetPlayerFaction":
      return typeof c["faction"] === "string" ? { ok: true } : { ok: false, error: "SetPlayerFaction invalide" };
    case "BuildFormation":
      return typeof c["formation"] === "string" && typeof c["province"] === "string" && Number.isInteger(c["count"]) ? { ok: true } : { ok: false, error: "BuildFormation invalide" };
    case "MoveFormation":
      return typeof c["formation"] === "string" && typeof c["from"] === "string" && typeof c["to"] === "string" && Number.isInteger(c["count"]) ? { ok: true } : { ok: false, error: "MoveFormation invalide" };
    case "ProjectTitan":
      return typeof c["shifter"] === "string" && typeof c["province"] === "string" ? { ok: true } : { ok: false, error: "ProjectTitan invalide" };
    case "RecallTitan":
      return typeof c["shifter"] === "string" ? { ok: true } : { ok: false, error: "RecallTitan invalide" };
    case "Noop":
      return { ok: true };
    default:
      return { ok: false, error: `type de commande inconnu : ${String(c["type"])}` };
  }
}

function validSupplies(x: unknown): boolean {
  if (typeof x !== "object" || x === null) return false;
  const s = x as Record<string, unknown>;
  return ["food", "gas", "steel"].every((k) => typeof s[k] === "number" && Number.isFinite(s[k]) && (s[k] as number) >= 0);
}

/** Forme d'un plan (le fond — itinéraire, effectifs, stocks — est vérifié par planProblem à l'application). */
function validPlanShape(x: unknown): boolean {
  if (typeof x !== "object" || x === null) return false;
  const p = x as Record<string, unknown>;
  const strList = (v: unknown): boolean => Array.isArray(v) && v.every((s) => typeof s === "string");
  const r = p["retreat"] as Record<string, unknown> | undefined;
  return (
    typeof p["objective"] === "string" &&
    (OBJECTIVES as readonly string[]).includes(p["objective"]) &&
    typeof p["formation"] === "string" &&
    (FORMATIONS as readonly string[]).includes(p["formation"]) &&
    strList(p["route"]) &&
    strList(p["squads"]) &&
    strList(p["officers"]) &&
    Number.isInteger(p["horses"]) &&
    Number.isInteger(p["wagons"]) &&
    validSupplies(p["supplies"]) &&
    validSupplies(p["depotCargo"]) &&
    !!r &&
    ["losses_pct", "gas_pct", "abnormal", "max_days"].every((k) => typeof r[k] === "number") &&
    (p["play"] === undefined || typeof p["play"] === "boolean")
  );
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
    case "LaunchExpedition":
    case "RecallExpedition":
    case "SendConvoy":
    case "ResolveBattle":
      next = applyMilitary(next, cmd, world);
      break;
    case "ChooseEventOption":
    case "SetResearch":
    case "RecruitAgent":
    case "AssignAgent":
    case "RecallAgent":
      next = applyP5(next, cmd, world);
      break;
    case "InheritTitan":
    case "RetireShifter":
      next = applyP6(next, cmd, world);
      break;
    case "SetPlayerFaction":
    case "BuildFormation":
    case "MoveFormation":
    case "ProjectTitan":
    case "RecallTitan":
      next = applyP7(next, cmd, world);
      break;
    case "Noop":
      break;
  }
  // Forme canonique après chaque commande (D-66) : l'état vivant est identique à l'état relu d'une sauvegarde.
  next = canonicalClone({ ...next, commandIndex: next.commandIndex + 1 });
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

type MilitaryCommand = Extract<Command, { type: "LaunchExpedition" | "RecallExpedition" | "SendConvoy" | "ResolveBattle" }>;

/** Commandes de la couche militaire (P3) : copies de travail, puis nouvel état. */
function applyMilitary(state: GameState, cmd: MilitaryCommand, world?: World): GameState {
  if (!world?.military || !state.military || !state.strategic) throw new Error(`${cmd.type} : aucune couche militaire chargée`);
  const ctx: MilCtx = {
    world,
    m: world.military,
    seed: state.seed,
    date: state.date,
    st: structuredClone(state.strategic),
    pol: state.politics ? structuredClone(state.politics) : null,
    mil: structuredClone(state.military),
    tech: techMods(world, state.research),
  };
  if (cmd.type === "LaunchExpedition" && cmd.plan.objective === "capture" && !ctx.tech?.capture) throw new Error("plan.capture_locked");
  if (cmd.type === "LaunchExpedition") launchExpedition(ctx, cmd.plan);
  else if (cmd.type === "RecallExpedition") recallExpedition(ctx, cmd.expedition);
  else if (cmd.type === "ResolveBattle") resolveBattle(ctx, cmd.expedition, cmd.mode, cmd.orders);
  else sendConvoy(ctx, cmd.order);
  return { ...state, strategic: ctx.st, politics: ctx.pol, military: ctx.mil };
}

type P5Command = Extract<Command, { type: "ChooseEventOption" | "SetResearch" | "RecruitAgent" | "AssignAgent" | "RecallAgent" }>;

/** Commandes de P5 : événements, recherche, renseignement. Erreur explicite si la commande n'est pas recevable. */
function applyP5(state: GameState, cmd: P5Command, world?: World): GameState {
  if (!world || !state.strategic) throw new Error(`${cmd.type} : aucune partie chargée`);
  const day = toAbsoluteDay(state.date);
  switch (cmd.type) {
    case "ChooseEventOption": {
      if (!state.events) throw new Error("ChooseEventOption : aucun moteur d'événements");
      const ctx = { world, seed: state.seed, date: state.date, st: structuredClone(state.strategic), pol: state.politics ? structuredClone(state.politics) : null, mil: state.military, rs: state.research ? structuredClone(state.research) : null, intel: state.intel ? structuredClone(state.intel) : null, ev: structuredClone(state.events), sh: state.shifters ? structuredClone(state.shifters) : null };
      chooseOption(ctx, cmd.event, cmd.choice);
      return { ...state, strategic: ctx.st, politics: ctx.pol, research: ctx.rs, intel: ctx.intel, events: ctx.ev, shifters: ctx.sh };
    }
    case "SetResearch": {
      const rs = state.research;
      if (!rs || !world.research) throw new Error("SetResearch : aucune recherche");
      if (cmd.tech === null) return { ...state, research: { ...rs, current: null, bank: rs.bank + rs.progress, progress: 0 } };
      const t = world.research.techs.get(cmd.tech);
      if (!t) throw new Error(`SetResearch : technologie inconnue ${cmd.tech}`);
      const history = state.events?.history ?? {};
      const lock = lockOf(world, rs, t, state.date, (id) => history[id]?.status === "survenu" || history[id]?.status === "passe", (id) => state.politics?.characters[id]?.alive ?? false);
      if (lock) throw new Error(lock.key);
      // Changer de sujet met l'avancement en réserve : rien n'est perdu, rien n'est doublé.
      const bank = rs.current && rs.current !== cmd.tech ? rs.bank + rs.progress : rs.bank;
      return { ...state, research: { ...rs, current: cmd.tech, progress: rs.current === cmd.tech ? rs.progress : 0, bank } };
    }
    case "RecruitAgent": {
      if (!state.intel || !state.politics) throw new Error("RecruitAgent : aucun renseignement");
      const problem = recruitProblem(world, state.intel, state.politics, state.research);
      if (problem) throw new Error(problem);
      const intel = structuredClone(state.intel);
      const politics = structuredClone(state.politics);
      recruitAgent(world, state.seed, intel, politics, day);
      return { ...state, intel, politics };
    }
    case "AssignAgent": {
      if (!state.intel) throw new Error("AssignAgent : aucun renseignement");
      const problem = assignProblem(world, state.intel, cmd.agent, cmd.op, cmd.target);
      if (problem) throw new Error(problem);
      const intel = structuredClone(state.intel);
      assignAgent(world, intel, cmd.agent, cmd.op, cmd.target, day);
      return { ...state, intel };
    }
    case "RecallAgent": {
      if (!state.intel) throw new Error("RecallAgent : aucun renseignement");
      const intel = structuredClone(state.intel);
      recallAgent(intel, cmd.agent);
      return { ...state, intel };
    }
  }
}

type P6Command = Extract<Command, { type: "InheritTitan" | "RetireShifter" }>;

/** Commandes de P6 : héritage préparé (F-TIT-05) et retrait du service (F-TIT-20). */
function applyP6(state: GameState, cmd: P6Command, world?: World): GameState {
  if (!world?.shifters || !state.shifters || !state.strategic) throw new Error(`${cmd.type} : aucun Titan-porteur`);
  const sh = structuredClone(state.shifters);
  if (cmd.type === "RetireShifter") {
    const problem = retireProblem(sh, state.politics, cmd.shifter);
    if (problem) throw new Error(problem);
    const slot = sh.titans[cmd.shifter];
    if (slot) slot.retired = cmd.retired;
    return { ...state, shifters: sh };
  }
  const ctx = { world, seed: state.seed, date: state.date, st: structuredClone(state.strategic), pol: state.politics ? structuredClone(state.politics) : null, intel: state.intel, sh, flags: state.events?.flags ?? {} };
  const problem = inherit(ctx, cmd.shifter, cmd.heir, "shifter.inherit_command", "A");
  if (problem) throw new Error(problem);
  return { ...state, strategic: ctx.st, politics: ctx.pol, shifters: ctx.sh };
}

type P7Command = Extract<Command, { type: "SetPlayerFaction" | "BuildFormation" | "MoveFormation" | "ProjectTitan" | "RecallTitan" }>;

/** Commandes de P7 : choix de la nation jouée (au départ seulement), levées et mouvements de formations. */
function applyP7(state: GameState, cmd: P7Command, world?: World): GameState {
  if (!world?.nations || !state.nations) throw new Error(`${cmd.type} : aucun monde des nations`);
  const ns = structuredClone(state.nations);
  if (cmd.type === "SetPlayerFaction") {
    if (!(world.scenario.world?.playable ?? []).includes(cmd.faction)) throw new Error("world.err.not_playable");
    if (state.date.year !== world.scenario.start.year || state.date.day !== world.scenario.start.day) throw new Error("world.err.too_late");
    ns.player = cmd.faction;
    return { ...state, nations: ns };
  }
  if (cmd.type === "BuildFormation") {
    const problem = buildProblem(world, ns, ns.player, cmd.formation, cmd.province, cmd.count);
    if (problem) throw new Error(problem);
    orderBuild(world, ns, ns.player, cmd.formation, cmd.province, cmd.count, state.date);
    return { ...state, nations: ns };
  }
  if (cmd.type === "ProjectTitan") {
    const problem = projectProblem(world, ns, state.shifters, state.politics, ns.player, cmd.shifter, cmd.province, state.date);
    if (problem) throw new Error(problem);
    const pol = state.politics ? structuredClone(state.politics) : null;
    projectTitan(world, ns, pol, ns.player, cmd.shifter, cmd.province, state.date);
    return { ...state, nations: ns, politics: pol };
  }
  if (cmd.type === "RecallTitan") {
    if (!recallTitan(ns, cmd.shifter, state.date)) throw new Error("world.err.titan_not_engaged");
    return { ...state, nations: ns };
  }
  const problem = moveProblem(world, ns, ns.player, cmd.formation, cmd.from, cmd.to, cmd.count);
  if (problem) throw new Error(problem);
  moveForces(world, ns, cmd.formation, cmd.from, cmd.to, cmd.count);
  return { ...state, nations: ns };
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
