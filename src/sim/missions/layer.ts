import type { GameState } from "../core/state";
import type { World } from "../strategic/world";
import { cancelMission, ctxOf, startMission } from "./missions";

/** Commandes de MIS (journalisées, rejouables). */
export type MissionCommand = { type: "StartMission"; mission: string } | { type: "CancelMission"; mission: string };

export const MISSION_COMMANDS = ["StartMission", "CancelMission"] as const;

/** Forme d'une commande de MIS (le fond est vérifié à l'application). */
export function validMissionCommand(c: Record<string, unknown>): boolean {
  return (c["type"] === "StartMission" || c["type"] === "CancelMission") && typeof c["mission"] === "string" && /^mis_[a-z0-9_]+$/.test(c["mission"]);
}

/** Applique une commande de MIS ; erreur explicite (clé i18n) si elle n'est pas recevable. */
export function applyMissionCommand(state: GameState, cmd: MissionCommand, world?: World): GameState {
  if (!world?.missions || !state.strategic) throw new Error("mission.err.no_layer");
  const c = ctxOf(world, state.seed, state.date, { st: state.strategic, pol: state.politics, rs: state.research, intel: state.intel, ev: state.events, mil: state.military, sh: state.shifters, ns: state.nations, armies: state.armies, ms: state.missions });
  if (cmd.type === "StartMission") startMission(c, cmd.mission);
  else cancelMission(c, cmd.mission);
  return { ...state, strategic: c.st, politics: c.pol, research: c.rs, intel: c.intel, events: c.ev, shifters: c.sh, nations: c.ns, missions: c.ms };
}
