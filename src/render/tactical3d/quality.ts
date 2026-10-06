/**
 * Réglage de qualité de l'essai 3D (R1.6). Les postes coûteux, sur une machine modeste comme en WebGL logiciel :
 * - le nombre de pixels calculés (résolution interne) ;
 * - les ombres portées (une seconde passe de rendu depuis le soleil) ;
 * - l'anticrénelage multi-échantillons ;
 * - les lumières ponctuelles de nuit (chaque pixel les additionne toutes).
 */
export type Quality = "bas" | "moyen" | "haut";
export const QUALITIES: readonly Quality[] = ["bas", "moyen", "haut"];

export interface QualityDef {
  /** Résolution interne / résolution de l'écran (plafonnée par la densité de l'écran). */
  pixelRatio: number;
  shadows: boolean;
  shadowMap: number;
  antialias: boolean;
  /** Lumières de réverbère actives la nuit. */
  lamps: number;
  anisotropy: number;
  /** R1b : distances de bascule des niveaux de détail de la végétation (proche → loin → rien), en m. */
  lodNear: number;
  lodFar: number;
  /** R1b : part des arbres gardés, taille de la texture de sol, particules de météo, feux qui éclairent. */
  vegetation: number;
  groundTex: number;
  particles: number;
  fireLights: number;
}

export const QUALITY: Record<Quality, QualityDef> = {
  bas: { pixelRatio: 0.75, shadows: false, shadowMap: 512, antialias: false, lamps: 2, anisotropy: 1, lodNear: 180, lodFar: 900, vegetation: 0.32, groundTex: 1024, particles: 1500, fireLights: 1 },
  moyen: { pixelRatio: 1, shadows: true, shadowMap: 1024, antialias: false, lamps: 4, anisotropy: 4, lodNear: 320, lodFar: 1500, vegetation: 0.6, groundTex: 2048, particles: 5000, fireLights: 3 },
  haut: { pixelRatio: 2, shadows: true, shadowMap: 2048, antialias: true, lamps: 8, anisotropy: 8, lodNear: 520, lodFar: 2400, vegetation: 1, groundTex: 4096, particles: 12000, fireLights: 6 },
};

/** Résolution interne effective : jamais au-delà de la densité de l'écran. */
export function effectivePixelRatio(q: Quality, devicePixelRatio: number): number {
  return Math.min(QUALITY[q].pixelRatio, Math.max(1, devicePixelRatio));
}
