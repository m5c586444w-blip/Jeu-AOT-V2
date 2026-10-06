/**
 * Graine locale de l'essai 3D (R1) : toutes les variations visuelles (ville, teintes, textures, poses) en sortent.
 * Générateur mulberry32 : rapide, 32 bits, même suite pour une même graine. `Math.random` est interdit ici (ESLint).
 */
export type Rand = () => number;

export function seeded(seed: number): Rand {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(r: Rand, a: number, b: number): number {
  return a + (b - a) * r();
}

export function int(r: Rand, a: number, b: number): number {
  return Math.min(b, Math.floor(range(r, a, b + 1)));
}

/** Tirage pondéré : `weights[i]` ≥ 0 ; renvoie l'indice tiré. */
export function weighted(r: Rand, weights: readonly number[]): number {
  const total = weights.reduce((s, w) => s + w, 0);
  let x = r() * total;
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i] ?? 0;
    if (x < 0) return i;
  }
  return weights.length - 1;
}

/** Sous-graine dérivée, pour qu'un ajout d'élément ne décale pas les tirages des autres. */
export function derive(seed: number, salt: number): number {
  return (Math.imul(seed ^ 0x85ebca6b, 0xc2b2ae35) + Math.imul(salt + 1, 0x27d4eb2f)) >>> 0;
}
