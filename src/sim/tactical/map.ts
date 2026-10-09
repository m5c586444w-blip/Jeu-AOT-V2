import type { MapBrick, TacticalMap } from "../../data/schemas";
import { fnv1a } from "../core/hash";
import { Rng } from "../core/rng";

/** Monde tactique généré (03 §2) : structures en volumes, ancrages, index spatial. Positions en mètres ; z = hauteur. */

export interface Structure {
  id: number;
  kind: MapBrick["kind"];
  shape: "box" | "cyl";
  /** Boîte : coin (x, y), largeur w (axe x), profondeur d (axe y). Cylindre : centre (x, y), rayon r. */
  x: number;
  y: number;
  w: number;
  d: number;
  r: number;
  h: number;
}

export interface Anchor {
  id: number;
  x: number;
  y: number;
  z: number;
  structure: number;
  /** Solidité 0–1 : un ancrage fragile (toit, petit arbre) lâche plus souvent [A]. */
  solidity: number;
}

export interface TacticalWorldMap {
  id: string;
  terrain: TacticalMap["terrain"];
  width: number;
  height: number;
  structures: Structure[];
  anchors: Anchor[];
  /** Index spatial : cellule → identifiants d'ancrages. */
  grid: Map<number, number[]>;
  cell: number;
}

const CELL = 25;
const cellKey = (cx: number, cy: number): number => cx * 10007 + cy;

function addAnchor(m: TacticalWorldMap, x: number, y: number, z: number, structure: number, solidity: number): void {
  const a: Anchor = { id: m.anchors.length, x, y, z, structure, solidity };
  m.anchors.push(a);
  const k = cellKey(Math.floor(x / CELL), Math.floor(y / CELL));
  const list = m.grid.get(k);
  if (list) list.push(a.id);
  else m.grid.set(k, [a.id]);
}

function boxAnchors(m: TacticalWorldMap, s: Structure, perFace: number, rng: Rng, z?: (k: number) => number): void {
  if (perFace <= 0) return;
  const faces: [number, number, number, number][] = [
    [s.x, s.y, s.x + s.w, s.y],
    [s.x + s.w, s.y, s.x + s.w, s.y + s.d],
    [s.x, s.y + s.d, s.x + s.w, s.y + s.d],
    [s.x, s.y, s.x, s.y + s.d],
  ];
  for (const [x0, y0, x1, y1] of faces) {
    for (let k = 0; k < perFace; k++) {
      const t = (k + 0.5 + (rng.next() - 0.5) * 0.4) / perFace;
      addAnchor(m, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z ? z(k) : s.h - 0.5, s.id, s.kind === "rocher" ? 0.9 : 0.75);
    }
  }
}

function cylAnchors(m: TacticalWorldMap, s: Structure, count: number, rng: Rng): void {
  for (let k = 0; k < count; k++) {
    const a = rng.next() * Math.PI * 2;
    const z = s.h * (count === 1 ? 0.8 : 0.25 + (0.65 * k) / Math.max(1, count - 1));
    addAnchor(m, s.x + Math.cos(a) * s.r, s.y + Math.sin(a) * s.r, z, s.id, s.kind === "arbre_geant" ? 1 : 0.6);
  }
}

const between = (rng: Rng, [a, b]: readonly [number, number]): number => a + (b - a) * rng.next();

/** Le point (x, y) est-il libre (hors de toute structure, avec une marge) ? */
function free(m: TacticalWorldMap, x: number, y: number, margin: number): boolean {
  return m.structures.every((s) =>
    s.shape === "cyl" ? Math.hypot(s.x - x, s.y - y) > s.r + margin : x < s.x - margin || x > s.x + s.w + margin || y < s.y - margin || y > s.y + s.d + margin,
  );
}

/** Génère une carte : même définition et même graine → même carte (AC4-02). Les bords sud et nord restent dégagés pour le déploiement. */
export function generateMap(def: TacticalMap, seed: number, margin: number): TacticalWorldMap {
  const rng = new Rng(fnv1a(`${seed}:${def.id}`));
  const [W, H] = def.size_m;
  const m: TacticalWorldMap = { id: def.id, terrain: def.terrain, width: W, height: H, structures: [], anchors: [], grid: new Map(), cell: CELL };
  const add = (s: Omit<Structure, "id">): Structure => {
    const full = { ...s, id: m.structures.length };
    m.structures.push(full);
    return full;
  };
  for (const b of def.bricks) {
    switch (b.kind) {
      case "mur": {
        const wall = add({ kind: "mur", shape: "box", x: 0, y: 0, w: W, d: b.thickness_m, r: 0, h: between(rng, b.height_m) });
        // Ancrages sur la face intérieure (côté carte), à plusieurs hauteurs.
        const levels = [0.3, 0.6, 0.95];
        for (let k = 0; k < b.anchors_per_face; k++) {
          const x = ((k + 0.5) / b.anchors_per_face) * W;
          addAnchor(m, x, wall.d, wall.h * (levels[k % levels.length] as number), wall.id, 1);
        }
        break;
      }
      case "batiment": {
        const { cell_m, street_m, fill } = b.grid;
        const y0 = b.band_m ? b.band_m[0] : margin;
        const y1 = b.band_m ? b.band_m[1] : H - margin;
        for (let y = y0; y + cell_m <= y1; y += cell_m) {
          for (let x = 0; x + cell_m <= W; x += cell_m) {
            if (rng.next() > fill) continue;
            const shrink = rng.next() * 4;
            const s = add({ kind: "batiment", shape: "box", x: x + street_m / 2 + shrink, y: y + street_m / 2 + shrink, w: cell_m - street_m - 2 * shrink, d: cell_m - street_m - 2 * shrink, r: 0, h: between(rng, b.height_m) });
            boxAnchors(m, s, b.anchors_per_face, rng);
          }
        }
        break;
      }
      case "arbre_geant":
      case "arbre": {
        for (let k = 0, tries = 0; k < b.count && tries < b.count * 40; tries++) {
          const r = between(rng, b.radius_m);
          const x = r + rng.next() * (W - 2 * r);
          const y = margin + rng.next() * (H - 2 * margin);
          if (!free(m, x, y, b.kind === "arbre_geant" ? 18 : 6)) continue;
          const s = add({ kind: b.kind, shape: "cyl", x, y, w: 0, d: 0, r, h: between(rng, b.height_m) });
          cylAnchors(m, s, b.anchors_per_tree, rng);
          k++;
        }
        break;
      }
      case "rocher": {
        for (let k = 0, tries = 0; k < b.count && tries < b.count * 40; tries++) {
          const size = between(rng, b.size_m);
          const x = rng.next() * (W - size);
          const y = margin + rng.next() * (H - 2 * margin - size);
          if (!free(m, x + size / 2, y + size / 2, size)) continue;
          const s = add({ kind: "rocher", shape: "box", x, y, w: size, d: size * (0.6 + rng.next() * 0.4), r: 0, h: between(rng, b.height_m) });
          boxAnchors(m, s, b.anchors_per_face, rng);
          k++;
        }
        break;
      }
    }
  }
  return m;
}

/** Ancrages à moins de `range` mètres (3D) d'un point, via l'index spatial. */
export function anchorsNear(m: TacticalWorldMap, x: number, y: number, z: number, range: number): Anchor[] {
  const out: Anchor[] = [];
  const c0x = Math.floor((x - range) / m.cell);
  const c1x = Math.floor((x + range) / m.cell);
  const c0y = Math.floor((y - range) / m.cell);
  const c1y = Math.floor((y + range) / m.cell);
  const r2 = range * range;
  for (let cx = c0x; cx <= c1x; cx++) {
    for (let cy = c0y; cy <= c1y; cy++) {
      for (const id of m.grid.get(cellKey(cx, cy)) ?? []) {
        const a = m.anchors[id] as Anchor;
        const dx = a.x - x;
        const dy = a.y - y;
        const dz = a.z - z;
        if (dx * dx + dy * dy + dz * dz <= r2) out.push(a);
      }
    }
  }
  return out;
}

/** Hauteur du sol (toit, rocher, sommet de mur, sinon 0) sous un point : sert aux atterrissages. */
export function groundAt(m: TacticalWorldMap, x: number, y: number): number {
  let h = 0;
  for (const s of m.structures) {
    if (s.shape === "box" ? x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.d : false) h = Math.max(h, s.h);
  }
  return h;
}

// ——— R2+ (temps réel seulement) : volumes infranchissables au sol et ligne de tir. ———
// Les batailles d'avant R2 n'appellent aucune de ces fonctions (leurs empreintes ne changent pas).

/** Marge autour d'un volume pour un homme à pied (m). */
export const BLOCK_MARGIN_M = 0.4;
/** Distance d'un coin de contournement au volume, au-delà de la marge (m). */
const DETOUR_GAP_M = 0.8;
const OBSTACLE_CELL = 10;
const NONE: readonly number[] = [];
/** Index des volumes par cases de 10 m, calculé une fois par carte (aucun effet sur l'état de la bataille). */
const obstacleGrids = new WeakMap<TacticalWorldMap, Map<number, number[]>>();

function obstacleGrid(m: TacticalWorldMap): Map<number, number[]> {
  const known = obstacleGrids.get(m);
  if (known) return known;
  const g = new Map<number, number[]>();
  for (const s of m.structures) {
    const pad = 2;
    const x0 = (s.shape === "cyl" ? s.x - s.r : s.x) - pad;
    const y0 = (s.shape === "cyl" ? s.y - s.r : s.y) - pad;
    const x1 = (s.shape === "cyl" ? s.x + s.r : s.x + s.w) + pad;
    const y1 = (s.shape === "cyl" ? s.y + s.r : s.y + s.d) + pad;
    for (let cx = Math.floor(x0 / OBSTACLE_CELL); cx <= Math.floor(x1 / OBSTACLE_CELL); cx++) {
      for (let cy = Math.floor(y0 / OBSTACLE_CELL); cy <= Math.floor(y1 / OBSTACLE_CELL); cy++) {
        const k = cellKey(cx, cy);
        const list = g.get(k);
        if (list) list.push(s.id);
        else g.set(k, [s.id]);
      }
    }
  }
  obstacleGrids.set(m, g);
  return g;
}

const near = (m: TacticalWorldMap, x: number, y: number): readonly number[] => obstacleGrid(m).get(cellKey(Math.floor(x / OBSTACLE_CELL), Math.floor(y / OBSTACLE_CELL))) ?? NONE;

function inside(s: Structure, x: number, y: number, margin: number): boolean {
  if (s.shape === "cyl") return (x - s.x) ** 2 + (y - s.y) ** 2 < (s.r + margin) ** 2;
  return x > s.x - margin && x < s.x + s.w + margin && y > s.y - margin && y < s.y + s.d + margin;
}

/** Volume (bâtiment, mur, rocher, fût) qui occupe le point (x, y) plus haut que z : un homme à pied n'y entre pas. */
export function blockingAt(m: TacticalWorldMap, x: number, y: number, z = 0, margin = BLOCK_MARGIN_M): Structure | null {
  for (const id of near(m, x, y)) {
    const s = m.structures[id] as Structure;
    if (s.h > z + 0.5 && inside(s, x, y, margin)) return s;
  }
  return null;
}

/** Le point (x, y) est-il pris dans un volume plus haut que z (marge comprise) ? */
export function blockedAt(m: TacticalWorldMap, x: number, y: number, z = 0, margin = BLOCK_MARGIN_M): boolean {
  return blockingAt(m, x, y, z, margin) !== null;
}

/**
 * Ligne de tir : le segment (x0, y0, z0) → (x1, y1, z1) traverse-t-il un bâtiment, un mur ou un rocher ? Échantillonné
 * tous les `step` mètres, extrémités exclues (les arbres ne masquent pas le tir).
 */
export function segmentBlocked(m: TacticalWorldMap, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, step = 1.5): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
  for (let k = 1; k < n; k++) {
    const f = k / n;
    const x = x0 + (x1 - x0) * f;
    const y = y0 + (y1 - y0) * f;
    const z = z0 + (z1 - z0) * f;
    for (const id of near(m, x, y)) {
      const s = m.structures[id] as Structure;
      if (s.shape === "box" && s.h > z && inside(s, x, y, 0)) return true;
    }
  }
  return false;
}

/**
 * Le chemin à pied (x0, y0) → (x1, y1) est-il libre (un échantillon par mètre) ? `last` faux : le point d'arrivée n'est pas
 * vérifié (cible elle-même prise dans un volume, sur un toit par exemple).
 */
function pathFree(m: TacticalWorldMap, x0: number, y0: number, x1: number, y1: number, z: number, margin: number, last = true): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let k = 1; k <= (last ? n : n - 1); k++) if (blockedAt(m, x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, z, margin)) return false;
  return true;
}

/** Point libre le plus proche hors des volumes (place de formation, point d'un ordre tombé dans une maison). */
export function freeSpot(m: TacticalWorldMap, x: number, y: number, z = 0, margin = BLOCK_MARGIN_M): { x: number; y: number } {
  let px = x;
  let py = y;
  for (let k = 0; k < 4; k++) {
    const s = blockingAt(m, px, py, z, margin);
    if (!s) break;
    const e = margin + 0.2;
    if (s.shape === "cyl") {
      const d = Math.hypot(px - s.x, py - s.y) || 1;
      const a = d < 1e-6 ? 0 : Math.atan2(py - s.y, px - s.x);
      px = s.x + Math.cos(a) * (s.r + e);
      py = s.y + Math.sin(a) * (s.r + e);
      continue;
    }
    // Vers la face la plus proche.
    const exits: [number, number, number][] = [
      [px - (s.x - e), s.x - e, py],
      [s.x + s.w + e - px, s.x + s.w + e, py],
      [py - (s.y - e), px, s.y - e],
      [s.y + s.d + e - py, px, s.y + s.d + e],
    ];
    exits.sort((a, b) => a[0] - b[0]);
    const best = exits.find((c) => c[1] >= 0 && c[1] <= m.width && c[2] >= 0 && c[2] <= m.height) ?? exits[0];
    if (!best) break;
    px = best[1];
    py = best[2];
  }
  return { x: px, y: py };
}

/**
 * Un pas d'un homme (ou d'un Titan, avec sa marge) de (x, y) vers (tx, ty), long de v au plus, sans entrer dans un volume :
 * droit si la place est libre ; sinon vers un coin du volume qui barre la route : de préférence un coin d'où le but se voit
 * (le plus court détour), à défaut le coin atteignable le plus proche du but qui rapproche ; sinon en glissant le long du
 * mur ; sinon sur place. Sans mémoire : le même point donne toujours le même pas (déterminisme).
 */
export function walkStep(m: TacticalWorldMap, x: number, y: number, z: number, tx: number, ty: number, v: number, margin = BLOCK_MARGIN_M): { x: number; y: number } {
  const dx = tx - x;
  const dy = ty - y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6 || v <= 0) return { x, y };
  // Déjà pris dans un volume (déploiement, chute) : on en sort.
  if (blockedAt(m, x, y, z, margin)) return freeSpot(m, x, y, z, margin);
  const k = Math.min(v, d) / d;
  const nx = x + dx * k;
  const ny = y + dy * k;
  const wall = blockingAt(m, nx, ny, z, margin);
  if (!wall) return { x: nx, y: ny };
  const e = margin + DETOUR_GAP_M;
  const corners: [number, number][] =
    wall.shape === "cyl"
      ? [[wall.x - wall.r - e, wall.y - wall.r - e], [wall.x + wall.r + e, wall.y - wall.r - e], [wall.x + wall.r + e, wall.y + wall.r + e], [wall.x - wall.r - e, wall.y + wall.r + e]]
      : [[wall.x - e, wall.y - e], [wall.x + wall.w + e, wall.y - e], [wall.x + wall.w + e, wall.y + wall.d + e], [wall.x - e, wall.y + wall.d + e]];
  // Plus court chemin autour du volume : soi → coins (le long de ses faces) → but. Quatre coins : quelques relâchements suffisent.
  const targetFree = !blockedAt(m, tx, ty, z, margin);
  const dist = [Infinity, Infinity, Infinity, Infinity];
  const first = [-1, -1, -1, -1];
  corners.forEach((c, i) => {
    if (pathFree(m, x, y, c[0], c[1], z, margin)) {
      dist[i] = Math.hypot(c[0] - x, c[1] - y);
      first[i] = i;
    }
  });
  const edge = new Map<number, boolean>();
  const linked = (i: number, j: number): boolean => {
    const k = Math.min(i, j) * 4 + Math.max(i, j);
    let ok = edge.get(k);
    if (ok === undefined) {
      const a = corners[i] as [number, number];
      const b = corners[j] as [number, number];
      ok = pathFree(m, a[0], a[1], b[0], b[1], z, margin);
      edge.set(k, ok);
    }
    return ok;
  };
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < 4; i++) {
      const di = dist[i] as number;
      if (di === Infinity) continue;
      const a = corners[i] as [number, number];
      for (const j of [(i + 1) % 4, (i + 3) % 4]) {
        const b = corners[j] as [number, number];
        const dj = di + Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (dj < (dist[j] as number) && linked(i, j)) {
          dist[j] = dj;
          // Déjà au coin i : le premier pas va au coin suivant.
          first[j] = first[i] === i && di < 0.3 ? j : (first[i] as number);
        }
      }
    }
  }
  let best: [number, number] | null = null;
  let bestScore = Infinity;
  corners.forEach((c, i) => {
    const di = dist[i] as number;
    const f = first[i] as number;
    if (di === Infinity || f < 0) return;
    const hop = corners[f] as [number, number];
    if (Math.hypot(hop[0] - x, hop[1] - y) < 0.3) return;
    const ct = Math.hypot(tx - c[0], ty - c[1]);
    // Un coin d'où le but se voit passe avant tout autre ; sinon, seul un coin plus près du but que soi compte.
    const sees = pathFree(m, c[0], c[1], tx, ty, z, margin, targetFree);
    if (!sees && ct >= d - 0.1) return;
    const score = sees ? di + ct : 1e6 + ct;
    if (score < bestScore) {
      bestScore = score;
      best = hop;
    }
  });
  if (best) {
    const dc = Math.hypot(best[0] - x, best[1] - y);
    const kc = Math.min(v, dc) / dc;
    const cx = x + (best[0] - x) * kc;
    const cy = y + (best[1] - y) * kc;
    if (!blockedAt(m, cx, cy, z, margin)) return { x: cx, y: cy };
  }
  // Glissement le long du mur.
  const step = Math.min(v, d);
  for (const [sx, sy] of [[dx * k, 0], [0, dy * k], [Math.sign(dx) * step, 0], [0, Math.sign(dy) * step]] as [number, number][]) {
    if ((sx !== 0 || sy !== 0) && !blockedAt(m, x + sx, y + sy, z, margin)) return { x: x + sx, y: y + sy };
  }
  return { x, y };
}
