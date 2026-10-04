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
