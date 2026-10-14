import type { ClockBalance } from "../../data/balance";
import type { SeatId, SeatsState } from "../core/seat";
import { SOLO_SEAT } from "../core/seat";
import type { ShiftersState } from "../shifters/shifters";
import { titansOf } from "../shifters/shifters";
import { levelOf } from "./suspicion";
import type { ClockState, ClockView } from "./types";

/** Faction dirigée par un siège (27 §1) : registre de sièges, sinon le siège solo dirige la faction jouée. */
export function factionOfSeatId(seats: SeatsState | undefined, seat: SeatId, playerFaction: string): string | null {
  if (seats) return seats.seats[seat]?.faction ?? null;
  return seat === SOLO_SEAT ? playerFaction : null;
}

/**
 * Ce qu'une faction sait de l'Horloge. Un porteur d'une autre faction n'y figure que s'il lui est démasqué ; la suspicion adverse n'y figure jamais ;
 * les soupçons propres sont donnés par niveau, sans nombre, et sans distinguer un porteur d'un innocent.
 * `curseYears` et `year` : années restantes affichées pour les seuls porteurs de la faction (les siens).
 */
export function viewForFaction(s: ClockState, sh: ShiftersState | null, faction: string, year: number, curseYears: number, b: ClockBalance): ClockView {
  const known: ClockView["known"] = [];
  for (const id of Object.keys(s.bearers).sort()) {
    const br = s.bearers[id];
    if (!br || !br.exposedTo.includes(faction)) continue;
    const own = br.faction === faction;
    const titans = titansOf(sh, id);
    const left = own ? Math.min(...titans.map((t) => curseYears - (year - (sh?.titans[t]?.since ?? year))), curseYears) : null;
    known.push({ id, titans, own, cover: own ? br.cover : null, yearsLeft: titans.length > 0 ? left : null });
  }
  const suspects: ClockView["suspects"] = [];
  for (const target of Object.keys(s.suspects).sort()) {
    const r = s.suspects[target]?.[faction];
    if (!r || r.closed) continue;
    // Un porteur déjà connu de cette faction n'est plus un « suspect ».
    if (s.bearers[target]?.exposedTo.includes(faction)) continue;
    const level = levelOf(r.value, b);
    if (level !== "aucun") suspects.push({ character: target, level });
  }
  return { faction, known, suspects };
}

export function viewForSeat(s: ClockState, sh: ShiftersState | null, seat: SeatId, seats: SeatsState | undefined, playerFaction: string, year: number, curseYears: number, b: ClockBalance): ClockView {
  const faction = factionOfSeatId(seats, seat, playerFaction);
  if (faction === null) return { faction: "", known: [], suspects: [] };
  return viewForFaction(s, sh, faction, year, curseYears, b);
}
