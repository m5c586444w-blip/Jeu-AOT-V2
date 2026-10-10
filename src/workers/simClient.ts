import type { Command } from "../sim/core/commands";
import type { GameState } from "../sim/core/state";
import type { SimRequest, SimResponse } from "../sim/sim";
import type { WorldSource } from "../sim/strategic/world";
import type { DifficultySetting } from "../data/endingSchemas";

/** Canal minimal commun au Worker navigateur et à worker_threads. */
export interface SimPort {
  post(msg: SimRequest): void;
  onMessage(handler: (msg: SimResponse) => void): void;
}

export interface SimReply {
  state: GameState;
  hash: string;
  source?: WorldSource;
}
type Pending = { resolve: (s: SimReply) => void; reject: (e: Error) => void };
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Client asynchrone : envoie des requêtes numérotées et résout les promesses à réception. */
export class SimClient {
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();

  constructor(private readonly port: SimPort) {
    port.onMessage((msg) => {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.ok) p.resolve({ state: msg.state, hash: msg.hash, ...(msg.source ? { source: msg.source } : {}) });
      else p.reject(new Error(msg.error));
    });
  }

  private call(req: DistributiveOmit<SimRequest, "id">): Promise<SimReply> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.port.post({ ...req, id } as SimRequest);
    });
  }

  /** Démarre une partie : `scenario` null = simulation sans monde (fondations). */
  init(seed: number, scenario: string | null, difficulty?: DifficultySetting) {
    return this.call({ op: "init", seed, scenario, ...(difficulty && difficulty !== "normal" ? { difficulty } : {}) });
  }
  dispatch(cmd: Command) {
    return this.call({ op: "dispatch", cmd });
  }
  reset(seed: number) {
    return this.call({ op: "reset", seed });
  }
  load(state: GameState) {
    return this.call({ op: "load", state });
  }
  state() {
    return this.call({ op: "state" });
  }
}
