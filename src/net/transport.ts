import { Rng } from "../sim/core/rng";

/** Lien point à point, fiable et ordonné (comme une WebSocket). `send` ne bloque pas ; la livraison est asynchrone. */
export interface Link {
  send(message: string): void;
  onMessage(handler: (message: string) => void): void;
  onClose(handler: () => void): void;
  close(): void;
}

interface Pending {
  due: number;
  seq: number;
  to: LoopbackEnd;
  message: string;
}

/**
 * Réseau en mémoire pour les tests headless : latence par message tirée d'une graine (déterministe), ordre conservé par lien,
 * coupure d'un lien. Aucun temps réel : `step()` fait avancer l'horloge virtuelle d'une unité et livre ce qui est dû.
 */
export class LoopbackNetwork {
  private now = 0;
  private seq = 0;
  private readonly queue: Pending[] = [];
  private readonly rng: Rng;
  /** Dernière échéance par extrémité destinataire : conserve l'ordre à l'intérieur d'un lien. */
  private readonly lastDue = new Map<LoopbackEnd, number>();

  constructor(seed: number, private readonly minDelay = 0, private readonly maxDelay = 3) {
    this.rng = new Rng(seed);
  }

  /** Crée un lien : retourne ses deux extrémités (A du côté client, B du côté hôte). */
  connect(): { client: Link; host: Link } {
    const a = new LoopbackEnd(this);
    const b = new LoopbackEnd(this);
    a.peer = b;
    b.peer = a;
    return { client: a, host: b };
  }

  /** @internal */
  enqueue(to: LoopbackEnd, message: string): void {
    const delay = this.minDelay + Math.floor(this.rng.next() * (this.maxDelay - this.minDelay + 1));
    const due = Math.max(this.now + delay, this.lastDue.get(to) ?? 0);
    this.lastDue.set(to, due);
    this.queue.push({ due, seq: this.seq++, to, message });
  }

  /** Fait avancer d'une unité et livre tout ce qui est dû (ordre : échéance, puis ordre d'envoi). */
  step(): number {
    this.now++;
    const ready = this.queue.filter((p) => p.due <= this.now).sort((x, y) => x.due - y.due || x.seq - y.seq);
    for (const p of ready) this.queue.splice(this.queue.indexOf(p), 1);
    for (const p of ready) p.to.deliver(p.message);
    return ready.length;
  }

  /** Livre tout ce qui est en vol (plus aucun message en attente). */
  drain(maxSteps = 10_000): void {
    for (let i = 0; i < maxSteps && this.queue.length > 0; i++) this.step();
  }

  get inFlight(): number {
    return this.queue.length;
  }
}

class LoopbackEnd implements Link {
  peer: LoopbackEnd | null = null;
  private handler: ((m: string) => void) | null = null;
  private closeHandler: (() => void) | null = null;
  private closed = false;

  constructor(private readonly net: LoopbackNetwork) {}

  send(message: string): void {
    if (this.closed || !this.peer || this.peer.closed) return;
    this.net.enqueue(this.peer, message);
  }
  onMessage(handler: (m: string) => void): void {
    this.handler = handler;
  }
  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }
  deliver(message: string): void {
    if (!this.closed) this.handler?.(message);
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.closeHandler?.();
    const p = this.peer;
    if (p && !p.closed) {
      p.closed = true;
      p.closeHandler?.();
    }
  }
}
