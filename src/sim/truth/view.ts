import type { TruthBalance } from "../../data/balance";
import type { SeatId, SeatsState } from "../core/seat";
import { SOLO_SEAT } from "../core/seat";
import { actOf, capabilitiesOf } from "./acts";
import { assess } from "./dossier";
import type { DossierLine, TruthState, TruthView } from "./types";

/**
 * Dossier d'une faction (26 §7) : ce qu'elle croit, la fiabilité A–D, l'âge, les contradictions et les pièces. Jamais la véracité d'un fait non
 * vérifié, jamais le dossier d'une autre faction, aucun fait sans pièce ni vérification.
 */
export function viewForFaction(s: TruthState, faction: string, today: number, b: TruthBalance): TruthView {
  const facts = new Set([...Object.keys(s.dossiers[faction] ?? {}), ...Object.keys(s.discovered[faction] ?? {})]);
  const dossier: DossierLine[] = [...facts].sort().map((fact) => {
    const a = assess(s, faction, fact, today, b);
    const evidence = (s.dossiers[faction]?.[fact] ?? []).map((e) => ({ source: e.source, claim: e.claim, ageDays: today - e.day, origin: e.origin }));
    return { fact, belief: a.belief, grade: a.grade, backing: a.backing, contradicted: a.contradicted, ageDays: a.ageDays, verified: a.verified, evidence };
  });
  return { faction, act: actOf(s, faction, b), capabilities: capabilitiesOf(s, faction, b), dossier };
}

/** Vue d'un siège : la faction qu'il dirige (registre de sièges, sinon le siège solo dirige la faction jouée) ; un siège inconnu ne voit rien. */
export function viewForSeat(s: TruthState, seat: SeatId, seats: SeatsState | undefined, playerFaction: string, today: number, b: TruthBalance): TruthView {
  const faction = seats ? (seats.seats[seat]?.faction ?? null) : seat === SOLO_SEAT ? playerFaction : null;
  if (faction === null) return { faction: "", act: "", capabilities: [], dossier: [] };
  return viewForFaction(s, faction, today, b);
}
