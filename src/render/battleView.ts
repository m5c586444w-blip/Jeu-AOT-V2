import type { TacticalWorldMap } from "../sim/tactical/map";
import type { BattleState } from "../sim/tactical/types";

/**
 * Interface commune des vues de bataille (R2+) : la vue 2D (Pixi, `render/tactical/view2d.ts`) et la vue 3D (three.js,
 * `render/tactical3d/battle/view3d.ts`, chargée à la demande) l'implémentent. La vue lit l'état de la simulation en lecture
 * seule ; elle ne le modifie jamais (le rendu n'influence pas la bataille).
 */

/** Unité désignée à l'écran. */
export type PickHit = { kind: "soldat" | "troupe" | "titan"; index: number };

/** Caméras : vue stratégique libre (du dessus, zoom jusqu'aux soldats) ou suivi à la troisième personne. */
export type CameraMode = "strategique" | "suivi";

/** Repères de l'interface dessinés par la vue : sélection, destinations, zones de tir et de porteur, rectangle de sélection. */
export interface ViewOverlay {
  /** Soldats (indices) et fantassins (indices) sélectionnés. */
  soldiers: ReadonlySet<number>;
  troops: ReadonlySet<number>;
  /** Destinations (escouades en marche) et zones (tir sur zone, porteurs). */
  dests: readonly { x: number; y: number }[];
  zones: readonly { x: number; y: number; r: number; kind: "tir" | "porteur" }[];
}

export type ViewQuality = "bas" | "moyen" | "haut";
export type Violence = "sobre" | "realiste";

export interface ViewOptions {
  quality: ViewQuality;
  violence: Violence;
}

export interface BattleView {
  readonly kind: "2d" | "3d";
  readonly canvas: HTMLCanvasElement;
  /** Décor dérivé de la carte de la simulation (bâtiments, arbres, rochers, mur, ancrages). */
  setMap(m: TacticalWorldMap): void;
  /** Cadrage d'ouverture : tous les points donnés dans le champ. */
  frame(points: readonly { x: number; y: number; z: number }[]): void;
  /** Dessine l'état (lecture seule) ; `alpha` interpole entre l'état d'avant le pas (`prev`) et l'état courant. */
  draw(st: BattleState, prev: readonly { x: number; y: number; z: number }[] | null, alpha: number, overlay: ViewOverlay): void;
  render(): void;
  /** Point de la carte → pixel de la toile (null : derrière la caméra). */
  toScreen(x: number, y: number, z: number): [number, number] | null;
  /** Pixel de la toile → point du sol de la carte (null : hors du sol). */
  groundAt(sx: number, sy: number): { x: number; y: number } | null;
  /** Unité sous un pixel. */
  pick(st: BattleState, sx: number, sy: number): PickHit | null;
  zoomAt(sx: number, sy: number, factor: number): void;
  panBy(dx: number, dy: number): void;
  rotateBy(rad: number): void;
  /** Caméra : stratégique libre, ou suivi d'un point (escouade, Titan) qui avance vers `heading`. */
  setCamera(mode: CameraMode): void;
  readonly camera: CameraMode;
  follow(x: number, y: number, z: number, heading: number, height: number): void;
  setOptions(o: ViewOptions): void;
  /** Mesures : appels de dessin, triangles, unités par niveau de détail. */
  stats(): { calls: number; triangles: number; detail: number; crowd: number; markers: number };
  /** Zoom (1 = cadrage d'ouverture), pour l'affichage et les contrôles. */
  readonly zoomLevel: number;
  destroy(): void;
}
