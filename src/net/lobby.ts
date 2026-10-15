import type { GameState } from "../sim/core/state";
import { MAX_SEATS } from "../sim/core/seat";
import type { SeatId } from "../sim/core/seat";
import { withTable } from "../sim/core/table";

/**
 * Salon d'attente (27 §2) : les joueurs prennent un siège, choisissent un camp parmi ceux que le scénario autorise, se déclarent prêts ;
 * l'hôte lance. Logique pure (aucune entrée-sortie) : l'interface et le transport viennent s'y brancher.
 */
export interface LobbyOptions {
  /** Camps jouables du scénario (`scenario.world.playable`). */
  playable: readonly string[];
  /** Nombre maximal de sièges (≤ 9). */
  maxSeats?: number;
}

export type LobbyRefusal = "lobby.err.full" | "lobby.err.unknown_seat" | "lobby.err.not_playable" | "lobby.err.started" | "lobby.err.not_ready" | "lobby.err.empty";

interface Slot {
  faction: string | null;
  ready: boolean;
}

export class Lobby {
  private readonly slots = new Map<SeatId, Slot>();
  private started = false;
  private readonly max: number;

  constructor(private readonly opt: LobbyOptions) {
    this.max = Math.min(opt.maxSeats ?? MAX_SEATS, MAX_SEATS);
  }

  /** Premier siège libre (seat_1, seat_2…), ou un refus si la table est pleine. */
  join(): SeatId | LobbyRefusal {
    if (this.started) return "lobby.err.started";
    for (let i = 1; i <= this.max; i++) {
      const id = `seat_${i}`;
      if (!this.slots.has(id)) {
        this.slots.set(id, { faction: null, ready: false });
        return id;
      }
    }
    return "lobby.err.full";
  }

  leave(seat: SeatId): void {
    if (!this.started) this.slots.delete(seat);
  }

  /** Choix du camp : réinitialise l'état « prêt » (le joueur doit reconfirmer). */
  choose(seat: SeatId, faction: string): LobbyRefusal | null {
    const s = this.slots.get(seat);
    if (this.started) return "lobby.err.started";
    if (!s) return "lobby.err.unknown_seat";
    if (!this.opt.playable.includes(faction)) return "lobby.err.not_playable";
    s.faction = faction;
    s.ready = false;
    return null;
  }

  /** Déclare prêt ; sans camp choisi, refus. */
  setReady(seat: SeatId, ready: boolean): LobbyRefusal | null {
    const s = this.slots.get(seat);
    if (this.started) return "lobby.err.started";
    if (!s) return "lobby.err.unknown_seat";
    if (ready && !s.faction) return "lobby.err.not_ready";
    s.ready = ready;
    return null;
  }

  get seats(): { seat: SeatId; faction: string | null; ready: boolean }[] {
    return [...this.slots.entries()].sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true })).map(([seat, s]) => ({ seat, ...s }));
  }

  canStart(): LobbyRefusal | null {
    if (this.started) return "lobby.err.started";
    if (this.slots.size === 0) return "lobby.err.empty";
    return [...this.slots.values()].every((s) => s.ready && s.faction) ? null : "lobby.err.not_ready";
  }

  /**
   * Lance la partie : installe la table sur l'état initial. À partir de deux sièges sur une même faction, chaque armée sans propriétaire
   * de cette faction reçoit un `owner` explicite, réparti à tour de rôle entre ses sièges (D-168).
   */
  start(initial: GameState): GameState | LobbyRefusal {
    const refusal = this.canStart();
    if (refusal) return refusal;
    this.started = true;
    const table: Record<SeatId, string> = {};
    const byFaction = new Map<string, SeatId[]>();
    for (const { seat, faction } of this.seats) {
      table[seat] = faction as string;
      byFaction.set(faction as string, [...(byFaction.get(faction as string) ?? []), seat]);
    }
    let state = withTable(initial, table);
    if (state.armies) {
      const turn = new Map<string, number>();
      const armies = structuredClone(state.armies);
      for (const a of armies.armies) {
        const group = byFaction.get(a.faction);
        if (a.owner !== undefined || !group || group.length < 2) continue;
        const k = turn.get(a.faction) ?? 0;
        a.owner = group[k % group.length] as SeatId;
        turn.set(a.faction, k + 1);
      }
      state = { ...state, armies };
    }
    return state;
  }
}
