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
}

export const QUALITY: Record<Quality, QualityDef> = {
  bas: { pixelRatio: 0.75, shadows: false, shadowMap: 512, antialias: false, lamps: 2, anisotropy: 1 },
  moyen: { pixelRatio: 1, shadows: true, shadowMap: 1024, antialias: false, lamps: 4, anisotropy: 4 },
  haut: { pixelRatio: 2, shadows: true, shadowMap: 2048, antialias: true, lamps: 8, anisotropy: 8 },
};

/** Résolution interne effective : jamais au-delà de la densité de l'écran. */
export function effectivePixelRatio(q: Quality, devicePixelRatio: number): number {
  return Math.min(QUALITY[q].pixelRatio, Math.max(1, devicePixelRatio));
}
