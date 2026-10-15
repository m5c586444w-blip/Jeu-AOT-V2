import { authorize, checkEnvelope, seatExists } from "../sim/commands/apply";
import { serialize } from "../sim/core/serialize";
import type { GameState } from "../sim/core/state";
import type { SeatId } from "../sim/core/seat";
import type { World } from "../sim/strategic/world";
import { applyTurn, hashOf } from "./lockstep";
import type { TurnReport } from "./lockstep";
import { ClientMessageSchema, PROTOCOL_VERSION } from "./protocol";
import type { HostMessage, Turn } from "./protocol";
import { SecretVault } from "./secrets";
import type { Link } from "./transport";

export interface HostOptions {
  world: World;
  initial: GameState;
  /** Mot de passe de la partie (amis uniquement) ; la comparaison n'est pas une protection contre un adversaire : c'est un garde-fou d'accueil. */
  password: string;
  /** Cadence (en tours) de la comparaison des empreintes ; les clients envoient la leur aux mêmes tours. */
  hashEvery: number;
}

export interface DesyncRecord {
  tick: number;
  seat: SeatId;
  expected: string;
  got: string;
}

/**
 * Hôte séquenceur (27 §1). Il reçoit les commandes, les place dans l'ordre d'arrivée, produit un tour à chaque `step`, l'exécute lui-même
 * (son état est l'état de référence) et le diffuse. Il compare les empreintes envoyées par les clients et renvoie un instantané au fautif.
 * Pur de toute horloge : l'appelant décide quand produire un tour (campagne : cadence de la partie ; test : boucle).
 */
export class Host {
  state: GameState;
  tick = 0;
  readonly journal: Turn[] = [];
  readonly desyncs: DesyncRecord[] = [];
  readonly executionRejects: { tick: number; seq: number; code: string }[] = [];
  /** Coffre de secrets (27 §4.4) : hors de l'état partagé, des tours et des instantanés. */
  readonly vault = new SecretVault();
  private seq = 0;
  private pending: { seq: number; env: Turn["envs"][number]["env"] }[] = [];
  private readonly hashAt = new Map<number, string>();
  private readonly seated = new Map<SeatId, Link>();

  constructor(private readonly opt: HostOptions) {
    this.state = opt.initial;
    this.hashAt.set(0, hashOf(this.state));
  }

  /** Une nouvelle connexion : elle n'a pas de siège tant qu'elle n'a pas dit bonjour. */
  accept(link: Link): void {
    let seat: SeatId | null = null;
    link.onMessage((raw) => {
      const msg = this.parse(raw);
      if (!msg) {
        this.send(link, { t: "refused", code: "net.err.bad_message" });
        return;
      }
      if (msg.t === "hello") {
        seat = this.hello(link, msg.seat, msg.password, msg.v);
        return;
      }
      if (!seat) return;
      if (msg.t === "cmd") this.command(link, seat, msg.id, msg.env);
      else if (msg.t === "hash") this.checkHash(link, seat, msg.tick, msg.hash);
      else if (msg.t === "resync") this.send(link, { t: "snapshot", tick: this.tick, snapshot: serialize(this.state), reason: "resync" });
      else if (msg.t === "bye") link.close();
    });
    link.onClose(() => {
      if (seat && this.seated.get(seat) === link) this.seated.delete(seat);
    });
  }

  get seats(): SeatId[] {
    return [...this.seated.keys()].sort();
  }

  private parse(raw: string): ReturnType<typeof ClientMessageSchema.parse> | null {
    try {
      const r = ClientMessageSchema.safeParse(JSON.parse(raw));
      return r.success ? r.data : null;
    } catch {
      return null;
    }
  }

  private send(link: Link, m: HostMessage): void {
    link.send(JSON.stringify(m));
  }

  private hello(link: Link, seat: SeatId, password: string, version: number): SeatId | null {
    if (version !== PROTOCOL_VERSION) return this.refuse(link, "net.err.version");
    if (password !== this.opt.password) return this.refuse(link, "net.err.password");
    if (!seatExists(this.state.seats, seat)) return this.refuse(link, "seat.err.unknown_seat");
    if (this.seated.has(seat)) return this.refuse(link, "net.err.seat_taken");
    this.seated.set(seat, link);
    this.send(link, { t: "welcome", seat, tick: this.tick, snapshot: serialize(this.state) });
    const secret = this.vault.secretFor(seat);
    if (secret) this.send(link, { t: "secret", serves: secret.serves, objective: secret.objective, capital: secret.capital });
    return seat;
  }

  private refuse(link: Link, code: string): null {
    this.send(link, { t: "refused", code });
    return null;
  }

  /** Une commande : forme, siège usurpé, droit (conseil indicatif : le droit est revérifié à l'exécution par chaque client). */
  private command(link: Link, seat: SeatId, id: number, env: Turn["envs"][number]["env"]): void {
    const reject = (code: string, detail: string): void => this.send(link, { t: "reject", id, code, detail });
    const chk = checkEnvelope(env);
    if (!chk.ok) return reject(chk.code, chk.detail);
    if (env.seat !== seat) return reject("seat.err.spoof", `${seat} -> ${env.seat}`);
    const refusal = authorize(this.state, seat, env.command);
    if (refusal) return reject(refusal.code, refusal.detail);
    this.pending.push({ seq: ++this.seq, env });
  }

  private checkHash(link: Link, seat: SeatId, tick: number, got: string): void {
    const expected = this.hashAt.get(tick);
    if (expected === undefined || expected === got) return;
    this.desyncs.push({ tick, seat, expected, got });
    this.send(link, { t: "snapshot", tick: this.tick, snapshot: serialize(this.state), reason: "desync" });
  }

  /** Produit, exécute et diffuse le tour suivant. */
  step(advance: number): { turn: Turn; report: TurnReport } {
    const turn: Turn = { tick: this.tick + 1, advance, envs: this.pending };
    this.pending = [];
    const { state, report } = applyTurn(this.state, turn, this.opt.world);
    this.state = state;
    this.tick = turn.tick;
    this.journal.push(turn);
    for (const r of report.rejected) this.executionRejects.push({ tick: turn.tick, ...r });
    if (this.tick % this.opt.hashEvery === 0) this.hashAt.set(this.tick, hashOf(this.state));
    for (const [, link] of [...this.seated].sort(([a], [b]) => a.localeCompare(b))) this.send(link, { t: "turn", turn });
    return { turn, report };
  }
}

