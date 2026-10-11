import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import type { Place } from "../../../data/placeSchema";
import { FaceBuilder } from "../townMesh";
import { derive, range, seeded } from "../rng";
import { along, bbox, inside, polylineDist, polylineLength, rectPoly, segDist } from "./geom";
import { CANAL_WATER_Y } from "./ground3d";

/**
 * Dette n° 12 : vie des places et des canaux. Étals (table, tréteaux, auvent de toile, denrées) en rangées sur les places
 * de marché ; barques amarrées le long des quais des canaux. Seulement quand la ville est habitée (part présente > 0).
 * Formes, couleurs et espacements : choix de rendu (A).
 */

export interface PropSpot {
  x: number;
  y: number;
  yaw: number;
  variant: number;
}

/** Rangées d'étals : pas (m) le long d'une rangée et entre rangées ; marge aux bords de la place ; écarts aux arbres, repères. */
const STALL_STEP = 6.5;
const ROW_STEP = 11;
const EDGE_M = 5;
const TREE_M = 4;
const FOUNTAIN_M = 7;
export const STALL_VARIANTS = 4;
export const BOAT_VARIANTS = 2;

type MarketInput = Pick<Place, "places_publiques" | "batiments" | "eau">;

/** Étals des places de marché (plan du lieu, m) ; aucun quand la ville est vide. */
export function stallSpots(place: MarketInput, trees: readonly { x: number; y: number }[], share: number, seed: number): PropSpot[] {
  if (share <= 0) return [];
  const r = seeded(derive(seed, 1212));
  const blocked = place.batiments.map((b) => {
    const a = (b.angle_deg * Math.PI) / 180;
    return rectPoly(b.position, [Math.cos(a), Math.sin(a)], b.emprise_m[0] / 2 + 3, b.emprise_m[1] / 2 + 3);
  });
  const out: PropSpot[] = [];
  for (const sq of place.places_publiques) {
    if (!sq.marche) continue;
    const poly = sq.polygone;
    const edge = (p: [number, number]): number => {
      let d = Infinity;
      for (let i = 0; i < poly.length; i++) d = Math.min(d, segDist(p, poly[i] as [number, number], poly[(i + 1) % poly.length] as [number, number]).d);
      return d;
    };
    const b = bbox(poly);
    let row = 0;
    for (let y = b.minY + EDGE_M; y <= b.maxY - EDGE_M; y += ROW_STEP, row++) {
      for (let x = b.minX + EDGE_M + (row % 2) * (STALL_STEP / 2); x <= b.maxX - EDGE_M; x += STALL_STEP) {
        const p: [number, number] = [x + range(r, -0.4, 0.4), y + range(r, -0.4, 0.4)];
        if (!inside(poly, p) || edge(p) < EDGE_M) continue;
        if (blocked.some((q) => inside(q, p))) continue;
        if (trees.some((t) => Math.hypot(t.x - p[0], t.y - p[1]) < TREE_M)) continue;
        if (sq.fontaine && Math.hypot(sq.fontaine[0] - p[0], sq.fontaine[1] - p[1]) < FOUNTAIN_M) continue;
        // Une place sur cinq laissée libre : allées, étals démontés.
        if (r() < 0.2) continue;
        out.push({ x: p[0], y: p[1], yaw: row % 2 ? 0 : Math.PI, variant: Math.floor(r() * STALL_VARIANTS) });
      }
    }
  }
  return out;
}

/** Barques amarrées le long des quais (une tous les 22 à 34 m, côtés alternés, loin des ponts) ; aucune dans une ville vide. */
export function boatSpots(place: MarketInput, share: number, seed: number): PropSpot[] {
  if (share <= 0) return [];
  const r = seeded(derive(seed, 1313));
  const out: PropSpot[] = [];
  for (const w of place.eau.voies) {
    if (!w.quais || w.largeur_m < 7) continue;
    const len = polylineLength(w.trace);
    let side = 1;
    for (let s = 15 + r() * 15; s < len - 10; s += range(r, 22, 34)) {
      side = -side;
      const { p, d } = along(w.trace, s);
      const off = side * (w.largeur_m / 2 - 2.0);
      const q: [number, number] = [p[0] - d[1] * off, p[1] + d[0] * off];
      if (place.eau.ponts.some((b) => Math.hypot(b.position[0] - q[0], b.position[1] - q[1]) < b.longueur_m / 2 + 12)) continue;
      if (r() < 0.2) continue;
      out.push({ x: q[0], y: q[1], yaw: Math.atan2(d[0], d[1]), variant: Math.floor(r() * BOAT_VARIANTS) });
    }
  }
  return out;
}

const CANVAS = ["#C9B48A", "#8C3F33", "#5E6A70", "#7A8A5A"];
const GOODS = ["#6F8A3A", "#A8452E", "#C8A050", "#7A5A3A"];

const at = (x: number, y: number, z: number, s: [number, number, number] = [1, 1, 1], rx = 0, rz = 0): Matrix4 =>
  new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), rx).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), rz)), new Vector3(...s));

/** Étal : table sur tréteaux, quatre montants, auvent de toile incliné, caisses de denrées (le client est vers +z). */
function stall(variant: number): FaceBuilder {
  const fb = new FaceBuilder();
  const wood = new Color("#6A4E34");
  const canvas = new Color(CANVAS[variant % CANVAS.length] as string);
  fb.geometry(new BoxGeometry(2.4, 0.08, 1.1), at(0, 0.82, 0), wood);
  for (const sx of [-1.05, 1.05]) fb.geometry(new BoxGeometry(0.08, 0.8, 0.9), at(sx, 0.4, 0), wood);
  for (const [sx, sz, h] of [
    [-1.2, 0.6, 2.0],
    [1.2, 0.6, 2.0],
    [-1.2, -0.6, 2.4],
    [1.2, -0.6, 2.4],
  ] as const)
    fb.geometry(new CylinderGeometry(0.035, 0.035, h, 5), at(sx, h / 2, sz), wood);
  fb.geometry(new BoxGeometry(2.7, 0.04, 1.6), at(0, 2.22, 0, [1, 1, 1], -0.25), canvas);
  for (let i = 0; i < 3; i++) fb.geometry(new BoxGeometry(0.55, 0.22, 0.5), at(-0.75 + i * 0.75, 0.97, 0.05), new Color(GOODS[(variant + i) % GOODS.length] as string));
  return fb;
}

/** Barque de canal (péniche de 8 m) : coque à pointes, plat-bord, bancs ; la seconde porte une cargaison bâchée (proue vers +z). */
function boat(variant: number): FaceBuilder {
  const fb = new FaceBuilder();
  const hull = new Color(variant ? "#7A5C3E" : "#8C6A46");
  const rail = new Color("#5A4430");
  const inner = new Color("#A88A62");
  fb.geometry(new BoxGeometry(2.3, 0.8, 6.4), at(0, 0, 0), hull);
  fb.geometry(new ConeGeometry(1.15, 1.8, 4, 1), at(0, 0, 4.1, [1, 0.36, 1], Math.PI / 2, Math.PI / 4), hull);
  fb.geometry(new ConeGeometry(1.15, 1.2, 4, 1), at(0, 0, -3.8, [1, 0.36, 1], -Math.PI / 2, Math.PI / 4), hull);
  fb.geometry(new BoxGeometry(2.4, 0.1, 6.5), at(0, 0.42, 0), rail);
  fb.geometry(new BoxGeometry(2.0, 0.06, 6.0), at(0, 0.3, 0), inner);
  for (const z of [-2.2, 1.6]) fb.geometry(new BoxGeometry(2.1, 0.1, 0.35), at(0, 0.5, z), rail);
  if (variant === 1) fb.geometry(new BoxGeometry(1.7, 0.7, 3.2), at(0, 0.7, -0.2), new Color("#CDBF98"));
  return fb;
}

/** Couche des étals et des barques (instanciés, une foule par variante). */
export function buildMarketProps(stalls: readonly PropSpot[], boats: readonly PropSpot[]): { group: Group; counts: { stalls: number; boats: number }; dispose(): void } {
  const group = new Group();
  group.name = "marches-et-quais";
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const meshes: InstancedMesh[] = [];
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const one = new Vector3(1, 1, 1);
  const add = (spots: readonly PropSpot[], variants: number, make: (v: number) => FaceBuilder, y: number, name: string): void => {
    for (let v = 0; v < variants; v++) {
      const list = spots.filter((s) => s.variant === v);
      if (list.length === 0) continue;
      const mesh = new InstancedMesh(make(v).build(), mat, list.length);
      mesh.name = `${name}-${v}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      list.forEach((s, i) => mesh.setMatrixAt(i, m.compose(new Vector3(s.x, y, s.y), q.setFromAxisAngle(up, s.yaw), one)));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
      meshes.push(mesh);
    }
  };
  add(stalls, STALL_VARIANTS, stall, 0, "etals");
  // La coque affleure : ligne de flottaison au tiers de sa hauteur.
  add(boats, BOAT_VARIANTS, boat, CANAL_WATER_Y + 0.12, "barques");
  return {
    group,
    counts: { stalls: stalls.length, boats: boats.length },
    dispose() {
      for (const x of meshes) x.geometry.dispose();
      mat.dispose();
    },
  };
}

/** Pour les contrôles : distance d'une barque à l'axe de son canal. */
export function distanceToCanal(place: MarketInput, p: [number, number]): number {
  return Math.min(...place.eau.voies.map((w) => polylineDist(p, w.trace)));
}
