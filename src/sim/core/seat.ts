/**
 * Siège (27 §1) : un joueur humain autour de la table. Chaque entité commandable (armée, flotte, escouade de bataille,
 * section) peut porter un `owner`. Champ facultatif : absent = siège du joueur solo (ou, s'il existe, le siège qui
 * contrôle la faction de l'entité). Une partie solo existante garde donc son empreinte et se relit sans migration.
 */
export type SeatId = string;

export const SEAT_PATTERN = /^seat_[0-9]{1,2}$/;
export const MAX_SEATS = 9;

/** Siège du joueur solo. */
export const SOLO_SEAT: SeatId = "seat_1";

export const isSeatId = (x: unknown): x is SeatId => typeof x === "string" && SEAT_PATTERN.test(x);

/** Siège déclaré dans la partie : la faction qu'il dirige. Absent de l'état = partie solo. */
export interface SeatsState {
  seats: Record<SeatId, { faction: string }>;
}

/** Siège qui dirige une faction ; en solo (aucun registre), le siège solo dirige la faction jouée. */
export function seatOfFaction(seats: SeatsState | undefined, faction: string, playerFaction: string): SeatId | null {
  if (seats) {
    for (const id of Object.keys(seats.seats).sort()) if (seats.seats[id]?.faction === faction) return id;
    return null;
  }
  return faction === playerFaction ? SOLO_SEAT : null;
}

/** Propriétaire d'une entité : champ `owner`, sinon siège de sa faction, sinon null (IA : aucun siège ne la commande). */
export function ownerOf(e: { owner?: SeatId; faction?: string }, seats: SeatsState | undefined, playerFaction: string): SeatId | null {
  if (e.owner !== undefined) return e.owner;
  return e.faction === undefined ? SOLO_SEAT : seatOfFaction(seats, e.faction, playerFaction);
}
