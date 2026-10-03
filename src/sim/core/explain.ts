/**
 * Valeurs expliquées (pilier « toute valeur affichée doit pouvoir être expliquée », 00 §5).
 * Le calcul se fait EN construisant l'explication : la valeur et ses facteurs ne peuvent pas diverger.
 */
export type FactorOp = "base" | "add" | "mul";

export interface Factor {
  /** Clé i18n du libellé (ex. « why.season »). */
  key: string;
  params?: Readonly<Record<string, string | number>>;
  op: FactorOp;
  /** base / add : quantité ajoutée ; mul : coefficient. */
  value: number;
}

export interface Explained {
  value: number;
  factors: Factor[];
}

export class Explainer {
  private v = 0;
  private readonly list: Factor[] = [];

  base(key: string, value: number, params?: Factor["params"]): this {
    this.v += value;
    this.list.push({ key, op: "base", value, ...(params ? { params } : {}) });
    return this;
  }

  add(key: string, value: number, params?: Factor["params"]): this {
    if (value === 0) return this;
    this.v += value;
    this.list.push({ key, op: "add", value, ...(params ? { params } : {}) });
    return this;
  }

  mul(key: string, factor: number, params?: Factor["params"]): this {
    if (factor === 1) return this;
    this.v *= factor;
    this.list.push({ key, op: "mul", value: factor, ...(params ? { params } : {}) });
    return this;
  }

  get value(): number {
    return this.v;
  }

  done(): Explained {
    return { value: this.v, factors: this.list.slice() };
  }
}

/** Recalcule une valeur à partir de ses facteurs (sert aux tests de cohérence). */
export function replayFactors(factors: readonly Factor[]): number {
  return factors.reduce((v, f) => (f.op === "mul" ? v * f.value : v + f.value), 0);
}

export function constant(key: string, value: number, params?: Factor["params"]): Explained {
  return new Explainer().base(key, value, params).done();
}
