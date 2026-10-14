import type { RegistryBalance } from "../../data/balance";
import type { SeatId, SeatsState } from "../core/seat";
import { SOLO_SEAT } from "../core/seat";
import { standing } from "./memorial";
import { labelOf } from "./troop";
import type { RegistryState, RegistryView } from "./types";

const EMPTY: RegistryView = { faction: "", counts: { enlisted: 0, living: 0, named: 0, generated: 0, missing: 0, dead: 0 }, roster: [], deaths: [], steles: [], standing: { opinion: 0, legitimacy: 0, recruitment: 1 } };

/**
 * Registre d'une faction (26 §8) : sa troupe, ses morts avec cause, lieu et stèle, ses stèles, l'état de l'opinion et du recrutement.
 * Ne contient que les soldats, morts et stèles de CETTE faction ; jamais de lien, de succession ni d'événement d'une autre.
 */
export function viewForFaction(s: RegistryState, faction: string, today: number, b: RegistryBalance): RegistryView {
  const mine = Object.values(s.soldiers).filter((x) => x.faction === faction).sort((p, q) => (p.id < q.id ? -1 : 1));
  const alive = mine.filter((x) => x.status === "vivant");
  return {
    faction,
    counts: {
      enlisted: s.enlisted[faction] ?? 0,
      living: alive.length,
      named: alive.filter((x) => x.named).length,
      generated: alive.filter((x) => !x.named).length,
      missing: mine.filter((x) => x.status === "disparu").length,
      dead: mine.filter((x) => x.status === "mort").length,
    },
    roster: mine
      .filter((x) => x.status !== "mort")
      .map((x) => ({ id: x.id, label: labelOf(x), named: x.named, rank: x.rank, squad: x.squad, status: x.status, morale: x.morale, stress: x.stress, refusing: x.refusingUntil !== null && today < x.refusingUntil, renown: x.renown })),
    deaths: s.deaths
      .filter((d) => d.faction === faction)
      .map((d) => ({ file: d.id, label: d.name ?? d.soldier, named: d.named, rank: d.rank, squad: d.squad, day: d.day, cause: d.cause, place: d.place, circumstances: d.circumstances, inscribed: d.inscribed })),
    steles: s.steles.filter((x) => x.faction === faction).map((x) => ({ id: x.id, title: x.title, place: x.place, epitaph: x.epitaph, inscribed: x.inscribed.length, capacity: b.stele.capacity })),
    standing: standing(s, faction, today, b),
  };
}

/** Vue d'un siège : la faction qu'il dirige (registre de sièges, sinon le siège solo dirige la faction jouée) ; un siège inconnu ne voit rien. */
export function viewForSeat(s: RegistryState, seat: SeatId, seats: SeatsState | undefined, playerFaction: string, today: number, b: RegistryBalance): RegistryView {
  const faction = seats ? (seats.seats[seat]?.faction ?? null) : seat === SOLO_SEAT ? playerFaction : null;
  if (faction === null) return EMPTY;
  return viewForFaction(s, faction, today, b);
}
