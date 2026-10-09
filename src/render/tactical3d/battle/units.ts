import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, Matrix4, Quaternion, Vector3 } from "three";
import type { BufferGeometry } from "three";
import { FaceBuilder } from "../townMesh";
import { unitSphere } from "../rig";
import type { ViewQuality } from "../../battleView";

/**
 * Unités de la bataille 3D (R2+) : géométries des fantassins et des repères, niveaux de détail.
 * - Détail complet (figure articulée de R1, câbles) près de la caméra, en nombre limité par la qualité ;
 * - foule instanciée (une géométrie à couleurs de sommet, un appel de dessin pour toutes les unités) au-delà ;
 * - repères (pastille et fanion de camp) au loin, pour garder la lecture des lignes à 400 unités.
 */

export type Tier = "detail" | "foule" | "repere";

export interface LodDef {
  /** Distance (m) caméra-unité en deçà de laquelle une unité peut recevoir une figure complète. */
  detailM: number;
  /** Nombre maximal de figures complètes. */
  detailMax: number;
  /** Distance (m) au-delà de laquelle l'unité n'est plus qu'un repère. */
  markerM: number;
}

export const LOD: Record<ViewQuality, LodDef> = {
  bas: { detailM: 35, detailMax: 8, markerM: 260 },
  moyen: { detailM: 60, detailMax: 24, markerM: 420 },
  haut: { detailM: 90, detailMax: 48, markerM: 650 },
};

/** Niveau de détail d'une unité selon sa distance à la caméra (le nombre de figures complètes est plafonné à part). */
export function tierOf(distM: number, q: ViewQuality): Tier {
  const d = LOD[q];
  return distM <= d.detailM ? "detail" : distM <= d.markerM ? "foule" : "repere";
}

const H = 1.8;
const LEG = 0.47 * H;
const TORSO = 0.3 * H;
const NECK = 0.05 * H;
const HEAD = 0.13 * H;

function at(x: number, y: number, z: number, s: [number, number, number] = [1, 1, 1], rx = 0, rz = 0): Matrix4 {
  const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), rx).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), rz));
  return new Matrix4().compose(new Vector3(x, y, z), q, new Vector3(...s));
}

/**
 * Fantassin (foule instanciée) : uniforme en blanc cassé (teinté par instance : la couleur du camp), peau, bottes, casque ou
 * képi sombre, fusil porté. Aucun uniforme de l'œuvre n'est reproduit : teintes de jeu [A].
 * R3 : deux silhouettes au loin, comme les tenues de près — Paradis (Garnison : coiffe souple, écharpe rouge, sans sac) et
 * Marley (casque à bord, sac, bandes molletières claires).
 */
export function troopGeometry(style: "paradis" | "marley" = "marley"): BufferGeometry {
  if (style === "paradis") return paradisTroop();
  const fb = new FaceBuilder();
  const S = unitSphere(8);
  const cloth = new Color(0xeeeeee);
  const dark = new Color(0x3a352e);
  const skin = new Color(0xd9b49a);
  for (const s of [1, -1]) {
    fb.geometry(new CylinderGeometry(0.068, 0.052, LEG, 6), at(s * 0.09, LEG / 2, 0), cloth);
    fb.geometry(new CylinderGeometry(0.06, 0.06, 0.18, 6), at(s * 0.09, 0.09, 0.02), dark);
    fb.geometry(new CylinderGeometry(0.05, 0.04, 0.56, 6), at(s * 0.2, LEG + TORSO - 0.3, 0.05, [1, 1, 1], -0.5), cloth);
  }
  fb.geometry(new CylinderGeometry(0.16, 0.14, TORSO, 8), at(0, LEG + TORSO / 2, 0, [1, 1, 0.72]), cloth);
  fb.geometry(new BoxGeometry(0.34, 0.06, 0.24), at(0, LEG + 0.02, 0), dark);
  fb.geometry(S, at(0, LEG + TORSO + NECK + HEAD * 0.5, 0.01, [0.095, HEAD * 0.5, 0.11]), skin);
  // Couvre-chef (casque bas) et sac.
  fb.geometry(S, at(0, LEG + TORSO + NECK + HEAD * 0.82, 0, [0.13, HEAD * 0.32, 0.14]), dark);
  fb.geometry(new BoxGeometry(0.26, 0.3, 0.12), at(0, LEG + TORSO * 0.62, -0.17), dark);
  // Fusil tenu en travers (crosse à la hanche, canon vers l'avant-haut).
  fb.geometry(new BoxGeometry(0.035, 0.035, 1.05), at(0.12, LEG + TORSO * 0.55, 0.25, [1, 1, 1], -0.55), dark);
  return fb.build();
}

/** Repère lointain : pastille au sol et fanion vertical (couleur du camp par instance). */
export function markerGeometry(): BufferGeometry {
  const fb = new FaceBuilder();
  const white = new Color(0xffffff);
  fb.geometry(new CylinderGeometry(0.9, 0.9, 0.15, 10), at(0, 0.08, 0), white);
  fb.geometry(new CylinderGeometry(0.12, 0.12, 2.6, 5), at(0, 1.3, 0), white);
  fb.geometry(new ConeGeometry(0.55, 1.1, 6), at(0, 3.0, 0), white);
  return fb.build();
}

/** Pièce d'artillerie : fût, affût, deux roues (une géométrie, couleurs de sommet). */
export function cannonGeometry(): BufferGeometry {
  const fb = new FaceBuilder();
  const bronze = new Color(0x5b4a32);
  const wood = new Color(0x5a3f26);
  const iron = new Color(0x2c2c2c);
  fb.geometry(new CylinderGeometry(0.16, 0.22, 2.4, 10), at(0, 1.05, 0.2, [1, 1, 1], Math.PI / 2 - 0.12), bronze);
  fb.geometry(new BoxGeometry(0.45, 0.25, 2.2), at(0, 0.6, -0.7, [1, 1, 1], 0.25), wood);
  for (const s of [1, -1]) fb.geometry(new CylinderGeometry(0.62, 0.62, 0.1, 12), at(s * 0.42, 0.62, 0.1, [1, 1, 1], 0, Math.PI / 2), iron);
  return fb.build();
}

/**
 * Couleurs de la foule des fantassins (R3) : celles des tenues vues de près (veste de la Garnison, vareuse olive de Marley), pour
 * que le passage d'une figure en tenue à la foule ne se voie pas dans un rang. Les repères lointains gardent les couleurs de camp.
 */
export const UNIFORM_COLORS = {
  paradis: new Color(0x6a7080),
  marley: new Color(0x6b6247),
} as const;

/** Couleurs de camp (teintes de jeu [A]) : Paradis (soldats, fantassins), adversaire, morts. */
export const SIDE_COLORS = {
  soldat: new Color(0x5f7f63),
  allie: new Color(0x7d8a9a),
  ennemi: new Color(0x8a6a48),
  titan: new Color(0xb5786a),
  mort: new Color(0x4a4440),
} as const;

function paradisTroop(): BufferGeometry {
  const fb = new FaceBuilder();
  const S = unitSphere(8);
  const cloth = new Color(0xeeeeee);
  const dark = new Color(0x3a352e);
  const skin = new Color(0xd9b49a);
  const sash = new Color(0x8e2f2f);
  // Pantalon sombre, comme la tenue de près (la couleur d'instance multiplie : ce gris-brun en ressort presque noir).
  const trousers = new Color(0x7a6f5e);
  for (const s of [1, -1]) {
    fb.geometry(new CylinderGeometry(0.068, 0.052, LEG, 6), at(s * 0.09, LEG / 2, 0), trousers);
    fb.geometry(new CylinderGeometry(0.06, 0.06, 0.22, 6), at(s * 0.09, 0.11, 0.02), dark);
    fb.geometry(new CylinderGeometry(0.05, 0.04, 0.56, 6), at(s * 0.2, LEG + TORSO - 0.3, 0.05, [1, 1, 1], -0.5), cloth);
  }
  fb.geometry(new CylinderGeometry(0.16, 0.14, TORSO, 8), at(0, LEG + TORSO / 2, 0, [1, 1, 0.72]), cloth);
  fb.geometry(new CylinderGeometry(0.165, 0.165, 0.08, 8), at(0, LEG + 0.06, 0, [1, 1, 0.74]), sash);
  fb.geometry(S, at(0, LEG + TORSO + NECK + HEAD * 0.5, 0.01, [0.095, HEAD * 0.5, 0.11]), skin);
  // Coiffe souple, sans bord ; fusil porté à l'épaule.
  fb.geometry(new CylinderGeometry(0.1, 0.105, 0.07, 8), at(0, LEG + TORSO + NECK + HEAD * 0.92, 0), dark);
  fb.geometry(new BoxGeometry(0.035, 1.0, 0.035), at(-0.12, LEG + TORSO * 0.75, -0.13, [1, 1, 1], 0.1, 0.35), dark);
  return fb.build();
}
