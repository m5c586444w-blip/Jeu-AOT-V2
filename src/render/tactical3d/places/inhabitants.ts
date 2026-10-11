import { Color, ConeGeometry, CylinderGeometry, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from "three";
import type { Place } from "../../../data/placeSchema";
import { FaceBuilder } from "../townMesh";
import { derive, range, seeded } from "../rng";
import { along, bbox, inside, polylineLength, signedArea } from "./geom";

/**
 * Dette n° 6 : habitants des lieux (champ `habitants` de l'état : part de la population de 845 présente). Figures civiles
 * instanciées, debout, le long des rues (selon leur rang) et sur les places (plus nombreuses au marché), en nombre
 * proportionnel à la part présente ; aucune dans une ville évacuée. Densités, tenues et teintes : choix de rendu (A).
 */

/** Mètres de rue par habitant visible, selon le type de voie (1 / densité linéaire). */
const STREET_SPACING: Record<string, number> = { principale: 4, rue: 9, quai: 7, ruelle: 20, chemin: 45, route: 45 };
/** Mètres carrés de place par habitant visible (marché, place ordinaire). */
const SQUARE_AREA = { marche: 22, place: 70 };
/** Plafond de figures par lieu (rendu). */
export const MAX_INHABITANTS = 2500;
/** Variantes de tenues (hommes : 0 à 2 ; femmes : 3 à 5). */
export const INHABITANT_VARIANTS = 6;

export interface InhabitantSpot {
  x: number;
  y: number;
  yaw: number;
  variant: number;
}

/** Places des habitants (plan du lieu, m) pour une part présente `share` (0 : aucun) ; déterministe pour une graine. */
export function inhabitantSpots(place: Pick<Place, "rues" | "places_publiques">, share: number, seed: number): InhabitantSpot[] {
  if (share <= 0) return [];
  const r = seeded(derive(seed, 6060));
  const out: InhabitantSpot[] = [];
  const push = (x: number, y: number): void => {
    out.push({ x, y, yaw: range(r, -Math.PI, Math.PI), variant: Math.floor(r() * INHABITANT_VARIANTS) });
  };
  for (const st of place.rues) {
    const len = polylineLength(st.trace);
    const n = Math.round((len / (STREET_SPACING[st.type] ?? 20)) * share);
    // Sur la chaussée, à au moins 0,8 m des façades.
    const half = Math.max(0, st.largeur_m / 2 - 0.8);
    for (let i = 0; i < n; i++) {
      const { p, d } = along(st.trace, r() * len);
      const off = range(r, -half, half);
      push(p[0] - d[1] * off, p[1] + d[0] * off);
    }
  }
  for (const sq of place.places_publiques) {
    const area = Math.abs(signedArea(sq.polygone));
    const n = Math.round((area / (sq.marche ? SQUARE_AREA.marche : SQUARE_AREA.place)) * share);
    const b = bbox(sq.polygone);
    for (let i = 0, tries = 0; i < n && tries < n * 20; tries++) {
      const p: [number, number] = [range(r, b.minX, b.maxX), range(r, b.minY, b.maxY)];
      if (!inside(sq.polygone, p)) continue;
      push(p[0], p[1]);
      i++;
    }
  }
  // Au-delà du plafond, un tirage régulier garde la répartition entre rues et places.
  if (out.length <= MAX_INHABITANTS) return out;
  const step = out.length / MAX_INHABITANTS;
  return Array.from({ length: MAX_INHABITANTS }, (_, i) => out[Math.floor(i * step)] as InhabitantSpot);
}

/** Tenues civiles (A) : chemise ou corsage, pantalon ou jupe longue, coiffe ou cheveux. */
const SHIRTS = ["#B9AC90", "#7C5A3E", "#5E6A70", "#8C3F33", "#A8A08A", "#56634C"];
const LOWER = ["#4A3F33", "#3B3A36", "#5A4A38", "#6E2F2A", "#45506A", "#7A6A50"];
const SKIN = ["#D9B49A", "#C99A7C", "#E3C2A8"];
const HAIR = ["#3B2C20", "#6A4A2E", "#2A2420", "#8A6A3E"];

function civilian(variant: number): FaceBuilder {
  const fb = new FaceBuilder();
  const woman = variant >= 3;
  const c = (h: string): Color => new Color(h);
  const at = (x: number, y: number, z: number, s: [number, number, number] = [1, 1, 1], rx = 0): Matrix4 =>
    new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), rx), new Vector3(...s));
  const shirt = c(SHIRTS[variant % SHIRTS.length] as string);
  const lower = c(LOWER[(variant * 2 + 1) % LOWER.length] as string);
  const skin = c(SKIN[variant % SKIN.length] as string);
  const hair = c(HAIR[variant % HAIR.length] as string);
  const leg = 0.82;
  if (woman) fb.geometry(new ConeGeometry(0.27, leg + 0.02, 10, 1, true), at(0, (leg + 0.02) / 2, 0), lower);
  else for (const s of [1, -1]) fb.geometry(new CylinderGeometry(0.065, 0.052, leg, 6), at(s * 0.085, leg / 2, 0), lower);
  fb.geometry(new CylinderGeometry(woman ? 0.13 : 0.15, woman ? 0.12 : 0.13, 0.52, 8), at(0, leg + 0.26, 0, [1, 1, 0.72]), shirt);
  for (const s of [1, -1]) fb.geometry(new CylinderGeometry(0.045, 0.036, 0.54, 6), at(s * (woman ? 0.17 : 0.19), leg + 0.25, 0.02, [1, 1, 1], -0.15), shirt);
  const sphere = new SphereGeometry(1, 7, 5);
  fb.geometry(sphere, at(0, leg + 0.66, 0.01, [0.09, 0.115, 0.1]), skin);
  // Coiffe ou fichu (femmes), cheveux ou chapeau (hommes).
  if (woman) fb.geometry(sphere, at(0, leg + 0.71, -0.01, [0.1, 0.09, 0.11]), variant === 4 ? c("#E8E2D2") : hair);
  else fb.geometry(sphere, at(0, leg + 0.72, -0.01, [0.095, 0.07, 0.105]), hair);
  return fb;
}

/** Couche des habitants : une foule instanciée par variante de tenue (couleurs de sommet). */
export function buildInhabitants(spots: readonly InhabitantSpot[]): { group: Group; count: number; dispose(): void } {
  const group = new Group();
  group.name = "habitants";
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const meshes: InstancedMesh[] = [];
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const one = new Vector3(1, 1, 1);
  for (let v = 0; v < INHABITANT_VARIANTS; v++) {
    const list = spots.filter((s) => s.variant === v);
    if (list.length === 0) continue;
    const mesh = new InstancedMesh(civilian(v).build(), mat, list.length);
    mesh.name = `habitants-${v}`;
    mesh.castShadow = true;
    list.forEach((s, i) => mesh.setMatrixAt(i, m.compose(new Vector3(s.x, 0, s.y), q.setFromAxisAngle(up, s.yaw), one)));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
    meshes.push(mesh);
  }
  return {
    group,
    count: spots.length,
    dispose() {
      for (const x of meshes) x.geometry.dispose();
      mat.dispose();
    },
  };
}
