import { fnv1a } from "../sim/core/hash";
import { Rng } from "../sim/core/rng";
import type { Point } from "../sim/strategic/geometry";

/** Générateur déterministe par identifiant : le même trait « à la main » à chaque rendu. */
export function rngFor(key: string): Rng {
  return new Rng(fnv1a(key));
}

/**
 * Trait irrégulier : subdivise chaque arête et décale les points perpendiculairement (bruit lissé).
 * `amplitude` et `step` en unités de la carte (km).
 */
export function jitterPath(points: readonly Point[], amplitude: number, step: number, key: string, closed = true): Point[] {
  const rng = rngFor(key);
  const out: Point[] = [];
  const n = points.length;
  const edges = closed ? n : n - 1;
  let drift = 0;
  for (let i = 0; i < edges; i++) {
    const [x0, y0] = points[i] as Point;
    const [x1, y1] = points[(i + 1) % n] as Point;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const parts = Math.max(1, Math.round(len / step));
    const nx = len > 0 ? -(y1 - y0) / len : 0;
    const ny = len > 0 ? (x1 - x0) / len : 0;
    for (let k = 0; k < parts; k++) {
      const t = k / parts;
      drift = drift * 0.6 + (rng.next() - 0.5) * 0.8;
      const a = k === 0 ? 0 : amplitude * drift;
      out.push([x0 + (x1 - x0) * t + nx * a, y0 + (y1 - y0) * t + ny * a]);
    }
  }
  if (!closed) out.push(points[n - 1] as Point);
  return out;
}

/** Aplatissement pour Graphics.poly : [x0, y0, x1, y1, …]. */
export function flat(points: readonly Point[]): number[] {
  const out: number[] = [];
  for (const [x, y] of points) out.push(x, y);
  return out;
}

export function centroid(points: readonly Point[]): Point {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p[0];
    y += p[1];
  }
  return [x / points.length, y / points.length];
}

export function bbox(points: readonly Point[]): [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of points) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return [x0, y0, x1, y1];
}
