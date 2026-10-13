import type { EventBus } from "../core/bus";
import { applyCommand, validateCommand } from "../core/commands";
import type { Command, SimEvents } from "../core/commands";
import { ownerOf, SOLO_SEAT } from "../core/seat";
import type { SeatId, SeatsState } from "../core/seat";
import { toAbsoluteDay } from "../core/time";
import type { GameState } from "../core/state";
import type { World } from "../strategic/world";
import { playerOf } from "../armies/state";
import { applyOrder } from "../tactical/battle";
import type { Battle } from "../tactical/battle";
import type { TimedOrder } from "../tactical/types";
import { EnvelopeSchema, isStrictType, StrictCommandSchema } from "./schema";
import type { BattleOrderCommand, CommandEnvelope } from "./schema";

/** Rejet d'une commande : `code` stable (clé i18n), jamais de mutation. */
export type CommandRefusal = { ok: false; code: string; detail: string };
export type CommandCheck = { ok: true; command: Command | BattleOrderCommand } | CommandRefusal;

const refuse = (code: string, detail: string): CommandRefusal => ({ ok: false, code, detail });

/** Le siège existe-t-il dans la partie ? Sans registre (solo), seul le siège solo existe. */
export function seatExists(seats: SeatsState | undefined, seat: SeatId): boolean {
  return seats ? seat in seats.seats : seat === SOLO_SEAT;
}

/** Identifiants d'armées et de flottes qu'une commande exige de posséder (les cibles ennemies n'en font pas partie). */
function ownedSubjects(cmd: { type: string } & Record<string, unknown>): { armies: string[]; fleets: string[] } {
  const armies: string[] = [];
  const fleets: string[] = [];
  const s = (k: string): string | null => (typeof cmd[k] === "string" ? (cmd[k] as string) : null);
  for (const k of ["army", "into"]) {
    const v = s(k);
    if (v) armies.push(v);
  }
  const f = s("fleet");
  if (f) fleets.push(f);
  return { armies, fleets };
}

/** Un siège ne commande que ses entités (27 §1). Pure : lit l'état, ne le modifie pas. */
export function authorize(state: GameState, seat: SeatId, cmd: { type: string } & Record<string, unknown>): CommandRefusal | null {
  if (!seatExists(state.seats, seat)) return refuse("seat.err.unknown_seat", seat);
  const player = playerOf(state.nations);
  const { armies, fleets } = ownedSubjects(cmd);
  if (state.armies) {
    for (const id of armies) {
      const a = state.armies.armies.find((x) => x.id === id);
      if (a && ownerOf(a, state.seats, player) !== seat) return refuse("seat.err.not_owner", `${seat} -> ${id}`);
    }
    for (const id of fleets) {
      const f = state.armies.fleets.find((x) => x.id === id);
      if (f && ownerOf(f, state.seats, player) !== seat) return refuse("seat.err.not_owner", `${seat} -> ${id}`);
    }
    if (cmd.type === "ResolveEncounter" && typeof cmd["encounter"] === "string") {
      const enc = state.armies.encounters.find((e) => e.id === cmd["encounter"]);
      const mine = enc?.sides.some((side) => side.armies.some((id) => {
        const a = state.armies?.armies.find((x) => x.id === id);
        return !!a && ownerOf(a, state.seats, player) === seat;
      }));
      if (enc && !mine) return refuse("seat.err.not_owner", `${seat} -> ${enc.id}`);
    }
  }
  return null;
}

/** Valide une enveloppe : forme Zod, schéma strict si couvert, validation historique sinon. */
export function checkEnvelope(raw: unknown): CommandCheck & { envelope?: CommandEnvelope } {
  const e = EnvelopeSchema.safeParse(raw);
  if (!e.success) return refuse("command.err.envelope", e.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const env = e.data as CommandEnvelope;
  if (isStrictType(env.command.type)) {
    const c = StrictCommandSchema.safeParse(env.command);
    if (!c.success) return refuse("command.err.shape", c.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    return { ok: true, command: c.data as Command | BattleOrderCommand, envelope: env };
  }
  const v = validateCommand(env.command);
  if (!v.ok) return refuse("command.err.shape", v.error);
  return { ok: true, command: env.command as unknown as Command, envelope: env };
}

/** Applique l'enveloppe d'un siège à l'état de campagne : forme, droit, puis `applyCommand`. Lève une erreur pour un rejet. */
export function applyEnveloped(state: GameState, raw: unknown, bus?: EventBus<SimEvents>, world?: World): GameState {
  const chk = checkEnvelope(raw);
  if (!chk.ok) {
    bus?.emit("commandRejected", { command: raw, error: chk.code });
    throw new Error(`${chk.code} : ${chk.detail}`);
  }
  const env = chk.envelope as CommandEnvelope;
  if (chk.command.type === "BattleOrder") throw new Error("command.err.battle_only : un ordre de bataille s'applique à une bataille (applyBattleOrderAs)");
  const refusal = authorize(state, env.seat, env.command);
  if (refusal) {
    bus?.emit("commandRejected", { command: raw, error: refusal.code });
    throw new Error(`${refusal.code} : ${refusal.detail}`);
  }
  return applyCommand(state, chk.command as Command, bus, world);
}

/** Propriétaire d'une escouade ou d'une batterie de bataille ; null pour le camp ennemi. */
export function battleSquadOwner(bt: Battle, squadId: string): SeatId | null | undefined {
  const sq = bt.state.squads.find((x) => x.id === squadId);
  if (sq) return sq.side === "ennemi" ? null : (sq.owner ?? SOLO_SEAT);
  const bat = bt.state.batteries?.find((b) => b.id === squadId);
  if (bat) return bat.side === "allie" ? SOLO_SEAT : null;
  return undefined;
}

/**
 * Ordre de bataille d'un siège (27 §3.4) : refusé si l'escouade n'est pas la sienne. Mute la bataille en cours (état
 * de bataille, distinct de l'état de campagne), exactement comme `applyOrder`. Renvoie le refus ou null.
 */
export function applyBattleOrderAs(bt: Battle, seat: SeatId, order: TimedOrder, seats?: SeatsState): CommandRefusal | null {
  if (!seatExists(seats, seat)) return refuse("seat.err.unknown_seat", seat);
  const owner = battleSquadOwner(bt, order.squad);
  if (owner === undefined) return refuse("battle.err.unknown_squad", order.squad);
  if (owner !== seat) return refuse("seat.err.not_owner", `${seat} -> ${order.squad}`);
  const { tick: _tick, ...rest } = order;
  void _tick;
  applyOrder(bt, rest);
  return null;
}

/** Jour absolu courant (pour horodater une enveloppe). */
export const dayOfState = (state: GameState): number => toAbsoluteDay(state.date);
