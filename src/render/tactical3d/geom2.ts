import type { Vec2 } from "./town";

/**
 * Géométrie plane des générateurs de R1b (terrain, villages, murs) : polygones convexes (découpe, rétrécissement, Voronoï),
 * polylignes (distance, abscisse, lissage). Calcul pur. Repère : x vers l'est, y vers le sud (comme `town.ts`).
 */
export type { Vec2 } from "./town";

export const v2 = (x: number, y: number): Vec2 => ({ x, y });
export const sub2 = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const add2 = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const scale2 = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
export const dot2 = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const len2 = (a: Vec2): number => Math.hypot(a.x, a.y);
export const dist2 = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp2 = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const norm2 = (a: Vec2): Vec2 => scale2(a, 1 / (len2(a) || 1));
export const rot2 = (a: Vec2, ang: number): Vec2 => ({ x: a.x * Math.cos(ang) - a.y * Math.sin(ang), y: a.x * Math.sin(ang) + a.y * Math.cos(ang) });

export function area(poly: readonly Vec2[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i] as Vec2;
    const q = poly[(i + 1) % poly.length] as Vec2;
    s += p.x * q.y - p.y * q.x;
  }
  return s / 2;
}

export function centroid(poly: readonly Vec2[]): Vec2 {
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i] as Vec2;
    const q = poly[(i + 1) % poly.length] as Vec2;
    const c = p.x * q.y - p.y * q.x;
    a += c;
    cx += (p.x + q.x) * c;
    cy += (p.y + q.y) * c;
  }
  if (Math.abs(a) < 1e-9) return poly.reduce((s, p) => add2(s, scale2(p, 1 / poly.length)), v2(0, 0));
  return v2(cx / (3 * a), cy / (3 * a));
}

/** Garde la partie du polygone convexe où `n · p ≥ c` (Sutherland–Hodgman sur un demi-plan). */
export function clipHalfPlane(poly: readonly Vec2[], n: Vec2, c: number): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as Vec2;
    const b = poly[(i + 1) % poly.length] as Vec2;
    const da = dot2(n, a) - c;
    const db = dot2(n, b) - c;
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) out.push(lerp2(a, b, da / (da - db)));
  }
  return out;
}

/** Rétrécit un polygone convexe de `d` mètres vers l'intérieur (intersection des demi-plans décalés). */
export function insetConvex(poly: readonly Vec2[], d: number): Vec2[] {
  const sign = Math.sign(area(poly)) || 1;
  let out: Vec2[] = [...poly];
  for (let i = 0; i < poly.length && out.length >= 3; i++) {
    const a = poly[i] as Vec2;
    const b = poly[(i + 1) % poly.length] as Vec2;
    const e = norm2(sub2(b, a));
    const inward = scale2(v2(-e.y, e.x), sign);
    out = clipHalfPlane(out, inward, dot2(inward, a) + d);
  }
  return out;
}

/** Cellules de Voronoï des sites, découpées dans le carré [−half, half]². */
export function voronoiCells(sites: readonly Vec2[], half: number, reach = Infinity): Vec2[][] {
  const box = [v2(-half, -half), v2(half, -half), v2(half, half), v2(-half, half)];
  return sites.map((s, i) => {
    let cell: Vec2[] = box;
    sites.forEach((o, j) => {
      if (i === j || cell.length < 3 || dist2(s, o) > reach) return;
      const n = sub2(s, o);
      const m = lerp2(s, o, 0.5);
      cell = clipHalfPlane(cell, n, dot2(n, m));
    });
    return cell;
  });
}

/** Point dans un polygone quelconque (règle pair-impair). */
export function insidePoly(poly: readonly Vec2[], p: Vec2): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as Vec2;
    const b = poly[j] as Vec2;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y || 1e-12) + a.x) inside = !inside;
  }
  return inside;
}

export interface Nearest {
  d: number;
  /** Abscisse curviligne du point le plus proche (m depuis le début). */
  s: number;
  /** Indice du segment. */
  i: number;
  /** Point le plus proche. */
  p: Vec2;
}

/** Point le plus proche d'une polyligne. */
export function nearestOnPath(path: readonly Vec2[], p: Vec2): Nearest {
  let best: Nearest = { d: Infinity, s: 0, i: 0, p: path[0] ?? p };
  let acc = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i] as Vec2;
    const b = path[i + 1] as Vec2;
    const ab = sub2(b, a);
    const L = len2(ab);
    const t = Math.max(0, Math.min(1, dot2(sub2(p, a), ab) / (L * L || 1)));
    const q = lerp2(a, b, t);
    const d = dist2(p, q);
    if (d < best.d) best = { d, s: acc + t * L, i, p: q };
    acc += L;
  }
  return best;
}

export function pathLength(path: readonly Vec2[]): number {
  let s = 0;
  for (let i = 0; i + 1 < path.length; i++) s += dist2(path[i] as Vec2, path[i + 1] as Vec2);
  return s;
}

/** Point à l'abscisse `s` d'une polyligne, et direction locale. */
export function pointAt(path: readonly Vec2[], s: number): { p: Vec2; dir: Vec2 } {
  let acc = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i] as Vec2;
    const b = path[i + 1] as Vec2;
    const L = dist2(a, b);
    if (acc + L >= s || i + 2 === path.length) {
      const t = L > 0 ? Math.max(0, Math.min(1, (s - acc) / L)) : 0;
      return { p: lerp2(a, b, t), dir: norm2(sub2(b, a)) };
    }
    acc += L;
  }
  const p = path[0] ?? v2(0, 0);
  return { p, dir: v2(1, 0) };
}

/** Rééchantillonne une polyligne à pas constant. */
export function resample(path: readonly Vec2[], step: number): Vec2[] {
  const L = pathLength(path);
  const n = Math.max(1, Math.round(L / step));
  return Array.from({ length: n + 1 }, (_, i) => pointAt(path, (i / n) * L).p);
}

/** Lissage de Chaikin (coins arrondis), extrémités conservées. */
export function chaikin(path: readonly Vec2[], iterations = 2): Vec2[] {
  let out = [...path];
  for (let k = 0; k < iterations; k++) {
    const next: Vec2[] = [out[0] as Vec2];
    for (let i = 0; i + 1 < out.length; i++) {
      const a = out[i] as Vec2;
      const b = out[i + 1] as Vec2;
      next.push(lerp2(a, b, 0.25), lerp2(a, b, 0.75));
    }
    next.push(out[out.length - 1] as Vec2);
    out = next;
  }
  return out;
}

/** Intersection de deux segments [a, b] et [c, d] (point, ou null). */
export function segmentIntersection(a: Vec2, b: Vec2, c: Vec2, d: Vec2): Vec2 | null {
  const r = sub2(b, a);
  const s = sub2(d, c);
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? add2(a, scale2(r, t)) : null;
}

/** Croisements entre deux polylignes. */
export function pathCrossings(p: readonly Vec2[], q: readonly Vec2[]): { at: Vec2; i: number; j: number }[] {
  const out: { at: Vec2; i: number; j: number }[] = [];
  for (let i = 0; i + 1 < p.length; i++) {
    for (let j = 0; j + 1 < q.length; j++) {
      const at = segmentIntersection(p[i] as Vec2, p[i + 1] as Vec2, q[j] as Vec2, q[j + 1] as Vec2);
      if (at) out.push({ at, i, j });
    }
  }
  return out;
}
