import { BIOME } from "../../data/terrain";
import type { TerrainData } from "../../data/terrain";
import { fnv1a } from "../../sim/core/hash";
import { pointInPolygon, polar } from "../../sim/strategic/geometry";
import type { Point } from "../../sim/strategic/geometry";
import { DrawLayout } from "./layout";
import type { DrawLayoutOptions, Layout } from "./layout";
import { fbm, ridged, seedOf, valueNoise } from "./noise";

/**
 * Générateur de la carte réaliste (MAP.1, MAP.2) : déterministe, sans horloge ni aléa extérieur.
 * Entrées : la disposition des anneaux (data/map/paradis.layout.json), les provinces (terrain, population),
 * le voisinage des données (data/map/paradis.json) pour contrôle. Sortie : TerrainData (sans le hash).
 */
export interface ProvinceDef {
  id: string;
  atlas_code: string;
  terrain: string;
  kind: string;
  pop_level: number;
  region: string;
}

export const OPTIONS: DrawLayoutOptions = {
  seed: "paradis-v1",
  axisEW: 598,
  axisNS: 688,
  // Caps et baies [A] : forme originale, aucun tracé de l'œuvre.
  features: [
    { bearing: 38, width: 7, km: 42 },
    { bearing: 96, width: 8, km: -38 },
    { bearing: 128, width: 5, km: 30 },
    { bearing: 172, width: 10, km: -26 },
    { bearing: 232, width: 6, km: 52 },
    { bearing: 268, width: 9, km: -30 },
    { bearing: 312, width: 7, km: -34 },
    { bearing: 345, width: 5, km: 28 },
  ],
  coastMin: 562,
  coastMax: 702,
};

const N = 384;
const BOUND = 740;
const CELL = (2 * BOUND) / N;
const SEA_LEVEL = 64;
const ISLETS = [
  { bearing: 74, out: 34, r: 10 },
  { bearing: 104, out: 26, r: 6 },
  { bearing: 252, out: 30, r: 8 },
  { bearing: 288, out: 24, r: 5 },
  { bearing: 296, out: 40, r: 4 },
];

/** Altitude de base (0 = niveau de la mer, 1 = sommets) selon le terrain de la province (données). */
function terrainBias(terrain: string): { base: number; relief: number } {
  switch (terrain) {
    case "montagne": return { base: 0.5, relief: 0.45 };
    case "plateau": return { base: 0.38, relief: 0.2 };
    case "collines": return { base: 0.3, relief: 0.22 };
    case "vallee": return { base: 0.2, relief: 0.18 };
    case "foret": return { base: 0.2, relief: 0.08 };
    case "marais": return { base: 0.035, relief: 0.01 };
    case "lac": return { base: 0.12, relief: 0.04 };
    case "fleuve": return { base: 0.09, relief: 0.05 };
    case "cote": return { base: 0.16, relief: 0.08 };
    case "mur": return { base: 0.13, relief: 0.03 };
    default: return { base: 0.13, relief: 0.05 };
  }
}

const clamp = (v: number, a = 0, b = 1): number => Math.max(a, Math.min(b, v));
const smoothstep = (a: number, b: number, v: number): number => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const round = (v: number): number => Math.round(v * 10) / 10;
const bearingOf = (x: number, y: number): number => ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360;
const cellCenter = (i: number): number => -BOUND + (i + 0.5) * CELL;

function blur(src: Float32Array, radius: number, passes: number): Float32Array {
  let a = src;
  for (let p = 0; p < passes; p++) {
    const b = new Float32Array(N * N);
    for (let y = 0; y < N; y++) {
      let acc = 0;
      let cnt = 0;
      for (let x = -radius; x < N + radius; x++) {
        if (x + radius < N) {
          acc += a[y * N + x + radius] ?? 0;
          cnt++;
        }
        if (x - radius - 1 >= 0) {
          acc -= a[y * N + x - radius - 1] ?? 0;
          cnt--;
        }
        if (x >= 0 && x < N) b[y * N + x] = acc / cnt;
      }
    }
    const c = new Float32Array(N * N);
    for (let x = 0; x < N; x++) {
      let acc = 0;
      let cnt = 0;
      for (let y = -radius; y < N + radius; y++) {
        if (y + radius < N) {
          acc += b[(y + radius) * N + x] ?? 0;
          cnt++;
        }
        if (y - radius - 1 >= 0) {
          acc -= b[(y - radius - 1) * N + x] ?? 0;
          cnt--;
        }
        if (y >= 0 && y < N) c[y * N + x] = acc / cnt;
      }
    }
    a = c;
  }
  return a;
}

/** Lissage de Chaikin d'une polyligne ouverte. */
function chaikin(pts: Point[], iterations: number): Point[] {
  let p = pts;
  for (let k = 0; k < iterations; k++) {
    if (p.length < 3) return p;
    const out: Point[] = [p[0] as Point];
    for (let i = 0; i < p.length - 1; i++) {
      const [x0, y0] = p[i] as Point;
      const [x1, y1] = p[i + 1] as Point;
      out.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25], [x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
    }
    out.push(p[p.length - 1] as Point);
    p = out;
  }
  return p;
}

function segIntersect(a: Point, b: Point, c: Point, d: Point): Point | null {
  const r = [b[0] - a[0], b[1] - a[1]];
  const s = [d[0] - c[0], d[1] - c[1]];
  const den = (r[0] ?? 0) * (s[1] ?? 0) - (r[1] ?? 0) * (s[0] ?? 0);
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * (s[1] ?? 0) - (c[1] - a[1]) * (s[0] ?? 0)) / den;
  const u = ((c[0] - a[0]) * (r[1] ?? 0) - (c[1] - a[1]) * (r[0] ?? 0)) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + t * (r[0] ?? 0), a[1] + t * (r[1] ?? 0)] : null;
}

/** Voisinage dessiné : deux polygones partagent une frontière, pas seulement un coin. */
export function drawnNeighbors(polys: Record<string, Point[]>, tolerance = 0.35): Record<string, string[]> {
  const ids = Object.keys(polys).sort();
  const boxes = new Map(ids.map((id) => {
    const p = polys[id] ?? [];
    return [id, [Math.min(...p.map((q) => q[0])), Math.min(...p.map((q) => q[1])), Math.max(...p.map((q) => q[0])), Math.max(...p.map((q) => q[1]))] as const];
  }));
  const onEdge = (pt: Point, poly: Point[]): boolean => {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i] as Point;
      const b = poly[(i + 1) % poly.length] as Point;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len2 = dx * dx + dy * dy;
      const t = len2 === 0 ? 0 : clamp(((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / len2);
      if (Math.hypot(a[0] + t * dx - pt[0], a[1] + t * dy - pt[1]) <= tolerance) return true;
    }
    return false;
  };
  const out: Record<string, string[]> = Object.fromEntries(ids.map((id) => [id, [] as string[]]));
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i] as string;
      const b = ids[j] as string;
      const ba = boxes.get(a);
      const bb = boxes.get(b);
      if (!ba || !bb || ba[0] > bb[2] + 1 || bb[0] > ba[2] + 1 || ba[1] > bb[3] + 1 || bb[1] > ba[3] + 1) continue;
      const pa = polys[a] ?? [];
      const pb = polys[b] ?? [];
      // Frontière commune : arêtes de l'un posées sur l'autre, sur plus de 3 km (un simple coin ne compte pas).
      let length = 0;
      for (let k = 0; k < pa.length; k++) {
        const p = pa[k] as Point;
        const q = pa[(k + 1) % pa.length] as Point;
        if (onEdge(p, pb) && onEdge(q, pb) && onEdge([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], pb)) length += Math.hypot(q[0] - p[0], q[1] - p[1]);
      }
      if (length > 3) {
        out[a]?.push(b);
        out[b]?.push(a);
      }
    }
  }
  for (const id of ids) out[id]?.sort();
  return out;
}

export function generateTerrain(layout: Layout, provinces: readonly ProvinceDef[], dataNeighbors: Record<string, string[]>): Omit<TerrainData, "hash"> {
  const draw = new DrawLayout(layout, OPTIONS);
  const S = OPTIONS.seed;
  const byCode = new Map(provinces.map((p) => [p.atlas_code, p]));
  const byId = new Map(provinces.map((p) => [p.id, p]));

  // ——— Provinces (MAP.2) ———
  const polys: Record<string, Point[]> = {};
  const anchors: Record<string, Point> = {};
  const pawns: Record<string, Point> = {};
  const sectorOf: Record<string, { ring: Layout["rings"][number]; from: number; to: number }> = {};
  for (const ring of layout.rings) {
    for (const [code, from, to] of ring.sectors) {
      const p = byCode.get(code);
      if (!p) throw new Error(`code d'atlas inconnu : ${code}`);
      polys[p.id] = draw.sector(ring, from, to);
      sectorOf[p.id] = { ring, from, to };
      const segment = p.kind === "segment";
      anchors[p.id] = segment ? draw.inside(ring, from, to, 0.5) : draw.inside(ring, from, to, ring.r_from === 0 ? 0.5 : 0.5);
      pawns[p.id] = segment ? draw.inside(ring, from, to, 0.5, 0.18) : draw.inside(ring, from, to, ring.r_from === 0 ? 0.62 : 0.3, 0.16);
    }
  }

  // ——— Villes : quartiers fortifiés collés à leur mur, autres au centre de la province ———
  const towns: TerrainData["towns"] = [];
  for (const p of provinces) {
    const sec = sectorOf[p.id];
    if (!sec || p.kind === "segment") continue;
    const urban = ["urbain", "souterrain"].includes(p.terrain);
    const fort = ["fort", "militaire"].includes(p.terrain);
    if (!urban && !fort && p.pop_level < 1) continue;
    const outerIsWall = typeof sec.ring.r_to === "string" && sec.ring.r_to !== "coast";
    const size = p.atlas_code === "I01" ? "capitale" : fort ? "fort" : urban && p.pop_level >= 4 ? "district" : p.pop_level >= 3 ? "ville" : p.pop_level >= 2 ? "bourg" : "hameau";
    const f = size === "district" && outerIsWall ? 0.86 : 0.5;
    const at = p.atlas_code === "I01" ? ([0, 0] as Point) : draw.inside(sec.ring, sec.from, sec.to, f, size === "district" ? 0 : 0.06);
    towns.push({ province: p.id, at, size });
    if (size === "district" || size === "capitale") {
      anchors[p.id] = at;
      pawns[p.id] = draw.inside(sec.ring, sec.from, sec.to, sec.ring.r_from === 0 ? 0.62 : 0.45, 0.2);
    }
  }

  // Emplacement des pions (MAP.6) : dans la province, écarté du nom et de la ville, surtout en hauteur (un nom est large et bas).
  const townOf = new Map(towns.map((t) => [t.province, t.at]));
  for (const p of provinces) {
    const sec = sectorOf[p.id];
    if (!sec || p.kind === "segment") continue;
    const avoid = [anchors[p.id] as Point, ...(townOf.has(p.id) ? [townOf.get(p.id) as Point] : [])];
    let best: Point | null = null;
    let bestScore = -Infinity;
    for (const f of [0.22, 0.35, 0.5, 0.65, 0.78]) {
      for (const db of [-0.3, -0.18, 0, 0.18, 0.3]) {
        const c = draw.inside(sec.ring, sec.from, sec.to, f, db);
        if (!pointInPolygon(c, polys[p.id] as Point[])) continue;
        const clear = Math.min(...avoid.map(([ax, ay]) => Math.hypot((c[0] - ax) / 2.5, c[1] - ay)));
        const score = Math.min(clear, 28) - Math.abs(f - 0.5) * 10 - Math.abs(db) * 10;
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
    }
    if (best) pawns[p.id] = best;
  }

  // ——— Grilles : province par cellule, puis relief ———
  const owner = new Int16Array(N * N).fill(-1);
  const ids = Object.keys(polys);
  const boxes = ids.map((id) => {
    const p = polys[id] ?? [];
    return [Math.min(...p.map((q) => q[0])), Math.min(...p.map((q) => q[1])), Math.max(...p.map((q) => q[0])), Math.max(...p.map((q) => q[1]))];
  });
  const coastR = new Float32Array(N * N);
  const land = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = cellCenter(i);
      const y = cellCenter(j);
      const k = j * N + i;
      const b = bearingOf(x, y);
      const cr = draw.coastRadius(b);
      coastR[k] = cr - Math.hypot(x, y);
      if ((coastR[k] ?? 0) <= 0) continue;
      land[k] = 1;
      for (let q = 0; q < ids.length; q++) {
        const bx = boxes[q] as number[];
        if (x < (bx[0] ?? 0) || x > (bx[2] ?? 0) || y < (bx[1] ?? 0) || y > (bx[3] ?? 0)) continue;
        if (pointInPolygon([x, y], polys[ids[q] as string] ?? [])) {
          owner[k] = q;
          break;
        }
      }
    }
  }
  // Îlots [A].
  const isletPolys: Point[][] = [];
  for (const [n, isl] of ISLETS.entries()) {
    const c = polar(draw.coastRadius(isl.bearing) + isl.out, isl.bearing);
    const poly: Point[] = [];
    for (let a = 0; a < 360; a += 15) {
      const r = isl.r * (0.75 + 0.5 * valueNoise(a / 40 + n * 7, n, seedOf(`${S}:ilot`)));
      const [x, y] = polar(r, a);
      poly.push([round(c[0] + x), round(c[1] + y)]);
    }
    isletPolys.push(poly);
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i;
    if (land[k]) continue;
    if (isletPolys.some((p) => pointInPolygon([cellCenter(i), cellCenter(j)], p))) land[k] = 2;
  }

  const baseF = new Float32Array(N * N);
  const reliefF = new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) {
    const o = owner[k] ?? -1;
    const terrain = o >= 0 ? (byId.get(ids[o] as string)?.terrain ?? "plaine") : land[k] ? "cote" : "plaine";
    const t = terrainBias(terrain);
    baseF[k] = t.base;
    reliefF[k] = t.relief;
  }
  const base = blur(baseF, 4, 3);
  const relief = blur(reliefF, 3, 2);

  const elev = new Float32Array(N * N);
  const cliffZone = (b: number): boolean => b > 196 && b < 236;
  const lakeProv = provinces.find((p) => p.terrain === "lac")?.id;
  const riverProv = provinces.find((p) => p.terrain === "fleuve")?.id;
  const gorgeProv = provinces.find((p) => p.atlas_code === "R18")?.id;
  const seedHi = seedOf(`${S}:relief`);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i;
    const x = cellCenter(i);
    const y = cellCenter(j);
    if (!land[k]) {
      // Fond marin : plus profond loin de la côte.
      const depth = smoothstep(0, 70, -(coastR[k] ?? 0));
      elev[k] = -0.05 - 0.95 * depth + 0.04 * fbm(x / 40, y / 40, seedHi + 3, 3);
      continue;
    }
    const d = land[k] === 2 ? 6 : coastR[k] ?? 0;
    const b = bearingOf(x, y);
    const ridge = ridged(x / 110, y / 110, seedHi, 5);
    const detail = fbm(x / 55, y / 55, seedHi + 1, 5);
    const rr = Math.hypot(x, y) / Math.max(1, d + Math.hypot(x, y));
    // Dôme d'ensemble (l'eau s'écoule vers la mer) et collines éparses hors des murs.
    const wild = smoothstep(0.7, 0.85, rr);
    let e = (base[k] ?? 0) + (relief[k] ?? 0) * (ridge * 1.4 - 0.35) + 0.07 * detail + 0.05 * fbm(x / 220, y / 220, seedHi + 2, 3) + 0.11 * (1 - rr ** 1.6) + wild * 0.1 * Math.max(0, ridged(x / 80, y / 80, seedHi + 5, 4) - 0.35);
    const o = owner[k] ?? -1;
    const id = o >= 0 ? ids[o] : undefined;
    // Lac des Reflets : cuvette au centre de sa province ; Rivière des Cendres et Gorge du Silence : sillon.
    if (id && id === lakeProv) {
      const a = anchors[id] as Point;
      e -= 0.22 * Math.exp(-(((x - a[0]) / 16) ** 2 + ((y - a[1]) / 10) ** 2));
    }
    if (id && (id === riverProv || id === gorgeProv)) {
      const a = anchors[id] as Point;
      const ab = bearingOf(a[0], a[1]);
      const off = Math.abs(((b - ab + 540) % 360) - 180) * Math.hypot(x, y) * (Math.PI / 180);
      e -= (id === gorgeProv ? 0.18 : 0.08) * Math.exp(-((off / 7) ** 2));
    }
    const cliff = cliffZone(b) && land[k] === 1;
    e *= cliff ? smoothstep(0, 5, d) * 0.6 + 0.4 : smoothstep(0, 28, d) * 0.85 + 0.15;
    elev[k] = Math.max(0.004, e);
  }

  // ——— Hydrographie : remplissage des cuvettes (priority-flood), écoulement D8, accumulation ———
  const filled = Float32Array.from(elev);
  const done = new Uint8Array(N * N);
  const heap: number[] = [];
  const push = (k: number): void => {
    heap.push(k);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if ((filled[heap[p] as number] ?? 0) <= (filled[heap[c] as number] ?? 0)) break;
      [heap[p], heap[c]] = [heap[c] as number, heap[p] as number];
      c = p;
    }
  };
  const pop = (): number => {
    const top = heap[0] as number;
    const last = heap.pop() as number;
    if (heap.length > 0) {
      heap[0] = last;
      let c = 0;
      for (;;) {
        const l = c * 2 + 1;
        const r = l + 1;
        let m = c;
        if (l < heap.length && (filled[heap[l] as number] ?? 0) < (filled[heap[m] as number] ?? 0)) m = l;
        if (r < heap.length && (filled[heap[r] as number] ?? 0) < (filled[heap[m] as number] ?? 0)) m = r;
        if (m === c) break;
        [heap[m], heap[c]] = [heap[c] as number, heap[m] as number];
        c = m;
      }
    }
    return top;
  };
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const;
  for (let k = 0; k < N * N; k++) if (!land[k]) {
    done[k] = 1;
    push(k);
  }
  const down = new Int32Array(N * N).fill(-1);
  while (heap.length) {
    const k = pop();
    const x = k % N;
    const y = (k - x) / N;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const n = ny * N + nx;
      if (done[n]) continue;
      done[n] = 1;
      filled[n] = Math.max(filled[n] ?? 0, (filled[k] ?? 0) + 1e-5);
      down[n] = k;
      push(n);
    }
  }
  const order = Array.from({ length: N * N }, (_, k) => k).filter((k) => land[k]).sort((a, b) => (filled[b] ?? 0) - (filled[a] ?? 0));
  const acc = new Float32Array(N * N);
  for (const k of order) {
    acc[k] = (acc[k] ?? 0) + 1;
    const d = down[k] ?? -1;
    if (d >= 0) acc[d] = (acc[d] ?? 0) + (acc[k] ?? 0);
  }
  const lake = new Uint8Array(N * N);
  // Lacs : cuvettes remplies assez profondes et assez grandes ; les autres ne sont que des replats.
  const seen = new Uint8Array(N * N);
  for (let k0 = 0; k0 < N * N; k0++) {
    if (seen[k0] || land[k0] !== 1 || (filled[k0] ?? 0) - (elev[k0] ?? 0) < 0.015) continue;
    const comp: number[] = [];
    const stack = [k0];
    seen[k0] = 1;
    let deepest = 0;
    while (stack.length) {
      const k = stack.pop() as number;
      comp.push(k);
      deepest = Math.max(deepest, (filled[k] ?? 0) - (elev[k] ?? 0));
      const x = k % N;
      for (const n of [k - 1, k + 1, k - N, k + N]) {
        if (n < 0 || n >= N * N || seen[n] || Math.abs((n % N) - x) > 1 || land[n] !== 1 || (filled[n] ?? 0) - (elev[n] ?? 0) < 0.015) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    if ((comp.length >= 8 && deepest > 0.06) || comp.some((k) => owner[k] === ids.indexOf(lakeProv ?? ""))) for (const k of comp) lake[k] = 1;
  }

  // Les petites cuvettes non retenues comme lacs sont comblées (replats) : le relief figé est cohérent avec l'écoulement.
  for (let k = 0; k < N * N; k++) if (land[k] && !lake[k]) elev[k] = filled[k] ?? 0;

  // Fleuves : cellules à fort bassin versant, tracées de la source à la mer ou à la confluence.
  const RIVER_MIN = 240;
  const onRiver = new Uint8Array(N * N);
  const heads = order.filter((k) => (acc[k] ?? 0) >= RIVER_MIN && !lake[k]).filter((k) => {
    const x = k % N;
    const y = (k - x) / N;
    return !DIRS.some(([dx, dy]) => {
      const n = (y + dy) * N + (x + dx);
      return down[n] === k && (acc[n] ?? 0) >= RIVER_MIN;
    });
  });
  const rivers: TerrainData["rivers"] = [];
  for (const h of heads) {
    const path: number[] = [];
    let k = h;
    let joined = false;
    while (k >= 0 && land[k]) {
      if (onRiver[k]) {
        joined = true;
        break;
      }
      path.push(k);
      onRiver[k] = 1;
      k = down[k] ?? -1;
    }
    const pts = path.filter((c) => !lake[c]).map((c): Point => [cellCenter(c % N), cellCenter(Math.floor(c / N))]);
    if (k >= 0) pts.push([cellCenter(k % N), cellCenter(Math.floor(k / N))]);
    if (pts.length < (joined ? 6 : 10)) continue;
    // Un point sur deux : les marches de la grille disparaissent, le lissage fait le reste.
    const thin = pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1);
    const jit = thin.map(([x, y], i): Point => (i === 0 || i === thin.length - 1 ? [x, y] : [x + fbm(x / 9, y / 9, seedOf(`${S}:meandre`), 2) * 1.6, y + fbm(y / 9, x / 9, seedOf(`${S}:meandre2`), 2) * 1.6]));
    const flow = acc[path[path.length - 1] ?? h] ?? RIVER_MIN;
    rivers.push({ width: round(0.6 + Math.min(2.4, Math.log2(flow / RIVER_MIN) * 0.55)), points: chaikin(jit, 3).map(([x, y]) => [round(x), round(y)] as Point) });
  }

  // ——— Milieux : affinités par province, adoucies aux frontières, puis seuils bruités ———
  const biome = new Uint8Array(N * N);
  const moistSeed = seedOf(`${S}:humidite`);
  const insideWalls = (r: number, b: number): boolean => r < (layout.radii.maria.value + layout.wall_band_km) * draw.wallWarp(b);
  const aff = { forest: new Float32Array(N * N), swamp: new Float32Array(N * N), steppe: new Float32Array(N * N), dead: new Float32Array(N * N), giant: new Float32Array(N * N) };
  for (let k = 0; k < N * N; k++) {
    const o = owner[k] ?? -1;
    const p = o >= 0 ? byId.get(ids[o] as string) : undefined;
    if (!p) continue;
    if (p.atlas_code === "R06") aff.giant[k] = 1;
    else if (p.terrain === "foret") (p.kind === "outre" ? aff.dead : aff.forest)[k] = 1;
    if (p.terrain === "marais") aff.swamp[k] = 1;
    if (p.kind === "outre" && p.terrain === "plaine") aff.steppe[k] = 1;
    if (p.terrain === "vallee" || p.terrain === "collines") aff.forest[k] = 0.45;
  }
  const soft = Object.fromEntries(Object.entries(aff).map(([key, g]) => [key, blur(g, 5, 2)])) as Record<keyof typeof aff, Float32Array>;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i;
    const x = cellCenter(i);
    const y = cellCenter(j);
    if (!land[k]) {
      biome[k] = (elev[k] ?? 0) < -0.35 ? BIOME.mer_profonde : BIOME.mer;
      continue;
    }
    if (lake[k]) {
      biome[k] = BIOME.lac;
      continue;
    }
    const e = elev[k] ?? 0;
    const r = Math.hypot(x, y);
    const b = bearingOf(x, y);
    const moist = fbm(x / 70, y / 70, moistSeed, 4) + (onRiver[k] ? 0.25 : 0);
    const jitter = fbm(x / 18, y / 18, moistSeed + 5, 4) * 0.5;
    const inside = insideWalls(r, b);
    const d = land[k] === 2 ? 3 : coastR[k] ?? 0;
    let v: number;
    if (e > 0.62) v = BIOME.roche;
    else if (e > 0.46) v = BIOME.montagne;
    else if ((soft.giant[k] ?? 0) + jitter > 0.5) v = BIOME.arbres_geants;
    else if ((soft.swamp[k] ?? 0) + jitter > 0.5 || (!inside && e < 0.07 && moist > 0.2)) v = BIOME.marais;
    else if ((soft.dead[k] ?? 0) + jitter > 0.5 && moist > -0.5) v = BIOME.foret_morte;
    else if (moist + 0.85 * (soft.forest[k] ?? 0) + jitter * 0.5 > (inside ? 0.36 : 0.3)) v = BIOME.foret;
    else if (e > 0.32) v = BIOME.collines;
    else if (!inside) v = (soft.steppe[k] ?? 0) + jitter > 0.55 && moist < 0.1 ? BIOME.steppe : BIOME.prairie;
    else v = valueNoise(x / 22, y / 22, moistSeed + 9) + jitter * 0.4 > 0.45 ? BIOME.cultures : BIOME.prairie;
    if (land[k] === 1 && d < 4.5 && e < 0.2 && v !== BIOME.marais) v = BIOME.plage;
    if (land[k] === 1 && d < 6 && cliffZone(b)) v = BIOME.falaise;
    biome[k] = v;
  }
  // Villes : tache bâtie proportionnelle à la taille.
  const townRadius = { hameau: 0, bourg: 4, ville: 6, district: 8, capitale: 14, fort: 3 } as const;
  for (const t of towns) {
    const rr = townRadius[t.size];
    if (rr <= 0) continue;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i;
      if (land[k] !== 1 || lake[k]) continue;
      const dd = Math.hypot(cellCenter(i) - t.at[0], cellCenter(j) - t.at[1]);
      if (dd < rr * (0.8 + 0.4 * valueNoise(i / 2, j / 2, fnv1a(t.province)))) biome[k] = BIOME.ville;
    }
  }

  // ——— Murs, portes ———
  const walls: TerrainData["walls"] = (["sina", "rose", "maria"] as const).map((wall) => ({ wall, line: draw.wallLine(wall), band_km: layout.wall_band_km }));
  const segByCode = new Map(provinces.filter((p) => p.kind === "segment").map((p) => [p.atlas_code, p.id]));
  const gates: TerrainData["gates"] = layout.gates.map((g) => {
    const id = segByCode.get(g.segment);
    if (!id) throw new Error(`porte sur un segment inconnu : ${g.segment}`);
    const wall = (byId.get(id)?.region ?? "").replace("mur_", "") as "sina" | "rose" | "maria";
    const [x, y] = polar((layout.radii[wall].value + layout.wall_band_km / 2) * draw.wallWarp(g.bearing), g.bearing);
    return { province: id, at: [round(x), round(y)], bearing: g.bearing };
  });

  // ——— Routes : entre villes voisines d'une même enceinte, et à travers les portes ———
  const roads: TerrainData["roads"] = [];
  const townAt = new Map(towns.map((t) => [t.province, t.at]));
  const placeOf = (id: string): Point => townAt.get(id) ?? (anchors[id] as Point);
  // Tracé au moindre coût sur la grille : la pente coûte, l'eau courante se franchit (pont), les lacs et la mer non,
  // les murs seulement à leurs portes ; une route déjà tracée attire les suivantes (réseau qui se rejoint).
  const cellOf = ([x, y]: Point): number => Math.min(N - 1, Math.max(0, Math.floor((y + BOUND) / CELL))) * N + Math.min(N - 1, Math.max(0, Math.floor((x + BOUND) / CELL)));
  const blocked = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i;
    if (!land[k] || lake[k]) {
      blocked[k] = 1;
      continue;
    }
    const x = cellCenter(i);
    const y = cellCenter(j);
    const r = Math.hypot(x, y);
    const b = bearingOf(x, y);
    for (const wall of ["sina", "rose", "maria"] as const) {
      const rw = (layout.radii[wall].value + layout.wall_band_km / 2) * draw.wallWarp(b);
      if (Math.abs(r - rw) < layout.wall_band_km / 2 + CELL) blocked[k] = 1;
    }
  }
  for (const g of gates) {
    const [gx, gy] = g.at;
    for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
      const k = cellOf([gx + i * CELL, gy + j * CELL]);
      if (land[k] && !lake[k]) blocked[k] = 0;
    }
  }
  const used = new Uint8Array(N * N);
  const STEPS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]] as const;
  const curve = (a: Point, b: Point): Point[] => {
    const s0 = cellOf(a);
    const t0 = cellOf(b);
    const ti = t0 % N;
    const tj = Math.floor(t0 / N);
    const dist = new Float32Array(N * N).fill(Infinity);
    const from = new Int32Array(N * N).fill(-1);
    const heap: [number, number][] = [];
    const push = (f: number, k: number): void => {
      heap.push([f, k]);
      let c = heap.length - 1;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if ((heap[p] as [number, number])[0] <= f) break;
        [heap[p], heap[c]] = [heap[c] as [number, number], heap[p] as [number, number]];
        c = p;
      }
    };
    const pop = (): [number, number] => {
      const top = heap[0] as [number, number];
      const last = heap.pop() as [number, number];
      if (heap.length) {
        heap[0] = last;
        let c = 0;
        for (;;) {
          const l = 2 * c + 1;
          const r = l + 1;
          let m = c;
          if (l < heap.length && (heap[l] as [number, number])[0] < (heap[m] as [number, number])[0]) m = l;
          if (r < heap.length && (heap[r] as [number, number])[0] < (heap[m] as [number, number])[0]) m = r;
          if (m === c) break;
          [heap[m], heap[c]] = [heap[c] as [number, number], heap[m] as [number, number]];
          c = m;
        }
      }
      return top;
    };
    dist[s0] = 0;
    push(0, s0);
    while (heap.length) {
      const [, k] = pop();
      if (k === t0) break;
      const i = k % N;
      const j = Math.floor(k / N);
      for (const [di, dj, len] of STEPS) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const n = nj * N + ni;
        if (blocked[n] && n !== t0) continue;
        const slope = Math.abs((elev[n] ?? 0) - (elev[k] ?? 0)) * 260;
        const cost = len * (1 + slope * slope + (onRiver[n] ? 6 : 0)) * (used[n] ? 0.55 : 1);
        const d = (dist[k] ?? 0) + cost;
        if (d < (dist[n] ?? Infinity)) {
          dist[n] = d;
          from[n] = k;
          push(d + Math.hypot(ni - ti, nj - tj) * 0.55, n);
        }
      }
    }
    if (from[t0] === -1 && s0 !== t0) return [a, b];
    const cells: number[] = [];
    for (let k = t0; k !== -1 && k !== s0; k = from[k] ?? -1) cells.push(k);
    cells.push(s0);
    cells.reverse();
    for (const k of cells) used[k] = 1;
    const mid = cells.filter((_, idx) => idx > 0 && idx < cells.length - 1 && idx % 3 === 0).map((k): Point => [cellCenter(k % N), cellCenter(Math.floor(k / N))]);
    return chaikin([a, ...mid, b], 2).map(([x, y]) => [round(x), round(y)] as Point);
  };
  const isSeg = (id: string): boolean => byId.get(id)?.kind === "segment";
  const isOutre = (id: string): boolean => byId.get(id)?.kind === "outre";
  for (const a of Object.keys(dataNeighbors).sort()) {
    for (const b of dataNeighbors[a] ?? []) {
      if (a >= b || isSeg(a) || isSeg(b)) continue;
      if (!townAt.has(a) && !townAt.has(b)) continue;
      roads.push({ points: curve(placeOf(a), placeOf(b)), kind: isOutre(a) || isOutre(b) ? "chemin" : townAt.has(a) && townAt.has(b) ? "route" : "chemin" });
    }
  }
  for (const g of gates) {
    const sides = (dataNeighbors[g.province] ?? []).filter((n) => !isSeg(n));
    let best: [string, string] | null = null;
    let bestD = Infinity;
    for (const a of sides) for (const b of sides) {
      if (a >= b) continue;
      const ra = Math.hypot(...placeOf(a));
      const rb = Math.hypot(...placeOf(b));
      const rg = Math.hypot(...g.at);
      if ((ra - rg) * (rb - rg) >= 0) continue;
      const d = Math.hypot(placeOf(a)[0] - g.at[0], placeOf(a)[1] - g.at[1]) + Math.hypot(placeOf(b)[0] - g.at[0], placeOf(b)[1] - g.at[1]);
      if (d < bestD) {
        bestD = d;
        best = [a, b];
      }
    }
    if (best) {
      roads.push({ points: curve(placeOf(best[0]), g.at), kind: "route" });
      roads.push({ points: curve(g.at, placeOf(best[1])), kind: "route" });
    }
  }
  const bridges: Point[] = [];
  for (const road of roads) for (const river of rivers) {
    for (let i = 1; i < road.points.length; i++) for (let k = 1; k < river.points.length; k++) {
      const hit = segIntersect(road.points[i - 1] as Point, road.points[i] as Point, river.points[k - 1] as Point, river.points[k] as Point);
      if (hit && !bridges.some((q) => Math.hypot(q[0] - hit[0], q[1] - hit[1]) < 4)) bridges.push([round(hit[0]), round(hit[1])]);
    }
  }

  // ——— Encodage ———
  const height = new Uint8Array(N * N);
  for (let k = 0; k < N * N; k++) {
    const e = elev[k] ?? 0;
    height[k] = e < 0 ? Math.round(clamp(1 + e) * (SEA_LEVEL - 1)) : SEA_LEVEL + Math.round(clamp(e) * (255 - SEA_LEVEL));
  }
  const b64 = (a: Uint8Array): string => Buffer.from(a).toString("base64");
  const neighbors = drawnNeighbors(polys);
  return {
    version: 1,
    seed: S,
    units: "km",
    bounds: [-BOUND, -BOUND, BOUND, BOUND],
    grid: { n: N, cell_km: Math.round(CELL * 10000) / 10000, sea_level: SEA_LEVEL },
    height: b64(height),
    biome: b64(biome),
    coast: draw.coast(),
    islets: isletPolys,
    rivers,
    walls,
    gates,
    provinces: Object.fromEntries(Object.keys(polys).sort().map((id) => [id, { polygon: polys[id] as Point[], anchor: anchors[id] as Point, pawn: pawns[id] as Point }])),
    neighbors,
    towns: towns.sort((a, b) => a.province.localeCompare(b.province)),
    roads,
    bridges,
  };
}

/** Écarts entre le voisinage dessiné et celui des données (CMAP-04). */
export function neighborDiff(drawn: Record<string, string[]>, data: Record<string, string[]>): string[] {
  const out: string[] = [];
  for (const id of [...new Set([...Object.keys(drawn), ...Object.keys(data)])].sort()) {
    const a = new Set(drawn[id] ?? []);
    const b = new Set(data[id] ?? []);
    for (const n of a) if (!b.has(n)) out.push(`${id} touche ${n} sur la carte, pas dans les données`);
    for (const n of b) if (!a.has(n)) out.push(`${id} voisin de ${n} dans les données, pas sur la carte`);
  }
  return out;
}
