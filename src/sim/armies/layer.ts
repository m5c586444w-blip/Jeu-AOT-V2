import type { GameState } from "../core/state";
import type { GameDate } from "../core/time";
import type { EventsState } from "../events/engine";
import type { PoliticalState } from "../politics/state";
import type { ResearchState } from "../research/research";
import type { StrategicState } from "../strategic/economy";
import type { World } from "../strategic/world";
import type { TimedOrder } from "../tactical/types";
import type { NationsState } from "../world/nations";
import { dailyArmyAi } from "./ai";
import { applyOrder, dailyArmies, orderProblem, resolveEncounter, canPlay } from "./armies";
import type { ArmyCtx, ArmyOrder } from "./armies";
import { armiesWorld, createArmiesState, playerOf } from "./state";
import type { ArmiesState } from "./state";
import { chooseSuccessor, dailySuccession, successorProblem } from "./succession";

/** Commandes de PA (journalisées, rejouables). */
export type ArmyCommand =
  | { type: "RaiseArmies" }
  | ArmyOrder
  | { type: "ResolveEncounter"; encounter: string; mode: "auto" | "jouer" | "retraite"; orders: TimedOrder[] }
  | { type: "ChooseSuccessor"; candidate: string };

export const ARMY_COMMANDS = ["RaiseArmies", "ArmyMove", "ArmyHalt", "ArmyForcedMarch", "ArmyIntercept", "ArmyRetreat", "ArmyMerge", "ArmySplit", "ArmySetGeneral", "ArmyGarrison", "FleetMove", "FleetMission", "FleetEmbark", "FleetLand", "ResolveEncounter", "ChooseSuccessor"] as const;

interface Parts {
  st: StrategicState;
  pol: PoliticalState | null;
  ns: NationsState | null;
  research: ResearchState | null;
  events: EventsState | null;
  armies: ArmiesState;
}

function ctxOf(world: World, seed: number, date: GameDate, p: Parts): ArmyCtx {
  return {
    world,
    aw: armiesWorld(world),
    seed,
    date,
    s: structuredClone(p.armies),
    st: structuredClone(p.st),
    pol: p.pol ? structuredClone(p.pol) : null,
    ns: p.ns ? structuredClone(p.ns) : null,
    research: p.research,
    events: p.events,
  };
}

/** Jour des armées (appelé par `tickDay` quand la couche existe) : succession, marche, rencontres, IA. */
export function tickArmies(world: World, seed: number, date: GameDate, p: Parts): { st: StrategicState; pol: PoliticalState | null; ns: NationsState | null; armies: ArmiesState } {
  const ctx = ctxOf(world, seed, date, p);
  dailySuccession(ctx);
  dailyArmies(ctx);
  dailyArmyAi(ctx);
  return { st: ctx.st, pol: ctx.pol, ns: ctx.ns, armies: ctx.s };
}

/** Applique une commande de PA à l'état ; erreur explicite (clé i18n) si elle n'est pas recevable. */
export function applyArmyCommand(state: GameState, cmd: ArmyCommand, world?: World): GameState {
  if (!world?.armies || !state.strategic) throw new Error("army.err.no_layer");
  if (cmd.type === "RaiseArmies") {
    if (state.armies) throw new Error("army.err.already_raised");
    const armies = createArmiesState(world, state.date);
    return armies ? { ...state, armies } : state;
  }
  if (!state.armies) throw new Error("army.err.no_layer");
  const ctx = ctxOf(world, state.seed, state.date, { st: state.strategic, pol: state.politics, ns: state.nations, research: state.research, events: state.events, armies: state.armies });
  const player = playerOf(ctx.ns);
  if (cmd.type === "ResolveEncounter") {
    const enc = ctx.s.encounters.find((e) => e.id === cmd.encounter);
    if (!enc || enc.status !== "attente" || !enc.sides.some((x) => x.faction === player)) throw new Error("army.err.no_encounter");
    if (cmd.mode === "jouer" && !canPlay(ctx, enc)) throw new Error("army.err.cannot_play");
    resolveEncounter(ctx, cmd.encounter, cmd.mode, cmd.orders);
  } else if (cmd.type === "ChooseSuccessor") {
    const problem = successorProblem(ctx, cmd.candidate);
    if (problem) throw new Error(problem);
    chooseSuccessor(ctx, cmd.candidate);
  } else {
    const problem = orderProblem(ctx, player, cmd);
    if (problem) throw new Error(problem);
    applyOrder(ctx, cmd);
  }
  return { ...state, strategic: ctx.st, politics: ctx.pol, nations: ctx.ns, armies: ctx.s };
}

/** Forme d'une commande de PA (le fond est vérifié à l'application). */
export function validArmyCommand(c: Record<string, unknown>): boolean {
  const s = (k: string): boolean => typeof c[k] === "string";
  switch (c["type"]) {
    case "RaiseArmies":
      return true;
    case "ArmyMove":
      return s("army") && s("to");
    case "ArmyHalt":
    case "ArmyRetreat":
      return s("army");
    case "ArmyForcedMarch":
      return s("army") && typeof c["on"] === "boolean";
    case "ArmyIntercept":
      return s("army") && s("target");
    case "ArmyMerge":
      return s("army") && s("into");
    case "ArmySplit":
      return s("army") && (c["general"] === null || s("general")) && Array.isArray(c["regiments"]) && (c["regiments"] as unknown[]).every((r) => typeof r === "object" && r !== null && typeof (r as Record<string, unknown>)["regiment"] === "string" && Number.isInteger((r as Record<string, unknown>)["count"]));
    case "ArmySetGeneral":
      return s("army") && (c["general"] === null || s("general"));
    case "ArmyGarrison":
      return s("army") && (c["mode"] === "deposer" || c["mode"] === "prelever") && Number.isInteger(c["soldiers"]);
    case "FleetMove":
      return s("fleet") && s("to");
    case "FleetMission":
      return s("fleet") && ["patrouille", "blocus", "escorte"].includes(String(c["mission"]));
    case "FleetEmbark":
      return s("fleet") && s("army");
    case "FleetLand":
      return s("fleet") && s("army") && s("province");
    case "ResolveEncounter":
      return s("encounter") && ["auto", "jouer", "retraite"].includes(String(c["mode"])) && Array.isArray(c["orders"]);
    case "ChooseSuccessor":
      return s("candidate");
    default:
      return false;
  }
}
