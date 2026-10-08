import { fnv1a } from "../../sim/core/hash";

/** Bruit de valeur 2D déterministe (hachage entier), lissé ; valeurs dans [0, 1). */
function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ seed;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

export function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Somme fractale centrée sur 0 (≈ [-1, 1]). */
export function fbm(x: number, y: number, seed: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += (valueNoise(x * f, y * f, seed + o * 1013) * 2 - 1) * amp;
    norm += amp;
    amp *= gain;
    f *= lacunarity;
  }
  return sum / norm;
}

/** Bruit en crêtes (montagnes) dans [0, 1]. */
export function ridged(x: number, y: number, seed: number, octaves = 4): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(valueNoise(x * f, y * f, seed + o * 7919) * 2 - 1);
    sum += n * n * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

/** Bruit périodique sur le cercle : relèvement en degrés, `freq` ondulations par tour environ. */
export function circleNoise(bearing: number, freq: number, key: string, octaves = 3): number {
  const b = (bearing * Math.PI) / 180;
  const r = freq / (2 * Math.PI);
  return fbm(Math.cos(b) * r + 50, Math.sin(b) * r + 50, fnv1a(key), octaves);
}

/** Bruit 1D le long d'une coordonnée (km), clé stable. */
export function lineNoise(t: number, wavelength: number, key: string, octaves = 3): number {
  return fbm(t / wavelength, 0.5, fnv1a(key), octaves);
}

export const seedOf = (key: string): number => fnv1a(key);
