import type { Rng } from "../core/rng";

/** Lois de tirage utilisées par l'auto-résolution (03 §12 : distribution large, queues épaisses). Toutes passent par le Rng injecté. */

/** Loi normale centrée réduite (Box-Muller). */
export function gaussian(rng: Rng): number {
  const u = Math.max(rng.next(), 1e-12);
  const v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Loi de Poisson (méthode de Knuth ; λ modéré). */
export function poisson(rng: Rng, lambda: number): number {
  if (!(lambda > 0)) return 0;
  if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * gaussian(rng)));
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng.next();
  } while (p > limit);
  return k - 1;
}

/** Loi log-normale de médiane `median` et d'écart logarithmique `sigma` (queue droite épaisse). */
export function lognormal(rng: Rng, median: number, sigma: number): number {
  return median * Math.exp(sigma * gaussian(rng));
}

/** Tirage pondéré dans une liste de paires [valeur, poids]. */
export function weighted<T>(rng: Rng, items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((s, [, w]) => s + Math.max(0, w), 0);
  if (items.length === 0 || total <= 0) throw new RangeError("weighted : aucun poids positif");
  let r = rng.next() * total;
  for (const [v, w] of items) {
    r -= Math.max(0, w);
    if (r < 0) return v;
  }
  return (items[items.length - 1] as readonly [T, number])[0];
}

/** Uniforme dans [a, b]. */
export function uniform(rng: Rng, a: number, b: number): number {
  return a + (b - a) * rng.next();
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
