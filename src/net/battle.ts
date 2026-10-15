import { z } from "zod";
import { TimedOrderSchema } from "../sim/commands/schema";
import { applyBattleOrderAs } from "../sim/commands/apply";
import { SOLO_SEAT } from "../sim/core/seat";
import type { SeatId, SeatsState } from "../sim/core/seat";
import { SeatIdSchema } from "../sim/commands/schema";
import { battleHash, stepBattle } from "../sim/tactical/battle";
import type { Battle } from "../sim/tactical/battle";
import type { TimedOrder } from "../sim/tactical/types";
import type { Link } from "./transport";

/**
 * Bataille à plusieurs (27 §4.3) : même lockstep que la campagne, au pas de la bataille (20 Hz). L'hôte reçoit les ordres des sièges, les
 * date du pas courant, produit un tour de `steps` pas (ordres puis pas) et le diffuse ; chaque client exécute `applyBattleTurn`.
 * Les escouades portent un `owner` : un siège ne commande que les siennes (refus identique à l'exécution chez tous).
 * L'état d'une bataille n'est pas diffusé : tous reconstruisent la même bataille (`make`, déterministe) ; un instantané (reconnexion,
 * désynchronisation) transporte l'état JSON de la bataille.
 */
export const BattleTurnSchema = z
  .object({
    tick: z.number().int().min(0),
    steps: z.number().int().min(1).max(40),
    orders: z.array(z.object({ seq: z.number().int().min(1), seat: SeatIdSchema, order: TimedOrderSchema }).strict()),
  })
  .strict();
export type BattleTurn = z.infer<typeof BattleTurnSchema>;

const ClientSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("hello"), seat: SeatIdSchema, password: z.string().max(64) }).strict(),
  z.object({ t: z.literal("order"), id: z.number().int().min(1), order: TimedOrderSchema }).strict(),
  z.object({ t: z.literal("hash"), tick: z.number().int().min(0), hash: z.number() }).strict(),
  z.object({ t: z.literal("resync") }).strict(),
]);
const HostSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("welcome"), seat: SeatIdSchema, snapshot: z.string() }).strict(),
  z.object({ t: z.literal("turn"), turn: BattleTurnSchema }).strict(),
  z.object({ t: z.literal("reject"), id: z.number().int().min(1), code: z.string() }).strict(),
  z.object({ t: z.literal("snapshot"), snapshot: z.string(), reason: z.enum(["desync", "resync"]) }).strict(),
  z.object({ t: z.literal("refused"), code: z.string() }).strict(),
]);

/** Instantané : l'état JSON de la bataille (la carte et le monde se reconstruisent depuis la graine). */
export const snapshotOf = (bt: Battle): string => JSON.stringify(bt.state);
export function restore(bt: Battle, snapshot: string): void {
  bt.state = JSON.parse(snapshot) as Battle["state"];
}
export const hashBattle = (bt: Battle): number => battleHash(bt.state);

/** Exécute un tour : ordres (droit vérifié par escouade), puis `steps` pas. Pur de réseau ; seul chemin de modification d'une bataille jouée à plusieurs. */
export function applyBattleTurn(bt: Battle, turn: BattleTurn, seats?: SeatsState): { rejected: { seq: number; code: string }[] } {
  const rejected: { seq: number; code: string }[] = [];
  for (const { seq, seat, order } of turn.orders) {
    const r = applyBattleOrderAs(bt, seat, { ...order, tick: bt.state.tick } as TimedOrder, seats);
    if (r) rejected.push({ seq, code: r.code });
  }
  for (let i = 0; i < turn.steps && !bt.state.ended; i++) stepBattle(bt);
  return { rejected };
}

export class BattleHost {
  readonly journal: BattleTurn[] = [];
  readonly desyncs: { tick: number; seat: SeatId }[] = [];
  private seq = 0;
  private pending: BattleTurn["orders"] = [];
  private readonly seated = new Map<SeatId, Link>();
  private readonly hashes = new Map<number, number>();

  constructor(readonly bt: Battle, private readonly password: string, private readonly seats: SeatsState | undefined, private readonly hashEvery = 20) {
    this.hashes.set(0, hashBattle(bt));
  }

  accept(link: Link): void {
    let seat: SeatId | null = null;
    const send = (m: z.infer<typeof HostSchema>): void => link.send(JSON.stringify(m));
    link.onMessage((raw) => {
      let msg: z.infer<typeof ClientSchema>;
      try {
        msg = ClientSchema.parse(JSON.parse(raw));
      } catch {
        send({ t: "refused", code: "net.err.bad_message" });
        return;
      }
      if (msg.t === "hello") {
        if (seat) return; // un lien déjà assis ne peut ni changer ni cumuler de siège
        const known = this.seats ? msg.seat in this.seats.seats : msg.seat === SOLO_SEAT;
        const code = msg.password !== this.password ? "net.err.password" : !known ? "seat.err.unknown_seat" : this.seated.has(msg.seat) ? "net.err.seat_taken" : null;
        if (code) return send({ t: "refused", code });
        seat = msg.seat;
        this.seated.set(seat, link);
        send({ t: "welcome", seat, snapshot: snapshotOf(this.bt) });
        return;
      }
      if (!seat) return;
      if (msg.t === "order") this.pending.push({ seq: ++this.seq, seat, order: msg.order });
      else if (msg.t === "hash") {
        const want = this.hashes.get(msg.tick);
        if (want !== undefined && want !== msg.hash) {
          this.desyncs.push({ tick: msg.tick, seat });
          send({ t: "snapshot", snapshot: snapshotOf(this.bt), reason: "desync" });
        }
      } else if (msg.t === "resync") send({ t: "snapshot", snapshot: snapshotOf(this.bt), reason: "resync" });
    });
    link.onClose(() => {
      if (seat && this.seated.get(seat) === link) this.seated.delete(seat);
    });
  }

  step(steps: number): BattleTurn {
    const turn: BattleTurn = { tick: this.bt.state.tick, steps, orders: this.pending };
    this.pending = [];
    applyBattleTurn(this.bt, turn, this.seats);
    this.journal.push(turn);
    if (Math.floor(turn.tick / this.hashEvery) !== Math.floor(this.bt.state.tick / this.hashEvery)) this.hashes.set(this.bt.state.tick, hashBattle(this.bt));
    for (const [, link] of [...this.seated].sort(([a], [b]) => a.localeCompare(b))) link.send(JSON.stringify({ t: "turn", turn }));
    return turn;
  }
}

export class BattleClient {
  connected = false;
  refused: string | null = null;
  readonly rejected: { seq: number; code: string }[] = [];
  readonly snapshots: string[] = [];
  private nextId = 1;
  private readonly buffer = new Map<number, BattleTurn>();

  constructor(private readonly link: Link, readonly bt: Battle, readonly seat: SeatId, private readonly password: string, private readonly seats: SeatsState | undefined, private readonly hashEvery = 20) {
    link.onMessage((raw) => this.receive(raw));
  }

  connect(): void {
    this.link.send(JSON.stringify({ t: "hello", seat: this.seat, password: this.password }));
  }

  order(order: Omit<TimedOrder, "tick">): number {
    const id = this.nextId++;
    this.link.send(JSON.stringify({ t: "order", id, order: { ...order, tick: this.bt.state.tick } }));
    return id;
  }

  private receive(raw: string): void {
    let msg: z.infer<typeof HostSchema>;
    try {
      msg = HostSchema.parse(JSON.parse(raw));
    } catch {
      return;
    }
    if (msg.t === "welcome") {
      restore(this.bt, msg.snapshot);
      this.connected = true;
      this.drain();
    } else if (msg.t === "snapshot") {
      restore(this.bt, msg.snapshot);
      this.snapshots.push(msg.reason);
      for (const t of [...this.buffer.keys()]) if (t < this.bt.state.tick) this.buffer.delete(t);
      this.drain();
    } else if (msg.t === "turn") {
      this.buffer.set(msg.turn.tick, msg.turn);
      this.drain();
    } else if (msg.t === "reject") this.rejected.push({ seq: msg.id, code: msg.code });
    else if (msg.t === "refused") this.refused = msg.code;
  }

  private drain(): void {
    for (;;) {
      const turn = this.buffer.get(this.bt.state.tick);
      if (!turn) return;
      this.buffer.delete(turn.tick);
      const before = this.bt.state.tick;
      this.rejected.push(...applyBattleTurn(this.bt, turn, this.seats).rejected);
      if (Math.floor(before / this.hashEvery) !== Math.floor(this.bt.state.tick / this.hashEvery)) this.link.send(JSON.stringify({ t: "hash", tick: this.bt.state.tick, hash: hashBattle(this.bt) }));
    }
  }
}

