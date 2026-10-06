import type { Generator, RoofMaterial, StyleProfile, WallMaterial } from "../../data/artSchemas";
import type { Variant } from "./styles";
import type { Bridge, TerrainData } from "./terrain";
import type { Building, Vec2 } from "./town";

/**
 * Données d'un environnement (R1b) : sortie pure des générateurs, lue par le maillage (`envMesh.ts`). Aucune teinte n'est
 * décidée ici sans venir du profil de style ou de `data/art/` (les teintes sont des chaînes « #RRGGBB » déjà résolues).
 */
export type { Generator } from "../../data/artSchemas";

export interface StyledBuilding extends Building {
  material: WallMaterial;
  cover: RoofMaterial;
  wallHex: string;
  roofHex: string;
  /** Bois (pans, portes, volets). */
  trimHex: string;
  /** Pierre du soubassement. */
  stoneHex: string;
  /** 0 intact → 1 ruine (murs arasés, toit effondré). */
  ruin: number;
  /** Niveau du rez-de-chaussée (m) ; le soubassement descend jusqu'au point le plus bas du terrain sous l'emprise. */
  base: number;
  plinth: number;
}

export type LandmarkKind =
  | "eglise"
  | "chapelle"
  | "cathedrale"
  | "palais"
  | "caserne"
  | "halle"
  | "edifice"
  | "moulin"
  | "moulin_eau"
  | "tour"
  | "donjon"
  | "chateau"
  | "usine"
  | "autel"
  | "tente"
  | "baraque"
  | "corps_de_garde"
  | "ecurie";

export interface Landmark {
  kind: LandmarkKind;
  x: number;
  y: number;
  /** Orientation (radians) : la façade principale regarde +v (vers la rue ou la place). */
  angle: number;
  /** Emprise (m) et hauteur principale (m). */
  w: number;
  d: number;
  h: number;
  base: number;
  material: WallMaterial;
  cover: RoofMaterial;
  wallHex: string;
  roofHex: string;
  trimHex: string;
  stoneHex: string;
  ruin: number;
}

/** Accessoire posé : une clé d'accessoire du profil (ou un élément de décor dérivé), une position, une échelle. */
export interface Prop {
  kind: string;
  x: number;
  y: number;
  /** Altitude du pied (m). */
  z: number;
  r: number;
  s: number;
  color: string;
}

export interface Paving {
  poly: Vec2[];
  kind: "pave" | "dalle" | "terre";
  y: number;
  color: string;
}

export interface Canal {
  path: Vec2[];
  width: number;
  level: number;
  /** Quai : hauteur du sol au bord (m). */
  quay: number;
}

export interface WallGate {
  /** Abscisse sur le tracé (m). */
  s: number;
  kind: "exterieure" | "interieure" | "porte";
  state: "ouverte" | "fermee" | "breche" | "scellee" | "passage";
}

export interface WallPath {
  /** Axe du mur, dans l'ordre. */
  path: Vec2[];
  /** Côté extérieur : la normale (−dy, dx) du sens de parcours (1) ou son opposée (−1). */
  out: 1 | -1;
  gates: WallGate[];
  /** Abscisses des canons (sur le chemin de ronde). */
  cannons: number[];
  /**
   * Brèches : abscisse, largeur ; `floor` : hauteur où commence la brèche (0 = jusqu'au sol) ; `face` : un visage de Titan-Mur
   * apparaît dans la brèche (Mur Sina : le haut du mur arraché révèle l'intérieur).
   */
  breaches: { s: number; width: number; face: boolean; floor?: number }[];
}

export interface WallLayout {
  paths: WallPath[];
  height: number;
  thickness: number;
  tint: string;
  walkway: number;
  parapet: number;
  railLength: number;
  railGauge: number;
  gateWidth: number;
  gateHeight: number;
  block: [number, number];
}

export interface GiantTree {
  x: number;
  y: number;
  /** Hauteur totale (m) et rayon du tronc au pied (m). */
  height: number;
  radius: number;
  lean: number;
  r: number;
  /** Branches maîtresses : hauteur, direction, longueur (points d'ancrage au bout et le long). */
  branches: { h: number; a: number; len: number }[];
}

export interface Shaft {
  x: number;
  y: number;
  radius: number;
  height: number;
}

export interface TitanPlacement {
  /** Classe ou Titan spécial de `data/art/titans.json`. */
  type: string;
  variant: string | null;
  x: number;
  y: number;
  angle: number;
  pose: "marche" | "saisie" | "abattu" | "debout" | "allonge" | "buste" | "course";
  seed: number;
}

export interface Fire {
  x: number;
  y: number;
  z: number;
  size: number;
}

export interface CaveData {
  /** Voûte : rayon horizontal et hauteur sous la clé (m). */
  radius: number;
  height: number;
  /** Ouvertures du plafond (puits de jour). */
  openings: Vec2[];
  kind: "ville" | "crypte" | "glace";
}

export interface View {
  eye: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export interface EnvData {
  id: string;
  seed: number;
  profile: StyleProfile;
  variant: Variant | null;
  generator: Generator;
  terrain: TerrainData | null;
  buildings: StyledBuilding[];
  landmarks: Landmark[];
  props: Prop[];
  paving: Paving[];
  canals: Canal[];
  stoneBridges: Bridge[];
  wall: WallLayout | null;
  giants: GiantTree[];
  shafts: Shaft[];
  cave: CaveData | null;
  titans: TitanPlacement[];
  fires: Fire[];
  /** Brume au sol (0–1) et niveau de la nappe (m). */
  mist: { density: number; top: number };
  views: { principale: View; seconde: View };
  /** Rayon utile de la scène (m) : brouillard, ombres, distances de détail. */
  radius: number;
  /** Points d'ancrage d'ODM (forêt géante, toits, mur) : comptés par les tests. */
  anchors: { x: number; y: number; z: number }[];
}
