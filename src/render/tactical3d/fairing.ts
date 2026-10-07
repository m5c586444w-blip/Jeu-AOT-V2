/**
 * R1d : carénage d'une zone de peau (plaque mince le long de la normale), sans dépendance au moteur 3D : utilisé à la
 * construction du corps de base (`assets:build`, mamelons et entrejambe) et pour le contrôler (`humanBase.zoneRelief`).
 */
export type V3 = [number, number, number];
export type CotWeights = Map<number, Map<number, number>>;

/**
 * Poids cotangents d'un maillage triangulé (arêtes de bord comprises) ; un poids négatif (angle obtus) est ramené à une petite
 * valeur positive. Ils donnent un laplacien qui suit la géométrie et non la densité du maillage (rangées serrées autour du
 * mamelon).
 */
export function cotangentWeights(tris: Iterable<readonly [number, number, number]>, P: (v: number) => V3): CotWeights {
  const w = new Map<number, Map<number, number>>();
  const add = (a: number, b: number, x: number): void => {
    for (const [p, q] of [
      [a, b],
      [b, a],
    ] as const) {
      const m = w.get(p) ?? new Map<number, number>();
      m.set(q, (m.get(q) ?? 0) + x);
      w.set(p, m);
    }
  };
  const cot = (o: V3, a: V3, b: V3): number => {
    const u: V3 = [a[0] - o[0], a[1] - o[1], a[2] - o[2]];
    const v: V3 = [b[0] - o[0], b[1] - o[1], b[2] - o[2]];
    const d = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    const c = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
    return c > 1e-12 ? d / c : 0;
  };
  for (const [a, b, c] of tris) {
    const [pa, pb, pc] = [P(a), P(b), P(c)];
    add(b, c, cot(pa, pb, pc) / 2);
    add(c, a, cot(pb, pc, pa) / 2);
    add(a, b, cot(pc, pa, pb) / 2);
  }
  for (const m of w.values()) for (const [k, x] of m) m.set(k, Math.max(x, 0.01));
  return w;
}

/**
 * Hauteurs h (le long de `normal(v)`, unitaire) qui carènent la zone : x = x₀ + N·h, h minimisant Σ |L x|² (L : laplacien
 * cotangent normalisé) sur les sommets dont le laplacien touche la zone, le reste fixé (deux couronnes : bord en position et en
 * pente) ; gradient conjugué sur (Mᵀ M) h = −Mᵀ L x₀ avec M = L N. Seule la hauteur bouge (pas de glissement le long de la
 * peau) ; x₀ ↦ h est linéaire à normales fixées. Arrêt quand le résidu a baissé d'un facteur 10⁹ (ou après `maxIter` pas).
 */
export function fairHeights(x: (v: number, c: number) => number, zone: readonly number[], cotW: CotWeights, normal: (v: number) => V3, maxIter = 2000): Float64Array {
  const inZone = new Map(zone.map((v, k) => [v, k] as const));
  const touched = new Set<number>(zone);
  for (const v of zone) for (const n of cotW.get(v)?.keys() ?? []) touched.add(n);
  const S = [...touched].sort((a, b) => a - b);
  const nrm = zone.map(normal);
  const wOf = (v: number): Map<number, number> => cotW.get(v) ?? new Map<number, number>();
  const wSum = new Map(S.map((v) => [v, [...wOf(v).values()].reduce((a, b) => a + b, 0) || 1] as const));
  /** L f (vecteurs) sur S. */
  const L = (f: (v: number, c: number) => number): Map<number, V3> => {
    const out = new Map<number, V3>();
    for (const v of S) {
      const r: V3 = [0, 0, 0];
      const sw = wSum.get(v) as number;
      for (let c = 0; c < 3; c++) {
        let m = 0;
        for (const [n, w] of wOf(v)) m += w * f(n, c);
        r[c] = m / sw - f(v, c);
      }
      out.set(v, r);
    }
    return out;
  };
  /** Mᵀ g = Nᵀ Lᵀ g, sur la zone. */
  const MT = (g: Map<number, V3>): Float64Array => {
    const lt = new Map<number, V3>();
    const add = (v: number, k: number, y: V3): void => {
      if (!inZone.has(v)) return;
      const s = lt.get(v) ?? [0, 0, 0];
      lt.set(v, [s[0] + k * y[0], s[1] + k * y[1], s[2] + k * y[2]]);
    };
    for (const v of S) {
      const gv = g.get(v) ?? [0, 0, 0];
      add(v, -1, gv);
      const sw = wSum.get(v) as number;
      for (const [n, w] of wOf(v)) add(n, w / sw, gv);
    }
    return Float64Array.from(zone, (v, k) => {
      const y = lt.get(v) ?? [0, 0, 0];
      const n = nrm[k] as V3;
      return y[0] * n[0] + y[1] * n[1] + y[2] * n[2];
    });
  };
  const along =
    (h: Float64Array) =>
    (v: number, c: number): number => {
      const k = inZone.get(v);
      return k === undefined ? 0 : (h[k] as number) * ((nrm[k] as V3)[c] as number);
    };
  const dot = (a: Float64Array, b: Float64Array): number => a.reduce((s, y, i) => s + y * (b[i] as number), 0);
  const h = new Float64Array(zone.length);
  const b = MT(L(x)).map((y) => -y);
  if (dot(b, b) < 1e-24) return h;
  const r = Float64Array.from(b);
  const d = Float64Array.from(r);
  let rr = dot(r, r);
  const stop = rr * 1e-18;
  for (let it = 0; it < maxIter && rr > stop; it++) {
    const Ad = MT(L(along(d)));
    const alpha = rr / dot(d, Ad);
    for (let i = 0; i < h.length; i++) {
      h[i] = (h[i] as number) + alpha * (d[i] as number);
      r[i] = (r[i] as number) - alpha * (Ad[i] as number);
    }
    const rr2 = dot(r, r);
    for (let i = 0; i < d.length; i++) d[i] = (r[i] as number) + (rr2 / rr) * (d[i] as number);
    rr = rr2;
  }
  return h;
}
