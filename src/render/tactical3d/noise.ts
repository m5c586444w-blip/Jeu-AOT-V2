import { seeded } from "./rng";

/**
 * Bruit de gradient 2D par graine (R1b.2), à la manière de Perlin : relief, masques de forêt, nuances de sol.
 * Calcul pur ; table de permutation tirée de la graine locale (jamais `Math.random`).
 */
export type Noise2 = (x: number, y: number) => number;

export function gradientNoise(seed: number): Noise2 {
  const rand = seeded(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j] as number, p[i] as number];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255] as number;
  // 8 directions de gradient.
  const gx = [1, -1, 1, -1, Math.SQRT1_2, -Math.SQRT1_2, Math.SQRT1_2, -Math.SQRT1_2];
  const gy = [0, 0, 1, -1, Math.SQRT1_2, Math.SQRT1_2, -Math.SQRT1_2, -Math.SQRT1_2];
  const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h: number, x: number, y: number): number => {
    const k = h & 7;
    return (gx[k] as number) * x + (gy[k] as number) * y;
  };
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const X = xi & 255;
    const Y = yi & 255;
    const aa = perm[(perm[X] as number) + Y] as number;
    const ab = perm[(perm[X] as number) + Y + 1] as number;
    const ba = perm[(perm[X + 1] as number) + Y] as number;
    const bb = perm[(perm[X + 1] as number) + Y + 1] as number;
    const u = fade(xf);
    const v = fade(yf);
    const x1 = grad(aa, xf, yf) + u * (grad(ba, xf - 1, yf) - grad(aa, xf, yf));
    const x2 = grad(ab, xf, yf - 1) + u * (grad(bb, xf - 1, yf - 1) - grad(ab, xf, yf - 1));
    // Amplitude ramenée vers [−1, 1].
    return (x1 + v * (x2 - x1)) * 1.42;
  };
}

/** Somme fractale : `octaves` couches, fréquence × `lacunarity`, amplitude × `gain` ; résultat normalisé vers [−1, 1]. */
export function fbm(noise: Noise2, x: number, y: number, octaves = 5, lacunarity = 2, gain = 0.5): number {
  let a = 1;
  let f = 1;
  let s = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    s += a * noise(x * f + i * 17.3, y * f - i * 9.1);
    norm += a;
    a *= gain;
    f *= lacunarity;
  }
  return s / norm;
}

/** Bruit « en crêtes » (montagnes) : 1 − |n|, accentué ; résultat dans [0, 1]. */
export function ridged(noise: Noise2, x: number, y: number, octaves = 5): number {
  let a = 1;
  let f = 1;
  let s = 0;
  let norm = 0;
  let w = 1;
  for (let i = 0; i < octaves; i++) {
    let n = 1 - Math.abs(noise(x * f + i * 31.7, y * f + i * 5.3));
    n *= n * w;
    w = Math.min(1, Math.max(0, n * 1.6));
    s += a * n;
    norm += a;
    a *= 0.5;
    f *= 2.05;
  }
  return s / norm;
}

export const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a || 1)));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (x: number, a: number, b: number): number => Math.min(b, Math.max(a, x));
