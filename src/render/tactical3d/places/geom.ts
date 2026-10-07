/**
 * Géométrie plane des lieux (R1e) : points en tuples [x, y] (m ; x vers l'est, y vers le sud), comme `data/places/*.json`.
 * Calcul pur, sans three.js ni DOM : utilisé par la mise en place, les mesures, les plans SVG et les tests.
 */
export type P2 = readonly [number, number];
export type Poly2 = readonly P2[];

export const sub = (a: P2, b: P2): [number, number] => [a[0] - b[0], a[1] - b[1]];
export const add = (a: P2, b: P2): [number, number] => [a[0] + b[0], a[1] + b[1]];
export const mul = (a: P2, k: number): [number, number] => [a[0] * k, a[1] * k];
export const dot = (a: P2, b: P2): number => a[0] * b[0] + a[1] * b[1];
export const cross = (a: P2, b: P2): number => a[0] * b[1] - a[1] * b[0];
export const len = (a: P2): number => Math.hypot(a[0], a[1]);
export const dist = (a: P2, b: P2): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const unit = (a: P2): [number, number] => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};
export const lerp = (a: P2, b: P2, t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** Normale à gauche d'une direction (rotation de +90° dans le repère x, y). */
export const left = (d: P2): [number, number] => [-d[1], d[0]];
export const deg = (r: number): number => (r * 180) / Math.PI;
export const rad = (d: number): number => (d * Math.PI) / 180;

/** Aire signée (formule du lacet) : positive si l'intérieur est à gauche des arêtes. */
export function signedArea(poly: Poly2): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i] as P2;
    const q = poly[(i + 1) % poly.length] as P2;
    s += p[0] * q[1] - p[1] * q[0];
  }
  return s / 2;
}
export const area = (poly: Poly2): number => Math.abs(signedArea(poly));

/** Même polygone, intérieur à gauche des arêtes (aire signée positive). */
export function ccw(poly: Poly2): P2[] {
  return signedArea(poly) >= 0 ? [...poly] : [...poly].reverse();
}

export function centroid(poly: Poly2): [number, number] {
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i] as P2;
    const q = poly[(i + 1) % poly.length] as P2;
    const c = p[0] * q[1] - p[1] * q[0];
    a += c;
    cx += (p[0] + q[0]) * c;
    cy += (p[1] + q[1]) * c;
  }
  if (Math.abs(a) < 1e-9) return mul(poly.reduce<[number, number]>((s, p) => add(s, p), [0, 0]), 1 / poly.length);
  return [cx / (3 * a), cy / (3 * a)];
}

export function bbox(pts: Poly2): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

/** Point dans un polygone (règle pair-impair). */
export function inside(poly: Poly2, p: P2): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as P2;
    const b = poly[j] as P2;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

/** Polygone convexe (tolérance angulaire `eps` en radians pour les sommets presque alignés) ? */
export function isConvex(poly: Poly2, eps = 1e-3): boolean {
  const s = Math.sign(signedArea(poly));
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as P2;
    const b = poly[(i + 1) % poly.length] as P2;
    const c = poly[(i + 2) % poly.length] as P2;
    const t = cross(unit(sub(b, a)), unit(sub(c, b)));
    if (t * s < -eps) return false;
  }
  return true;
}

/** Garde la partie d'un polygone convexe où `n · p ≥ c`. */
export function clipHalf(poly: Poly2, n: P2, c: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as P2;
    const b = poly[(i + 1) % poly.length] as P2;
    const da = dot(n, a) - c;
    const db = dot(n, b) - c;
    if (da >= 0) out.push([a[0], a[1]]);
    if (da >= 0 !== db >= 0) out.push(lerp(a, b, da / (da - db)));
  }
  return out;
}

/** Rétrécit un polygone convexe de `d` m (intersection des demi-plans décalés vers l'intérieur). */
export function inset(poly: Poly2, d: number): [number, number][] {
  const p = ccw(poly);
  let out: [number, number][] = p.map((q) => [q[0], q[1]]);
  for (let i = 0; i < p.length && out.length >= 3; i++) {
    const a = p[i] as P2;
    const b = p[(i + 1) % p.length] as P2;
    const n = left(unit(sub(b, a)));
    out = clipHalf(out, n, dot(n, a) + d);
  }
  return out;
}

// ——— Polylignes ———

export function polylineLength(line: Poly2): number {
  let s = 0;
  for (let i = 1; i < line.length; i++) s += dist(line[i - 1] as P2, line[i] as P2);
  return s;
}

/** Point et direction unitaire à l'abscisse `s` (m) d'une polyligne (bornée à ses extrémités). */
export function along(line: Poly2, s: number): { p: [number, number]; d: [number, number] } {
  let rest = Math.max(0, s);
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1] as P2;
    const b = line[i] as P2;
    const l = dist(a, b);
    if (rest <= l || i === line.length - 1) return { p: lerp(a, b, l > 0 ? Math.min(1, rest / l) : 0), d: unit(sub(b, a)) };
    rest -= l;
  }
  const a = line[0] as P2;
  return { p: [a[0], a[1]], d: [1, 0] };
}

/** Distance d'un point à un segment, et paramètre du projeté (0–1). */
export function segDist(p: P2, a: P2, b: P2): { d: number; t: number } {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  const t = l2 > 0 ? Math.min(1, Math.max(0, dot(sub(p, a), ab) / l2)) : 0;
  return { d: dist(p, add(a, mul(ab, t))), t };
}

export function polylineDist(p: P2, line: Poly2): number {
  let d = Infinity;
  for (let i = 1; i < line.length; i++) d = Math.min(d, segDist(p, line[i - 1] as P2, line[i] as P2).d);
  return d;
}

/** Rectangle orienté (centre, demi-dimensions le long de `u` et de sa normale) en polygone. */
export function rectPoly(c: P2, u: P2, hw: number, hd: number): [number, number][] {
  const n = left(u);
  return [add(add(c, mul(u, -hw)), mul(n, -hd)), add(add(c, mul(u, hw)), mul(n, -hd)), add(add(c, mul(u, hw)), mul(n, hd)), add(add(c, mul(u, -hw)), mul(n, hd))];
}

/** Deux polygones convexes se recouvrent-ils (axes séparateurs) ? `margin` > 0 tolère un contact. */
export function convexOverlap(a: Poly2, b: Poly2, margin = 0): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i] as P2;
      const q = poly[(i + 1) % poly.length] as P2;
      const n = left(unit(sub(q, p)));
      let a0 = Infinity;
      let a1 = -Infinity;
      let b0 = Infinity;
      let b1 = -Infinity;
      for (const v of a) {
        const x = dot(n, v);
        a0 = Math.min(a0, x);
        a1 = Math.max(a1, x);
      }
      for (const v of b) {
        const x = dot(n, v);
        b0 = Math.min(b0, x);
        b1 = Math.max(b1, x);
      }
      if (a1 <= b0 + margin || b1 <= a0 + margin) return false;
    }
  }
  return true;
}

// ——— Suites déterministes (pas d'aléa : choix d'auteur, répartition régulière) ———

/** Suite de Halton (base b), pour des semis réguliers sans grille visible. */
export function halton(i: number, b: number): number {
  let f = 1;
  let r = 0;
  let k = i;
  while (k > 0) {
    f /= b;
    r += f * (k % b);
    k = Math.floor(k / b);
  }
  return r;
}

/** Empreinte stable d'une chaîne (FNV-1a 32 bits). */
export function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Élément `i` d'une suite d'auteur, parcourue en boucle. */
export const cycle = <T>(xs: readonly T[], i: number): T => xs[((i % xs.length) + xs.length) % xs.length] as T;
