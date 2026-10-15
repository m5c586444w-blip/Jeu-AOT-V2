import { deserialize } from "../sim/core/serialize";
import type { GameState } from "../sim/core/state";
import { toAbsoluteDay } from "../sim/core/time";
import type { SeatId } from "../sim/core/seat";
import type { World } from "../sim/strategic/world";
import { applyTurn, hashOf } from "./lockstep";
import { HostMessageSchema, PROTOCOL_VERSION } from "./protocol";
import type { ClientMessage, Turn } from "./protocol";
import type { Link } from "./transport";

/**
 * Client lockstep : reçoit les tours de l'hôte dans l'ordre (tampon si des tours arrivent en désordre), les exécute avec `applyTurn`
 * et envoie son empreinte à la cadence convenue. Il ne modifie JAMAIS son état autrement : toute action du joueur est une commande
 * envoyée à l'hôte, qui la renvoie dans un tour (même pour le joueur qui l'a émise).
 */
const GAP_RESYNC = 8;

export class Client {
  state: GameState | null = null;
  tick = 0;
  connected = false;
  readonly rejected: { id: number; code: string }[] = [];
  readonly executionRejects: { tick: number; seq: number; code: string }[] = [];
  readonly snapshots: { tick: number; reason: string }[] = [];
  refused: string | null = null;
  /** Allégeance secrète reçue en privé de l'hôte (seulement si ce siège est traître). */
  secret: { serves: string; objective: string; capital: number } | null = null;
  private nextId = 1;
  private readonly buffer = new Map<number, Turn>();

  constructor(private readonly link: Link, private readonly world: World, readonly seat: SeatId, private readonly password: string, private readonly hashEvery: number) {
    link.onMessage((raw) => this.receive(raw));
    link.onClose(() => {
      this.connected = false;
    });
  }

  private post(m: ClientMessage): void {
    this.link.send(JSON.stringify(m));
  }

  connect(): void {
    this.post({ t: "hello", v: PROTOCOL_VERSION, seat: this.seat, password: this.password });
  }

  /** Envoie une commande à l'hôte ; retourne son numéro. Sans état reçu (pas encore accueilli), la commande est ignorée. */
  submit(command: { type: string } & Record<string, unknown>): number | null {
    if (!this.state) return null;
    const id = this.nextId++;
    this.post({ t: "cmd", id, env: { seat: this.seat, day: toAbsoluteDay(this.state.date), command } });
    return id;
  }

  requestResync(): void {
    this.post({ t: "resync" });
  }

  leave(): void {
    this.post({ t: "bye" });
    this.link.close();
  }

  private receive(raw: string): void {
    let msg: ReturnType<typeof HostMessageSchema.parse>;
    try {
      msg = HostMessageSchema.parse(JSON.parse(raw));
    } catch {
      return;
    }
    switch (msg.t) {
      case "welcome":
        this.install(msg.snapshot, msg.tick, "welcome");
        this.connected = true;
        break;
      case "snapshot":
        this.install(msg.snapshot, msg.tick, msg.reason);
        break;
      case "turn":
        this.buffer.set(msg.turn.tick, msg.turn);
        this.drain();
        // Trou persistant (plusieurs tours en attente sans le suivant) ou tampon démesuré : instantané, plutôt que blocage.
        if (this.state && this.buffer.size >= GAP_RESYNC && !this.buffer.has(this.tick + 1)) {
          this.buffer.clear();
          this.requestResync();
        }
        break;
      case "reject":
        this.rejected.push({ id: msg.id, code: msg.code });
        break;
      case "secret":
        this.secret = { serves: msg.serves, objective: msg.objective, capital: msg.capital };
        break;
      case "refused":
        this.refused = msg.code;
        break;
    }
  }

  private install(snapshot: string, tick: number, reason: string): void {
    this.state = deserialize(snapshot);
    this.tick = tick;
    if (reason !== "welcome") this.snapshots.push({ tick, reason });
    for (const t of [...this.buffer.keys()]) if (t <= tick) this.buffer.delete(t);
    this.drain();
  }

  private drain(): void {
    while (this.state) {
      const turn = this.buffer.get(this.tick + 1);
      if (!turn) return;
      this.buffer.delete(turn.tick);
      const { state, report } = applyTurn(this.state, turn, this.world);
      this.state = state;
      this.tick = turn.tick;
      for (const r of report.rejected) this.executionRejects.push({ tick: turn.tick, ...r });
      if (this.tick % this.hashEvery === 0) this.post({ t: "hash", tick: this.tick, hash: hashOf(state) });
    }
  }
}
