import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Euler, IcosahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, TorusGeometry, Vector3 } from "three";
import type { BufferGeometry, Material } from "three";
import type { Physical } from "../../data/artSchemas";
import type { ACCESSORIES } from "../../data/artSchemas";
import type { Prop } from "./envTypes";
import { MATERIALS } from "./styles";
import { FaceBuilder } from "./townMesh";

/**
 * Accessoires de R1b : une géométrie par clé d'accessoire du profil (`ACCESSORIES`), instanciée (un appel de dessin par sorte).
 * - Accessoire « teinté » : sa couleur de sommet est une nuance (blanc, gris), l'instance lui donne la teinte du profil
 *   (bois, pierre…) ; les pièces de matière fixe (fer, verre, flamme) gardent leur teinte de `materiaux.json` (physiques).
 * - Certaines clés ne sont pas des objets posés mais des éléments de scène (haies, ponts, ancrages, rayons de lumière…) :
 *   `ACCESSORY_RENDER` dit lequel les dessine. Le test vérifie que chaque clé a son rendu.
 */
export const phys = (k: Physical): Color => new Color(MATERIALS.physiques[k]);
const W = (k = 1): Color => new Color(k, k, k);

type Part = (fb: FaceBuilder) => void;
const m4 = (x: number, y: number, z: number, ry = 0, s: [number, number, number] = [1, 1, 1], rx = 0, rz = 0): Matrix4 =>
  new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(rx, ry, rz, "YXZ")), new Vector3(...s));

const box = (x: number, y: number, z: number, w: number, h: number, d: number, c: Color, ry = 0): Part => (fb) => fb.geometry(new BoxGeometry(w, h, d), m4(x, y, z, ry), c);
const cyl = (x: number, y: number, z: number, r0: number, r1: number, h: number, c: Color, seg = 8, rx = 0, rz = 0, ry = 0): Part => (fb) => fb.geometry(new CylinderGeometry(r1, r0, h, seg), m4(x, y, z, ry, [1, 1, 1], rx, rz), c);
const cone = (x: number, y: number, z: number, r: number, h: number, c: Color, seg = 8, ry = 0): Part => (fb) => fb.geometry(new ConeGeometry(r, h, seg), m4(x, y, z, ry), c);
const ball = (x: number, y: number, z: number, sx: number, sy: number, sz: number, c: Color, detail = 1): Part => (fb) => fb.geometry(new IcosahedronGeometry(1, detail), m4(x, y, z, 0, [sx, sy, sz]), c);
const rock = (x: number, y: number, z: number, s: number, c: Color, ry = 0): Part => (fb) => fb.geometry(new DodecahedronGeometry(1, 0), m4(x, y, z, ry, [s * 1.2, s * 0.7, s]), c);
const sphere = (x: number, y: number, z: number, r: number, c: Color): Part => (fb) => fb.geometry(new SphereGeometry(r, 8, 6), m4(x, y, z), c);

interface PropDef {
  tinted: boolean;
  /** Axe principal local (longueur de la clôture, flèche du canon…) aligné sur la direction `r` de l'accessoire (z par défaut). */
  axis?: "x" | "z";
  parts: () => Part[];
  /** Ombres portées (les petits objets nombreux n'en portent pas : coût). */
  shadow?: boolean;
  /** Lueur propre (cristaux) : matériau émissif de cette teinte physique, allumé jour et nuit. */
  glow?: Physical;
}

const wheel = (x: number, z: number, r: number, ry: number): Part => (fb) => fb.geometry(new TorusGeometry(r, 0.06, 4, 10), m4(x, r, z, ry), W(0.55));

/** Définitions des accessoires posés. */
export const PROP_DEFS: Record<string, PropDef> = {
  fontaines: { tinted: true, shadow: true, parts: () => [cyl(0, 0.45, 0, 4.4, 4.7, 0.9, W(1), 12), cyl(0, 0.85, 0, 3.9, 3.9, 0.15, phys("verre"), 12), cyl(0, 2, 0, 0.45, 0.6, 3.2, W(0.95)), cyl(0, 3.7, 0, 1.3, 0.5, 0.5, W(1), 10)] },
  puits: { tinted: true, shadow: true, parts: () => [cyl(0, 0.45, 0, 0.95, 1, 0.9, W(1), 10), cyl(0, 0.92, 0, 0.75, 0.75, 0.06, phys("verre"), 10), box(-0.85, 1.4, 0, 0.12, 2, 0.12, W(0.6)), box(0.85, 1.4, 0, 0.12, 2, 0.12, W(0.6)), cyl(0, 2.3, 0, 0.1, 0.1, 1.9, W(0.6), 6, 0, Math.PI / 2), cone(0, 2.75, 0, 1.25, 0.8, W(0.7), 4, Math.PI / 4)] },
  etals: { axis: "x", tinted: false, shadow: true, parts: () => [box(-1.2, 1.2, 0, 0.1, 2.4, 0.1, phys("ecorce")), box(1.2, 1.2, 0, 0.1, 2.4, 0.1, phys("ecorce")), box(0, 1, 0, 2.6, 0.12, 1.4, phys("ecorce")), cone(0, 2.7, 0, 2, 0.8, phys("toile_claire"), 4, Math.PI / 4)] },
  charrettes: { tinted: true, shadow: true, parts: () => [box(0, 1, 0, 1.6, 0.12, 3, W(1)), box(-0.78, 1.35, 0, 0.08, 0.6, 3, W(0.9)), box(0.78, 1.35, 0, 0.08, 0.6, 3, W(0.9)), box(0, 1.35, -1.46, 1.6, 0.6, 0.08, W(0.9)), wheel(-0.9, 0.5, 0.62, Math.PI / 2), wheel(0.9, 0.5, 0.62, Math.PI / 2), box(0, 0.75, 2.4, 0.1, 0.1, 2, W(0.8))] },
  charrettes_abandonnees: { tinted: true, shadow: true, parts: () => [box(0, 0.55, 0, 1.6, 0.12, 3, W(0.75), 0.15), box(-0.78, 0.85, 0.3, 0.08, 0.5, 2.2, W(0.7)), wheel(-0.9, 0.5, 0.62, Math.PI / 2), (fb) => fb.geometry(new TorusGeometry(0.62, 0.06, 4, 10), m4(1.2, 0.08, -0.6, 0, [1, 1, 1], Math.PI / 2), W(0.5)), box(0, 0.3, 2.2, 0.1, 0.1, 2, W(0.6), 0.4)] },
  lanternes: { tinted: false, parts: () => [box(0, 1.6, 0, 0.1, 3.2, 0.1, phys("fer")), box(0.25, 3.1, 0, 0.5, 0.06, 0.06, phys("fer")), box(0.45, 2.85, 0, 0.26, 0.4, 0.26, phys("braise"))] },
  lampadaires: { tinted: false, parts: () => [cyl(0, 2.1, 0, 0.11, 0.07, 4.2, phys("fer"), 6), cyl(0, 4.45, 0, 0.16, 0.22, 0.5, phys("braise"), 6), cone(0, 4.85, 0, 0.3, 0.3, phys("fer"), 6)] },
  tonneaux: { tinted: true, parts: () => [cyl(0, 0.45, 0, 0.32, 0.32, 0.9, W(0.9), 10), cyl(0.7, 0.45, 0.2, 0.32, 0.32, 0.9, W(0.8), 10), cyl(0.35, 1.05, 0.1, 0.32, 0.32, 0.3, W(0.85), 10, Math.PI / 2)] },
  caisses: { tinted: true, parts: () => [box(0, 0.4, 0, 0.8, 0.8, 0.8, W(1)), box(0.9, 0.35, 0.1, 0.7, 0.7, 0.7, W(0.85), 0.3), box(0.3, 1.1, 0.05, 0.6, 0.6, 0.6, W(0.95), 0.5)] },
  cordes_a_linge: { axis: "x", tinted: false, parts: () => [box(-3, 1.4, 0, 0.08, 2.8, 0.08, phys("ecorce")), box(3, 1.4, 0, 0.08, 2.8, 0.08, phys("ecorce")), box(0, 2.6, 0, 6, 0.02, 0.02, phys("corde")), box(-1.5, 2.2, 0, 0.8, 0.8, 0.02, phys("toile_claire")), box(0.6, 2.25, 0, 0.6, 0.7, 0.02, phys("toile_claire"))] },
  cordes: { tinted: false, parts: () => [box(0, 4, 0, 0.04, 8, 0.04, phys("corde")), box(0, 0.3, 0, 0.5, 0.6, 0.5, phys("ecorce"))] },
  canons: { tinted: false, shadow: true, parts: () => [box(0, 0.45, 0, 1.4, 0.5, 2.2, phys("ecorce")), cyl(0, 1, 0.3, 0.32, 0.22, 3.2, phys("fer_canon"), 10, Math.PI / 2), wheel(-0.8, 0, 0.45, Math.PI / 2), wheel(0.8, 0, 0.45, Math.PI / 2)] },
  rails: { tinted: false, parts: () => [box(-1.1, 0.08, 0, 0.12, 0.16, 9, phys("fer")), box(1.1, 0.08, 0, 0.12, 0.16, 9, phys("fer")), ...[-4, -2, 0, 2, 4].map((z) => box(0, 0.03, z, 2.8, 0.06, 0.25, phys("ecorce")))] },
  drapeaux: { tinted: true, parts: () => [cyl(0, 3.5, 0, 0.06, 0.05, 7, phys("fer"), 6), box(0.75, 6.2, 0, 1.4, 0.9, 0.03, W(1))] },
  escaliers: { tinted: true, shadow: true, parts: () => Array.from({ length: 8 }, (_, k) => box(0, 0.15 + k * 0.3, -k * 0.35, 2.4, 0.3, 0.35, W(0.95))) },
  abreuvoirs: { tinted: true, parts: () => [box(0, 0.35, 0, 2.6, 0.7, 0.8, W(0.9)), box(0, 0.62, 0, 2.4, 0.06, 0.6, phys("verre"))] },
  rateliers: { axis: "x", tinted: true, parts: () => [box(0, 0.9, 0, 2.4, 0.1, 0.4, W(1)), box(-1.1, 0.6, 0, 0.1, 1.2, 0.1, W(0.9)), box(1.1, 0.6, 0, 0.1, 1.2, 0.1, W(0.9)), ...[-0.8, -0.4, 0, 0.4, 0.8].map((x) => box(x, 1.2, 0.1, 0.05, 1.6, 0.05, phys("fer")))] },
  ecuries: { axis: "x", tinted: true, shadow: true, parts: () => [box(-3, 1.3, 1.4, 0.2, 2.6, 0.2, W(0.8)), box(3, 1.3, 1.4, 0.2, 2.6, 0.2, W(0.8)), box(0, 2.7, 0, 6.6, 0.15, 3.4, W(0.9)), box(0, 1.2, -1.6, 6.6, 2.4, 0.15, W(0.95)), ...[-1.5, 0, 1.5].map((x) => box(x, 0.6, 0, 0.1, 1.2, 3, W(0.85)))] },
  clotures: { axis: "x", tinted: true, parts: () => [box(-1.5, 0.6, 0, 0.12, 1.2, 0.12, W(0.85)), box(1.5, 0.6, 0, 0.12, 1.2, 0.12, W(0.85)), box(0, 0.95, 0, 3, 0.08, 0.06, W(1)), box(0, 0.5, 0, 3, 0.08, 0.06, W(1))] },
  palissade: { axis: "x", tinted: true, shadow: true, parts: () => Array.from({ length: 10 }, (_, k) => cyl(-1.35 + k * 0.3, 1.6, 0, 0.14, 0.12, 3.2 + (k % 3) * 0.2, W(0.85 + (k % 2) * 0.1), 5)).concat(Array.from({ length: 10 }, (_, k) => cone(-1.35 + k * 0.3, 3.35 + (k % 3) * 0.2, 0, 0.14, 0.4, W(0.8), 5))) },
  meules_de_foin: { tinted: true, shadow: true, parts: () => [cyl(0, 1, 0, 1.6, 1.5, 2, W(1), 12), cone(0, 2.6, 0, 1.6, 1.4, W(0.95), 12)] },
  bornes: { tinted: true, parts: () => [cyl(0, 0.4, 0, 0.22, 0.17, 0.8, W(1), 8), sphere(0, 0.8, 0, 0.17, W(1))] },
  grilles: { axis: "x", tinted: false, parts: () => [box(0, 0.08, 0, 3, 0.16, 0.08, phys("fer")), box(0, 1.6, 0, 3, 0.05, 0.05, phys("fer")), ...Array.from({ length: 13 }, (_, k) => box(-1.44 + k * 0.24, 0.9, 0, 0.03, 1.8, 0.03, phys("fer")))] },
  bancs: { axis: "x", tinted: true, parts: () => [box(0, 0.45, 0, 1.8, 0.08, 0.45, W(1)), box(0, 0.75, -0.2, 1.8, 0.5, 0.06, W(0.95)), box(-0.8, 0.22, 0, 0.08, 0.45, 0.4, phys("fer")), box(0.8, 0.22, 0, 0.08, 0.45, 0.4, phys("fer"))] },
  statues: { tinted: true, shadow: true, parts: () => [box(0, 1, 0, 2.2, 2, 2.2, W(0.95)), cyl(0, 2.9, 0, 0.45, 0.5, 1.8, W(1), 8), ball(0, 4.1, 0, 0.32, 0.4, 0.32, W(1)), cyl(0.55, 3.3, 0, 0.12, 0.12, 1.2, W(1), 6, 0, -0.6)] },
  arbres_alignement: { tinted: false, shadow: true, parts: () => [cyl(0, 1.6, 0, 0.18, 0.14, 3.2, phys("ecorce"), 6), ball(0, 4.4, 0, 2, 1.9, 2, phys("feuillage")), ball(0.7, 5.2, 0.4, 1.3, 1.2, 1.3, phys("feuillage_clair")), box(0, 0.03, 0, 1.6, 0.06, 1.6, phys("fer"))] },
  bois_empile: { axis: "x", tinted: true, parts: () => Array.from({ length: 9 }, (_, k) => cyl(-0.9 + (k % 3) * 0.6 + (Math.floor(k / 3) % 2) * 0.3, 0.3 + Math.floor(k / 3) * 0.5, 0, 0.26, 0.26, 2.6, W(0.85 + (k % 2) * 0.12), 7, Math.PI / 2)) },
  roues: { tinted: true, parts: () => [(fb) => fb.geometry(new TorusGeometry(0.62, 0.07, 4, 12), m4(0, 0.7, 0, 0, [1, 1, 1], 0.25), W(0.9)), box(0, 0.7, 0, 0.08, 1.2, 0.08, W(0.8), 0)] },
  souches: { tinted: false, parts: () => [cyl(0, 0.3, 0, 0.6, 0.45, 0.6, phys("ecorce"), 8), cyl(0, 0.61, 0, 0.44, 0.44, 0.02, phys("herbe_seche"), 8)] },
  rochers: { tinted: true, shadow: true, parts: () => [rock(0, 0.5, 0, 1.2, W(1)), rock(1.3, 0.3, 0.6, 0.7, W(0.9), 1), rock(-0.9, 0.25, -0.7, 0.5, W(0.85), 2)] },
  eboulis: { tinted: true, parts: () => Array.from({ length: 9 }, (_, k) => rock(Math.cos(k * 2.4) * (1 + k * 0.4), 0.2, Math.sin(k * 2.4) * (1 + k * 0.4), 0.35 + (k % 3) * 0.15, W(0.8 + (k % 3) * 0.08), k)) },
  roseaux: { tinted: false, parts: () => Array.from({ length: 11 }, (_, k) => cyl(Math.cos(k * 1.7) * 0.6, 0.9, Math.sin(k * 2.3) * 0.6, 0.03, 0.01, 1.8 + (k % 3) * 0.3, k % 4 === 0 ? phys("herbe_seche") : phys("roseau"), 3, (k % 5) * 0.06 - 0.1, (k % 3) * 0.08 - 0.08)) },
  pontons: { tinted: true, shadow: true, parts: () => [box(0, 0.9, 0, 2.4, 0.15, 10, W(1)), ...[-4.5, -1.5, 1.5, 4.5].flatMap((z) => [box(-1.1, 0.2, z, 0.2, 2.2, 0.2, W(0.75)), box(1.1, 0.2, z, 0.2, 2.2, 0.2, W(0.75))])] },
  barques: { tinted: true, shadow: true, parts: () => [(fb) => fb.geometry(new SphereGeometry(1, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), m4(0, 0.55, 0, 0, [1, 0.55, 2.8]), W(0.9)), box(0, 0.45, 0, 1.6, 0.05, 0.25, W(0.75))] },
  murs_effondres: { axis: "x", tinted: true, shadow: true, parts: () => [box(0, 1.2, 0, 6, 2.4, 0.6, W(1)), box(2.2, 2.6, 0, 1.4, 0.6, 0.6, W(0.95)), rock(-3.4, 0.3, 0.8, 0.6, W(0.9)), rock(-2.6, 0.25, 1.1, 0.45, W(0.85), 2), rock(3.6, 0.2, -0.9, 0.5, W(0.9), 3)] },
  herbes_hautes: { tinted: false, parts: () => Array.from({ length: 9 }, (_, k) => cone(Math.cos(k * 2.2) * 0.5, 0.45, Math.sin(k * 2.2) * 0.5, 0.18, 0.9 + (k % 3) * 0.25, k % 3 === 0 ? phys("herbe_seche") : phys("feuillage_clair"), 3, k)) },
  broussailles: { tinted: false, parts: () => [ball(0, 0.5, 0, 1.1, 0.6, 1, phys("feuillage"), 0), ball(0.8, 0.4, 0.3, 0.7, 0.45, 0.7, phys("herbe_seche"), 0), ball(-0.6, 0.35, -0.4, 0.6, 0.4, 0.6, phys("feuillage_clair"), 0)] },
  cheminees_usine: { tinted: true, shadow: true, parts: () => [cyl(0, 14, 0, 1.8, 1.1, 28, W(0.95), 10), cyl(0, 28.2, 0, 1.3, 1.3, 0.8, phys("suie"), 10)] },
  colonnes: { tinted: true, shadow: true, parts: () => [box(0, 0.25, 0, 1.4, 0.5, 1.4, W(0.95)), cyl(0, 4.5, 0, 0.5, 0.45, 8, W(1), 12), box(0, 8.75, 0, 1.4, 0.5, 1.4, W(0.95))] },
  bougies: { tinted: false, parts: () => [box(0, 0.45, 0, 1.2, 0.9, 0.5, phys("ecorce")), ...[-0.4, -0.15, 0.1, 0.35].flatMap((x, k) => [cyl(x, 1.0 + k * 0.03, 0, 0.04, 0.04, 0.22 + k * 0.06, phys("cire"), 6), sphere(x, 1.16 + k * 0.06, 0, 0.035, phys("flamme"))])] },
  tentes: { tinted: true, shadow: true, parts: () => [(fb) => fb.geometry(new CylinderGeometry(0.01, 2.2, 2.6, 3, 1), m4(0, 1.3, 0, 0, [1, 1, 1.8], 0, 0), W(1)), box(0, 1.3, 2.2, 0.06, 2.6, 0.06, phys("ecorce"))] },
  feux_de_camp: { tinted: false, parts: () => [...[0, 1, 2, 3, 4, 5].map((k) => rock(Math.cos(k * 1.05) * 0.8, 0.12, Math.sin(k * 1.05) * 0.8, 0.22, W(0.45), k)), cone(0, 0.45, 0, 0.35, 0.9, phys("flamme"), 6), ...[0, 1, 2].map((k) => cyl(0, 0.15, 0, 0.06, 0.06, 1.3, phys("ecorce"), 4, Math.PI / 2, 0, k))] },
  lueurs: { tinted: true, glow: "cristal", parts: () => [0, 1, 2, 3, 4].map((k) => (fb: FaceBuilder) => fb.geometry(new ConeGeometry(0.22 + (k % 2) * 0.1, 1.4 + (k % 3) * 0.7, 5), m4(Math.cos(k * 1.3) * 0.4, 0.6 + (k % 3) * 0.3, Math.sin(k * 1.3) * 0.4, k, [1, 1, 1], (k - 2) * 0.22, (k % 3 - 1) * 0.25), W(0.9 + (k % 2) * 0.1))) },
  gravats: { tinted: true, shadow: true, parts: () => Array.from({ length: 10 }, (_, k) => rock(Math.cos(k * 2.1) * (0.6 + k * 0.35), 0.25, Math.sin(k * 2.7) * (0.6 + k * 0.3), 0.35 + (k % 4) * 0.15, W(0.75 + (k % 3) * 0.1), k)) },
};

/**
 * Rendu de chaque clé d'accessoire des profils : « prop » (objet instancié de `PROP_DEFS`) ou l'élément de scène qui la porte.
 */
export const ACCESSORY_RENDER: Record<(typeof ACCESSORIES)[number], string> = {
  fontaines: "prop",
  puits: "prop",
  etals: "prop",
  charrettes: "prop",
  charrettes_abandonnees: "prop",
  lanternes: "prop",
  lampadaires: "prop",
  tonneaux: "prop",
  caisses: "prop",
  cordes_a_linge: "prop",
  cordes: "prop",
  canons: "prop",
  rails: "prop",
  drapeaux: "prop",
  escaliers: "prop",
  abreuvoirs: "prop",
  rateliers: "prop",
  ecuries: "prop",
  clotures: "prop",
  palissade: "prop",
  meules_de_foin: "prop",
  bornes: "prop",
  grilles: "prop",
  bancs: "prop",
  statues: "prop",
  arbres_alignement: "prop",
  bois_empile: "prop",
  roues: "prop",
  souches: "prop",
  rochers: "prop",
  eboulis: "prop",
  roseaux: "prop",
  pontons: "prop",
  barques: "prop",
  murs_effondres: "prop",
  herbes_hautes: "prop",
  broussailles: "prop",
  cheminees_usine: "prop",
  colonnes: "prop",
  bougies: "prop",
  tentes: "prop",
  feux_de_camp: "prop",
  enclos: "scène : clôtures en rectangle (envCountry.fenceRect)",
  potagers: "scène : jardins de terre derrière les maisons (pavage « terre »)",
  jardins: "scène : parterres et arbres d'alignement (envTown)",
  moulins: "scène : repère « moulin » (meshBuildings)",
  ponts: "scène : ponts de la rivière et des canaux (meshTerrain)",
  haies: "scène : haies instanciées le long des bords de cellule (meshTerrain)",
  sentier: "scène : chemins de terre (terrain.roads, meshTerrain)",
  gue: "scène : pierres de gué là où le chemin franchit la rivière, sans pont (envMore.generateWaters)",
  points_ancrage: "scène : points d'ancrage marqués sur les branches des arbres géants (meshNature)",
  branches_basses: "scène : branches maîtresses des arbres géants (meshNature)",
  racines: "scène : contreforts racinaires des arbres géants (meshNature)",
  mousse: "scène : mousse sur les troncs géants (meshNature)",
  rayons_lumiere: "scène : rayons de lumière sous la voûte (meshNature)",
  sous_bois: "scène : buissons du sous-bois (arbres « buisson »)",
  embruns: "scène : frange d'écume sur la ligne d'eau et gouttelettes (meshNature.buildSpray)",
};

export interface PropMeshes {
  meshes: InstancedMesh[];
  materials: Material[];
  dispose(): void;
}

const geoCache = new Map<string, BufferGeometry>();
export function propGeometry(kind: string): BufferGeometry | null {
  const def = PROP_DEFS[kind];
  if (!def) return null;
  let g = geoCache.get(kind);
  if (!g) {
    const fb = new FaceBuilder();
    for (const p of def.parts()) p(fb);
    g = fb.build();
    geoCache.set(kind, g);
  }
  return g;
}

/** Instancie les accessoires par sorte. `limit` borne le nombre par sorte (qualité). */
export function buildProps(props: readonly Prop[], limit = Infinity): PropMeshes {
  const byKind = new Map<string, Prop[]>();
  for (const p of props) {
    if (!PROP_DEFS[p.kind]) continue;
    const list = byKind.get(p.kind) ?? [];
    list.push(p);
    byKind.set(p.kind, list);
  }
  const meshes: InstancedMesh[] = [];
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const materials: Material[] = [material];
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  for (const [kind, list] of [...byKind.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const def = PROP_DEFS[kind] as PropDef;
    const geo = propGeometry(kind) as BufferGeometry;
    const n = Math.min(list.length, limit);
    let mat = material;
    if (def.glow) {
      mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.25, emissive: phys(def.glow), emissiveIntensity: 0.55 });
      materials.push(mat);
    }
    const im = new InstancedMesh(geo, mat, n);
    im.name = `accessoires-${kind}`;
    im.castShadow = def.shadow ?? false;
    im.receiveShadow = true;
    for (let i = 0; i < n; i++) {
      const p = list[i] as Prop;
      // Axe z local sur la direction r : rotation π/2 − r ; axe x local : rotation −r.
      im.setMatrixAt(i, m.compose(new Vector3(p.x, p.z, p.y), q.setFromAxisAngle(up, def.axis === "x" ? -p.r : -p.r + Math.PI / 2), new Vector3(p.s, p.s, p.s)));
      im.setColorAt(i, def.tinted ? new Color(p.color) : new Color(1, 1, 1));
    }
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    meshes.push(im);
  }
  return {
    meshes,
    materials,
    dispose() {
      for (const m of materials) m.dispose();
      for (const im of meshes) im.dispose();
    },
  };
}
