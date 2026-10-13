import { SOLO_SEAT } from "../core/seat";
import type { SeatId, SeatsState } from "../core/seat";
import { toAbsoluteDay } from "../core/time";
import type { GameState } from "../core/state";
import { playerOf } from "../armies/state";

/**
 * Connaissance par faction (27 §1) : ce que chaque faction sait des armées d'autrui. Le brouillard d'un siège est la
 * connaissance de la faction qu'il dirige : aucune hypothèse « un seul joueur ». Structure facultative de l'état
 * (`knowledge?`), mise à jour par la fonction pure `observe` ; non branchée à `tickDay` (empreintes inchangées).
 */

export interface SeenArmy {
  faction: string;
  province: string | null;
  /** Jour absolu de la dernière observation. */
  day: number;
}

export interface FactionKnowledge {
  armies: Record<string, SeenArmy>;
}

export interface KnowledgeState {
  byFaction: Record<string, FactionKnowledge>;
}

export const emptyKnowledge = (): KnowledgeState => ({ byFaction: {} });

/** Provinces que `faction` voit : celles où elle contrôle le terrain ou a une armée. */
export function watchedProvinces(state: GameState, faction: string): Set<string> {
  const out = new Set<string>();
  const ctl = state.nations?.control ?? {};
  for (const p of Object.keys(ctl).sort()) if (ctl[p] === faction) out.add(p);
  for (const a of state.armies?.armies ?? []) if (a.faction === faction && a.province) out.add(a.province);
  return out;
}

/** Observation du jour : renvoie une nouvelle connaissance (l'entrée n'est pas modifiée). */
export function observe(state: GameState, prev: KnowledgeState, factions: readonly string[]): KnowledgeState {
  const day = toAbsoluteDay(state.date);
  const armies = state.armies?.armies ?? [];
  const byFaction: Record<string, FactionKnowledge> = {};
  for (const f of [...factions].sort()) {
    const known: Record<string, SeenArmy> = { ...(prev.byFaction[f]?.armies ?? {}) };
    const watched = watchedProvinces(state, f);
    for (const a of armies) {
      if (a.faction === f || (a.province !== null && watched.has(a.province))) known[a.id] = { faction: a.faction, province: a.province, day };
    }
    byFaction[f] = { armies: known };
  }
  return { byFaction };
}

/** Faction dirigée par un siège (null si le siège n'existe pas ou ne dirige rien). */
export function factionOfSeat(state: GameState, seat: SeatId): string | null {
  const seats: SeatsState | undefined = state.seats;
  if (seats) return seats.seats[seat]?.faction ?? null;
  return seat === SOLO_SEAT ? playerOf(state.nations) : null;
}

export interface FogView {
  /** Armées connues du siège, avec la fraîcheur de l'information (jours depuis l'observation). */
  armiesKnownTo(seat: SeatId): { id: string; faction: string; province: string | null; ageDays: number }[];
}

/** Brouillard par siège, dérivé de la connaissance par faction. */
export function fogView(state: GameState, ks: KnowledgeState): FogView {
  const today = toAbsoluteDay(state.date);
  return {
    armiesKnownTo(seat) {
      const f = factionOfSeat(state, seat);
      if (f === null) return [];
      const known = ks.byFaction[f]?.armies ?? {};
      return Object.keys(known).sort().map((id) => {
        const k = known[id] as SeenArmy;
        return { id, faction: k.faction, province: k.province, ageDays: today - k.day };
      });
    },
  };
}
