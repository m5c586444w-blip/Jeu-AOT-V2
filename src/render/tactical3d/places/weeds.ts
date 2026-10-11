import { Color, ConeGeometry, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import type { Place } from "../../../data/placeSchema";
import { FaceBuilder } from "../townMesh";
import { derive, range, seeded } from "../rng";
import { along, bbox, inside, polylineLength, signedArea } from "./geom";

/**
 * Dette n° 9 : herbes des rues abandonnées (champ `abandon` de l'état : « herbes et jeunes arbres dans les rues »). Touffes
 * le long des caniveaux (les deux bords de chaque rue) et éparses sur les places, d'autant plus serrées que l'abandon est
 * avancé ; aucune dans une ville entretenue. Formes, teintes et densités : choix de rendu (A).
 */

/** Surface de chaussée (m²) par touffe à l'abandon complet, idem pour les places ; plafond. */
const STREET_AREA = 5;
const SQUARE_AREA = 8;
export const MAX_WEEDS = 15000;
export const WEED_VARIANTS = 3;

export interface WeedSpot {
  x: number;
  y: number;
  yaw: number;
  s: number;
  variant: number;
}

/** Touffes d'herbe d'un lieu pour un niveau d'abandon (0 : aucune) ; déterministe pour une graine. */
export function weedSpots(place: Pick<Place, "rues" | "places_publiques">, abandon: number, seed: number): WeedSpot[] {
  if (abandon <= 0) return [];
  const r = seeded(derive(seed, 909));
  const out: WeedSpot[] = [];
  const push = (x: number, y: number): void => {
    out.push({ x, y, yaw: range(r, 0, Math.PI * 2), s: range(r, 0.45, 1.0) * (0.6 + 0.6 * abandon), variant: Math.floor(r() * WEED_VARIANTS) });
  };
  for (const st of place.rues) {
    const len = polylineLength(st.trace);
    const n = Math.round(((len * st.largeur_m) / STREET_AREA) * abandon);
    for (let i = 0; i < n; i++) {
      const { p, d } = along(st.trace, r() * len);
      // Toute la chaussée, plus serrée au pied des façades et dans les caniveaux (u² tire vers les bords).
      const u = r();
      const off = (r() < 0.5 ? -1 : 1) * (st.largeur_m / 2 - 0.15) * (1 - u * u);
      push(p[0] - d[1] * off, p[1] + d[0] * off);
    }
  }
  for (const sq of place.places_publiques) {
    const n = Math.round((Math.abs(signedArea(sq.polygone)) / SQUARE_AREA) * abandon);
    const b = bbox(sq.polygone);
    for (let i = 0, tries = 0; i < n && tries < n * 10; tries++) {
      const p: [number, number] = [range(r, b.minX, b.maxX), range(r, b.minY, b.maxY)];
      if (!inside(sq.polygone, p)) continue;
      push(p[0], p[1]);
      i++;
    }
  }
  if (out.length <= MAX_WEEDS) return out;
  const k = out.length / MAX_WEEDS;
  return Array.from({ length: MAX_WEEDS }, (_, i) => out[Math.floor(i * k)] as WeedSpot);
}

const GREENS = ["#4E6A30", "#66783A", "#7C7A44"];

/** Touffe : quatre brins fins inclinés autour du pied et un plus droit au centre (hauteur 0,2 à 0,4 m). */
function tuft(variant: number): FaceBuilder {
  const fb = new FaceBuilder();
  const c = new Color(GREENS[variant % GREENS.length] as string);
  const dark = c.clone().multiplyScalar(0.8);
  const blade = new ConeGeometry(0.018, 0.36, 3);
  for (let i = 0; i < 5; i++) {
    const a = (i / 4) * Math.PI * 2 + variant * 0.7;
    const tilt = i === 4 ? 0.08 : 0.45 + 0.2 * (i % 2);
    const q = new Quaternion().setFromAxisAngle(new Vector3(Math.cos(a), 0, Math.sin(a)), tilt);
    const h = i === 4 ? 1.15 : 0.7 + 0.15 * (i % 3);
    fb.geometry(blade, new Matrix4().compose(new Vector3(Math.sin(a) * 0.03 * (i === 4 ? 0 : 1), 0.18 * h, -Math.cos(a) * 0.03 * (i === 4 ? 0 : 1)), q, new Vector3(1, h, 1)), i % 2 ? c : dark);
  }
  blade.dispose();
  return fb;
}

/** Couche des herbes (instanciées par variante) ; posées sur la chaussée. */
export function buildWeeds(spots: readonly WeedSpot[]): { group: Group; count: number; dispose(): void } {
  const group = new Group();
  group.name = "herbes";
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const meshes: InstancedMesh[] = [];
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  for (let v = 0; v < WEED_VARIANTS; v++) {
    const list = spots.filter((s) => s.variant === v);
    if (list.length === 0) continue;
    const mesh = new InstancedMesh(tuft(v).build(), mat, list.length);
    mesh.name = `herbes-${v}`;
    list.forEach((s, i) => mesh.setMatrixAt(i, m.compose(new Vector3(s.x, 0.06, s.y), q.setFromAxisAngle(up, s.yaw), new Vector3(s.s, s.s, s.s))));
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
