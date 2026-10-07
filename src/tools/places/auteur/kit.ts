import type { P2, Poly2 } from "../../../render/tactical3d/places/geom";
import { area, ccw, centroid, clipHalf, dot, left, sub, unit } from "../../../render/tactical3d/places/geom";

/**
 * Outils des plans d'auteur (R1e) : points polaires, îlots entre rues rayonnantes et anneaux, rues retranchées de chaque
 * rive selon leur largeur, découpe par une voie d'eau. Calcul pur ; tout est arrondi au décimètre (fichiers compacts).
 * Angles en degrés, 0 = est, sens horaire sur le plan (y vers le sud) : 90 = sud.
 */
export const r1 = (x: number): number => Math.round(x * 10) / 10;
export const pt = (x: number, y: number): [number, number] => [r1(x), r1(y)];
export const polar = (r: number, deg: number, c: P2 = [0, 0]): [number, number] => pt(c[0] + r * Math.cos((deg * Math.PI) / 180), c[1] + r * Math.sin((deg * Math.PI) / 180));
export const roundPoly = (p: Poly2): [number, number][] => p.map((q) => pt(q[0], q[1]));

/** Polyligne d'un anneau de rayon r, de a0 à a1 (degrés), sommets aux angles donnés (rues polygonales, pas d'arcs). */
export function ringLine(r: number, angles: readonly number[]): [number, number][] {
  return angles.map((a) => polar(r, a));
}

export interface Cell {
  /** Quadrilatère (convexe) entre deux anneaux et deux rayons. */
  poly: [number, number][];
  r0: number;
  r1: number;
  a0: number;
  a1: number;
  ring: number;
}

/**
 * Cellules entre anneaux successifs `rings` et rayons `angles(r0)` (liste d'angles valable pour l'anneau intérieur de la
 * cellule) : quadrilatères à cordes.
 */
export function radialCells(rings: readonly number[], anglesFor: (r0: number) => readonly number[]): Cell[] {
  const out: Cell[] = [];
  for (let k = 0; k + 1 < rings.length; k++) {
    const r0 = rings[k] as number;
    const rr = rings[k + 1] as number;
    const as = anglesFor(r0);
    for (let i = 0; i + 1 < as.length; i++) {
      const a0 = as[i] as number;
      const a1 = as[i + 1] as number;
      out.push({ poly: [polar(r0, a0), polar(r0, a1), polar(rr, a1), polar(rr, a0)], r0, r1: rr, a0, a1, ring: k });
    }
  }
  return out;
}

/**
 * Retranche chaque rive d'un polygone convexe de sa propre distance, donnée par `dOf(a, b)` (demi-largeur de la rue qui borde
 * la rive a → b, plus un trottoir).
 */
export function insetBy(poly: Poly2, dOf: (a: P2, b: P2) => number): [number, number][] {
  const p = ccw(poly);
  let out: [number, number][] = p.map((q) => [q[0], q[1]]);
  for (let i = 0; i < p.length && out.length >= 3; i++) {
    const a = p[i] as P2;
    const b = p[(i + 1) % p.length] as P2;
    const n = left(unit(sub(b, a)));
    out = clipHalf(out, n, dot(n, a) + dOf(a, b));
  }
  return out;
}

/** Parties d'un polygone convexe hors d'une bande de demi-largeur `hw` autour du segment a → b (prolongé) : 0, 1 ou 2 pièces. */
export function outsideStrip(poly: Poly2, a: P2, b: P2, hw: number): [number, number][][] {
  const n = left(unit(sub(b, a)));
  const c = dot(n, a);
  const pieces = [clipHalf(poly, n, c + hw), clipHalf(poly, [-n[0], -n[1]], -c + hw)];
  return pieces.filter((q) => q.length >= 3 && area(q) > 1);
}

/** Le polygone touche-t-il la bande autour du segment a → b (borné au segment, avec `margin`) ? */
export function touchesSegment(poly: Poly2, a: P2, b: P2, hw: number): boolean {
  const ab = sub(b, a);
  const L2 = dot(ab, ab);
  const c = centroid(poly);
  for (const q of [...poly, c]) {
    const t = Math.max(0, Math.min(1, dot(sub(q, a), ab) / L2));
    const px = a[0] + ab[0] * t;
    const py = a[1] + ab[1] * t;
    if (Math.hypot(q[0] - px, q[1] - py) < hw) return true;
  }
  // Segment qui traverse le polygone sans qu'un sommet soit près : test des deux demi-plans.
  const n = left(unit(ab));
  const s = poly.map((q) => dot(n, q) - dot(n, a));
  const along = poly.map((q) => dot(sub(q, a), ab) / L2);
  return Math.min(...s) < 0 && Math.max(...s) > 0 && Math.max(...along) > 0 && Math.min(...along) < 1;
}

/** Angles réguliers de a0 à a1 (inclus) par pas `step`, avec décalages d'auteur `shift` (degrés, par indice). */
export function angles(a0: number, a1: number, step: number, shift: Record<number, number> = {}): number[] {
  const out: number[] = [];
  const n = Math.round((a1 - a0) / step);
  for (let i = 0; i <= n; i++) out.push(a0 + i * step + (i > 0 && i < n ? (shift[i] ?? 0) : 0));
  return out;
}
