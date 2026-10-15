import type { GameState } from "./state";
import type { SeatId } from "./seat";

/**
 * Installe une table multijoueur (27 §3, §4.2) : un siège par joueur, avec sa faction. Les factions autres que la faction « jouée » deviennent
 * des camps rivaux humains (`nations.humans`) : l'IA ne les pilote plus. Pure, déterministe ; à appeler avant le premier tour.
 */
export function withTable(state: GameState, table: Readonly<Record<SeatId, string>>): GameState {
  const seats = { seats: Object.fromEntries(Object.keys(table).sort().map((id) => [id, { faction: table[id] as string }])) };
  if (!state.nations) return { ...state, seats };
  const humans = [...new Set(Object.values(table))].filter((f) => f !== state.nations?.player).sort();
  return { ...state, seats, nations: { ...state.nations, ...(humans.length > 0 ? { humans } : {}) } };
}
