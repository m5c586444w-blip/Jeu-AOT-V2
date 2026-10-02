import { fnv1a } from "./hash";

/** État sérialisable du RNG : la graine d'origine (pour les forks) et l'état courant. */
export interface RngState {
  seed: number;
  state: number;
}

/**
 * Générateur mulberry32. Le seul aléa autorisé dans src/sim.
 * `fork(label)` dérive de la graine d'ORIGINE et du label (pas de l'état courant) :
 * ajouter un fork ne décale jamais la suite du parent.
 */
export class Rng {
  private s: number;
  private readonly origin: number;

  constructor(seed: number, state?: number) {
    this.origin = seed >>> 0;
    this.s = (state ?? seed) | 0;
  }

  static fromState(st: RngState): Rng {
    return new Rng(st.seed, st.state);
  }

  /** Flottant dans [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Entier dans [min, max] (bornes incluses). */
  int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`Rng.int : bornes invalides [${min}, ${max}]`);
    }
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError("Rng.pick : liste vide");
    return items[this.int(0, items.length - 1)] as T;
  }

  /** Mélange de Fisher-Yates ; renvoie une nouvelle liste. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    return out;
  }

  fork(label: string): Rng {
    return new Rng(fnv1a(`${this.origin}:${label}`));
  }

  serialize(): RngState {
    return { seed: this.origin, state: this.s };
  }
}
