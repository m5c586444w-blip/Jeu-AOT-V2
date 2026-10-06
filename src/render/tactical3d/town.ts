import { derive, range, seeded, weighted } from "./rng";
import type { Rand } from "./rng";

/**
 * Ville irrégulière par graine (R1.2) : calcul pur, sans three.js ni DOM, testé dans `tests/render/tactical3d/town.test.ts`.
 * Coordonnées au sol en mètres : x vers l'est, y vers le sud. three.js les lit comme (x, z).
 *
 * Méthode :
 * 1. Un treillis de carrefours, tirés de part et d'autre d'une grille, puis légèrement tordu autour du centre : les rues ne
 *    sont ni droites ni parallèles.
 * 2. Chaque tronçon de rue a sa propre largeur. Chaque îlot est le quadrilatère du treillis, rentré de la demi-largeur de
 *    chacune de ses quatre rues : en face l'un de l'autre, deux îlots sont donc toujours séparés de la largeur du tronçon.
 * 3. Les maisons sont posées le long des bords de l'îlot, façade sur la rue. On rejette celles qui débordent de l'îlot ou en
 *    chevauchent une autre. L'îlot central et son voisin du sud restent vides : c'est la place, traversée par une rue.
 * Les hauteurs (8 à 21 m, toit compris) suivent celles de la carte tactique « ville » (`data/tactical_maps/maps.json`, 8–20 m).
 */
export interface Vec2 {
  x: number;
  y: number;
}
export type Quad = [Vec2, Vec2, Vec2, Vec2];
export type RoofKind = "plat" | "pignon" | "croupe";
export const ROOF_KINDS: readonly RoofKind[] = ["plat", "pignon", "croupe"];

export interface Street {
  a: Vec2;
  b: Vec2;
  width: number;
}
export interface Block {
  id: number;
  /** Carrefours du treillis (axes des rues), dans l'ordre du contour. */
  quad: Quad;
  /** Îlot bâti : le quadrilatère rentré de la demi-largeur de chaque rue. */
  inner: Quad;
  /** Indices, dans `streets`, des quatre tronçons qui bordent l'îlot (même ordre que les côtés de `quad`). */
  sides: [number, number, number, number];
  /** Rotation propre de l'îlot autour de son centre (radians) : la rue s'évase ou se resserre le long de l'îlot. */
  turn: number;
  plaza: boolean;
}
export interface Chimney {
  /** Position locale : u le long de la façade, v dans la profondeur (mètres, depuis le centre). */
  u: number;
  v: number;
  height: number;
}
export interface Building {
  id: number;
  block: number;
  x: number;
  y: number;
  /** Direction de la façade (radians) : le long de la rue. */
  angle: number;
  /** Largeur de façade, sur la rue. */
  width: number;
  depth: number;
  floors: number;
  floorHeight: number;
  roof: RoofKind;
  /** Pente du toit (radians), sans effet pour un toit plat. */
  pitch: number;
  /** Faîtage parallèle à la façade (sinon, pignon sur rue). */
  ridgeAlongFront: boolean;
  /** Matière des murs : 0 enduit, 1 pierre, 2 brique. */
  wall: 0 | 1 | 2;
  /** Couleur de toit : 0 ardoise, 1 tuile, 2 tuile sombre. */
  roofColor: 0 | 1 | 2;
  /** Nuance claire/sombre de la façade, de 0,82 à 1. */
  tint: number;
  chimneys: Chimney[];
  /** Fenêtres par étage, sur la façade et sur le côté. */
  bays: number;
  sideBays: number;
}
export interface Town {
  seed: number;
  streets: Street[];
  blocks: Block[];
  buildings: Building[];
  /** La place : deux îlots voisins laissés vides, traversés par une rue (fontaine au centre du premier). */
  plaza: { block: number; blocks: number[]; center: Vec2; centers: Vec2[] };
  /** Emprise du treillis (axes des rues extérieures). */
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  /** Un pan de mur d'enceinte au nord, en toile de fond : 50 m [C] (01, 11 §2), épaisseur 10 m [?]. */
  wall: { a: Vec2; b: Vec2; height: number; thickness: number };
}
export interface TownOptions {
  cols: number;
  rows: number;
  blockMin: number;
  blockMax: number;
  streetMin: number;
  streetMax: number;
  /** Écart maximal d'un carrefour à sa position de grille (m). */
  jitter: number;
  /** Torsion du treillis autour du centre (radians par mètre). */
  swirl: number;
  /** Rotation maximale d'un îlot sur lui-même (degrés). */
  blockTurnDeg: number;
}
export const TOWN_DEFAULTS: TownOptions = { cols: 5, rows: 5, blockMin: 34, blockMax: 52, streetMin: 5, streetMax: 14, jitter: 9, swirl: 0.0026, blockTurnDeg: 15 };

const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;
const len = (a: Vec2): number => Math.hypot(a.x, a.y);
const norm = (a: Vec2): Vec2 => mul(a, 1 / (len(a) || 1));

/** Aire signée (positive si le contour tourne dans le sens x → y). */
export function signedArea(poly: readonly Vec2[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i] as Vec2;
    const q = poly[(i + 1) % poly.length] as Vec2;
    s += cross(p, q);
  }
  return s / 2;
}

/** Point dans un polygone convexe (bord compris à `eps` près). */
export function insideConvex(poly: readonly Vec2[], p: Vec2, eps = 1e-6): boolean {
  const sign = Math.sign(signedArea(poly));
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as Vec2;
    const b = poly[(i + 1) % poly.length] as Vec2;
    if (sign * cross(sub(b, a), sub(p, a)) < -eps) return false;
  }
  return true;
}

/** Distance d'un point à la droite (a, b). */
export function distanceToLine(p: Vec2, a: Vec2, b: Vec2): number {
  return Math.abs(cross(sub(b, a), sub(p, a))) / (len(sub(b, a)) || 1);
}

/** Les quatre coins de l'emprise au sol d'une maison. */
export function footprint(b: Pick<Building, "x" | "y" | "angle" | "width" | "depth">): Quad {
  const u = { x: Math.cos(b.angle), y: Math.sin(b.angle) };
  const v = { x: -u.y, y: u.x };
  const c = { x: b.x, y: b.y };
  const hw = b.width / 2;
  const hd = b.depth / 2;
  return [add(c, add(mul(u, -hw), mul(v, -hd))), add(c, add(mul(u, hw), mul(v, -hd))), add(c, add(mul(u, hw), mul(v, hd))), add(c, add(mul(u, -hw), mul(v, hd)))];
}

/** Recouvrement de deux polygones convexes (axes séparateurs), avec une tolérance de contact. */
export function overlaps(p: readonly Vec2[], q: readonly Vec2[], eps = 0.05): boolean {
  for (const poly of [p, q]) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i] as Vec2;
      const b = poly[(i + 1) % poly.length] as Vec2;
      const n = norm({ x: -(b.y - a.y), y: b.x - a.x });
      const proj = (s: readonly Vec2[]): [number, number] => {
        const d = s.map((v) => v.x * n.x + v.y * n.y);
        return [Math.min(...d), Math.max(...d)];
      };
      const [p0, p1] = proj(p);
      const [q0, q1] = proj(q);
      if (p1 <= q0 + eps || q1 <= p0 + eps) return false;
    }
  }
  return true;
}

/** Intersection des droites (p + t·d) et (q + s·e). */
function intersect(p: Vec2, d: Vec2, q: Vec2, e: Vec2): Vec2 {
  const den = cross(d, e);
  if (Math.abs(den) < 1e-9) return p;
  const t = cross(sub(q, p), e) / den;
  return add(p, mul(d, t));
}

/** Rentre chaque côté d'un quadrilatère convexe de sa propre distance, vers l'intérieur. */
export function insetQuad(q: Quad, d: readonly [number, number, number, number]): Quad {
  const sign = Math.sign(signedArea(q)) || 1;
  const lines = q.map((a, i) => {
    const b = q[(i + 1) % 4] as Vec2;
    const dir = norm(sub(b, a));
    const inward = mul({ x: -dir.y, y: dir.x }, sign);
    return { p: add(a, mul(inward, d[i] ?? 0)), d: dir };
  });
  const out = q.map((_, i) => {
    const prev = lines[(i + 3) % 4] as { p: Vec2; d: Vec2 };
    const cur = lines[i] as { p: Vec2; d: Vec2 };
    return intersect(prev.p, prev.d, cur.p, cur.d);
  });
  return out as Quad;
}

/**
 * Tourne un îlot sur lui-même, puis le réduit autour de son centre jusqu'à ce qu'il tienne dans l'îlot d'origine :
 * un îlot tourné n'empiète jamais sur la rue, il l'élargit d'un côté.
 */
export function turnInside(q: Quad, turn: number): Quad {
  const c = mul(q.reduce((s, p) => add(s, p), { x: 0, y: 0 }), 1 / 4);
  const rot = q.map((p) => {
    const d = sub(p, c);
    return add(c, { x: d.x * Math.cos(turn) - d.y * Math.sin(turn), y: d.x * Math.sin(turn) + d.y * Math.cos(turn) });
  });
  const at = (k: number): Quad => rot.map((p) => add(c, mul(sub(p, c), k))) as Quad;
  let lo = 0;
  let hi = 1;
  if (at(1).every((p) => insideConvex(q, p))) return at(1);
  for (let it = 0; it < 30; it++) {
    const mid = (lo + hi) / 2;
    if (at(mid).every((p) => insideConvex(q, p))) lo = mid;
    else hi = mid;
  }
  return at(lo);
}

function lattice(rand: Rand, o: TownOptions): { pts: Vec2[][]; bounds: Town["bounds"] } {
  const spans = (n: number): number[] => {
    const xs = [0];
    for (let i = 0; i < n; i++) xs.push((xs[i] as number) + range(rand, o.blockMin, o.blockMax) + o.streetMax * 0.6);
    const mid = (xs[n] as number) / 2;
    return xs.map((x) => x - mid);
  };
  const xs = spans(o.cols);
  const ys = spans(o.rows);
  const pts: Vec2[][] = [];
  for (let i = 0; i <= o.cols; i++) {
    const col: Vec2[] = [];
    for (let j = 0; j <= o.rows; j++) {
      const base = { x: (xs[i] as number) + range(rand, -o.jitter, o.jitter), y: (ys[j] as number) + range(rand, -o.jitter, o.jitter) };
      // Torsion : rotation croissante avec la distance au centre, pour des rues qui s'incurvent doucement.
      const r = len(base);
      const a = o.swirl * r;
      col.push({ x: base.x * Math.cos(a) - base.y * Math.sin(a), y: base.x * Math.sin(a) + base.y * Math.cos(a) });
    }
    pts.push(col);
  }
  const all = pts.flat();
  return {
    pts,
    bounds: { minX: Math.min(...all.map((p) => p.x)), maxX: Math.max(...all.map((p) => p.x)), minY: Math.min(...all.map((p) => p.y)), maxY: Math.max(...all.map((p) => p.y)) },
  };
}

/** Pose les maisons d'un îlot le long de ses bords. */
function placeBuildings(rand: Rand, block: Block, firstId: number): Building[] {
  const q = block.inner;
  const sign = Math.sign(signedArea(q)) || 1;
  const placed: Building[] = [];
  const edges = [0, 1, 2, 3];
  const minSide = Math.min(...edges.map((k) => len(sub(q[(k + 1) % 4] as Vec2, q[k] as Vec2))));
  for (const k of edges) {
    const a = q[k] as Vec2;
    const b = q[(k + 1) % 4] as Vec2;
    const L = len(sub(b, a));
    const d = norm(sub(b, a));
    const inward = mul({ x: -d.y, y: d.x }, sign);
    let s = range(rand, 0, 1.5);
    while (s < L - 4) {
      const width = Math.min(range(rand, 7, 13.5), L - s);
      const depth = Math.min(range(rand, 9, 15), minSide * 0.46);
      if (width < 5.5 || depth < 6) break;
      const c = add(add(a, mul(d, s + width / 2)), mul(inward, depth / 2 + 0.02));
      const roof = ROOF_KINDS[weighted(rand, [0.25, 0.45, 0.3])] as RoofKind;
      const floors = 2 + weighted(rand, [0.25, 0.4, 0.25, 0.1]);
      const floorHeight = range(rand, 3.0, 3.5);
      const b0: Building = {
        id: firstId + placed.length,
        block: block.id,
        x: c.x,
        y: c.y,
        angle: Math.atan2(d.y, d.x),
        width,
        depth,
        floors,
        floorHeight,
        roof,
        pitch: (range(rand, 26, 44) * Math.PI) / 180,
        ridgeAlongFront: rand() < 0.65,
        wall: weighted(rand, [0.5, 0.3, 0.2]) as 0 | 1 | 2,
        roofColor: weighted(rand, [0.4, 0.4, 0.2]) as 0 | 1 | 2,
        tint: range(rand, 0.82, 1),
        chimneys: [],
        bays: Math.max(1, Math.round(width / 2.9)),
        sideBays: Math.max(1, Math.round(depth / 2.9)),
      };
      const nCh = weighted(rand, [0.2, 0.45, 0.25, 0.1]);
      for (let i = 0; i < nCh; i++) b0.chimneys.push({ u: range(rand, -width / 2 + 0.9, width / 2 - 0.9), v: range(rand, -depth / 2 + 0.9, depth / 2 - 0.9), height: range(rand, 1.1, 2.3) });
      const fp = footprint(b0);
      const fits = fp.every((p) => insideConvex(q, p, 0.05)) && !placed.some((o) => overlaps(footprint(o), fp));
      if (!fits) {
        // Coin d'îlot déjà bâti par le côté précédent : on avance d'un mètre et on réessaie, pour garder la rue continue.
        s += 1;
        continue;
      }
      placed.push(b0);
      // Ruelle entre deux maisons, une fois sur huit.
      s += width + (rand() < 0.12 ? range(rand, 1.6, 3.2) : 0);
    }
  }
  return placed.map((b, i) => ({ ...b, id: firstId + i }));
}

export function generateTown(seed: number, opts: Partial<TownOptions> = {}): Town {
  const o: TownOptions = { ...TOWN_DEFAULTS, ...opts };
  const rand = seeded(derive(seed, 1));
  const { pts, bounds } = lattice(rand, o);
  const P = (i: number, j: number): Vec2 => (pts[i] as Vec2[])[j] as Vec2;
  const streets: Street[] = [];
  // Tronçons nord-sud (lignes i, entre les rangs j et j+1), puis est-ouest (lignes j, entre les colonnes i et i+1).
  const vIndex: number[][] = [];
  for (let i = 0; i <= o.cols; i++) {
    const row: number[] = [];
    for (let j = 0; j < o.rows; j++) {
      row.push(streets.length);
      streets.push({ a: P(i, j), b: P(i, j + 1), width: range(rand, o.streetMin, o.streetMax) });
    }
    vIndex.push(row);
  }
  const hIndex: number[][] = [];
  for (let j = 0; j <= o.rows; j++) {
    const row: number[] = [];
    for (let i = 0; i < o.cols; i++) {
      row.push(streets.length);
      streets.push({ a: P(i, j), b: P(i + 1, j), width: range(rand, o.streetMin, o.streetMax) });
    }
    hIndex.push(row);
  }
  const plazaCol = Math.floor(o.cols / 2);
  const plazaRow = Math.floor(o.rows / 2);
  const blocks: Block[] = [];
  const buildings: Building[] = [];
  const brand = seeded(derive(seed, 2));
  for (let i = 0; i < o.cols; i++) {
    for (let j = 0; j < o.rows; j++) {
      const quad: Quad = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)];
      const sides: [number, number, number, number] = [
        (hIndex[j] as number[])[i] as number,
        (vIndex[i + 1] as number[])[j] as number,
        (hIndex[j + 1] as number[])[i] as number,
        (vIndex[i] as number[])[j] as number,
      ];
      const lot = insetQuad(quad, sides.map((s) => (streets[s] as Street).width / 2) as [number, number, number, number]);
      const turn = (range(rand, -o.blockTurnDeg, o.blockTurnDeg) * Math.PI) / 180;
      const inner = turnInside(lot, turn);
      const block: Block = { id: blocks.length, quad, inner, sides, turn, plaza: i === plazaCol && (j === plazaRow || j === plazaRow + 1) };
      blocks.push(block);
      if (!block.plaza) buildings.push(...placeBuildings(brand, block, buildings.length));
    }
  }
  const plazaBlocks = blocks.filter((b) => b.plaza);
  const centers = plazaBlocks.map((b) => mul(b.inner.reduce((s, p) => add(s, p), { x: 0, y: 0 }), 1 / 4));
  const plazaBlock = plazaBlocks[0] as Block;
  const center = centers[0] as Vec2;
  const wy = bounds.minY - 38;
  return {
    seed,
    streets,
    blocks,
    buildings,
    plaza: { block: plazaBlock.id, blocks: plazaBlocks.map((b) => b.id), center, centers },
    bounds,
    wall: { a: { x: bounds.minX - 120, y: wy }, b: { x: bounds.maxX + 120, y: wy }, height: 50, thickness: 10 },
  };
}

/**
 * Dispersion des orientations des maisons, en degrés, à 90° près (écart-type circulaire sur 4θ).
 * Une grille régulière donne 0 : ses maisons ne prennent que deux directions perpendiculaires. Un écart-type « brut »
 * des angles, lui, lui donnerait environ 45° et ne mesurerait rien.
 */
export function orientationSpreadDeg(buildings: readonly Pick<Building, "angle">[]): number {
  if (buildings.length === 0) return 0;
  let c = 0;
  let s = 0;
  for (const b of buildings) {
    c += Math.cos(4 * b.angle);
    s += Math.sin(4 * b.angle);
  }
  const R = Math.min(1, Math.hypot(c, s) / buildings.length);
  return R >= 1 ? 0 : ((Math.sqrt(-2 * Math.log(R)) / 4) * 180) / Math.PI;
}

/** Portée du toit : la dimension que le faîtage enjambe (la plus petite pour un toit en croupe). */
export function roofSpan(b: Pick<Building, "roof" | "width" | "depth" | "ridgeAlongFront">): number {
  if (b.roof === "croupe") return Math.min(b.width, b.depth);
  return b.ridgeAlongFront ? b.depth : b.width;
}

/** Hauteur du toit au-dessus des murs (m), plafonnée à 6 m. */
export function roofRise(b: Pick<Building, "roof" | "width" | "depth" | "ridgeAlongFront" | "pitch">): number {
  if (b.roof === "plat") return 0.9;
  return Math.min(6, (roofSpan(b) / 2) * Math.tan(b.pitch));
}

/** Hauteur d'une maison au faîtage, ou à l'acrotère d'un toit plat (m). */
export function buildingHeight(b: Pick<Building, "floors" | "floorHeight" | "roof" | "pitch" | "width" | "depth" | "ridgeAlongFront">): number {
  return b.floors * b.floorHeight + roofRise(b);
}
