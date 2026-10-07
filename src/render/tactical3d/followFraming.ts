/**
 * Cadrage de la caméra de suivi (R1e, §6, point 7) : les soldats suivis (pieds et tête) restent dans le champ, au-dessus du
 * bord bas et sous le bord haut. Calcul pur sur les coordonnées normalisées de l'écran (−1 en bas, 1 en haut) :
 * - `shift` : décalage vertical à appliquer au contenu (> 0 : le monter, en abaissant la visée) ;
 * - `dolly` : facteur d'éloignement de la caméra quand l'escouade est plus haute ou plus large que la bande autorisée.
 */
export const FOLLOW_BAND = { low: -0.7, high: 0.78, side: 0.86 } as const;

export function followCorrection(ndc: readonly { x: number; y: number }[]): { shift: number; dolly: number } {
  if (ndc.length === 0) return { shift: 0, dolly: 1 };
  const lo = Math.min(...ndc.map((p) => p.y));
  const hi = Math.max(...ndc.map((p) => p.y));
  const side = Math.max(...ndc.map((p) => Math.abs(p.x)));
  const span = hi - lo;
  const room = FOLLOW_BAND.high - FOLLOW_BAND.low;
  const dolly = Math.max(1, span / room, side / FOLLOW_BAND.side);
  // Après éloignement, l'étendue se resserre autour du centre de l'écran : on recentre la bande dans [low, high].
  const loD = lo / dolly;
  const hiD = hi / dolly;
  const shift = loD < FOLLOW_BAND.low ? FOLLOW_BAND.low - loD : hiD > FOLLOW_BAND.high ? FOLLOW_BAND.high - hiD : 0;
  return { shift, dolly };
}

type T3 = readonly [number, number, number];
/**
 * R1e (§6, point 4) : part gardée (0 à 1) d'un fragment de feuillage en `p`, la caméra en `eye` suivant `target` : effacé
 * dans le cylindre de rayon `radius` qui joint la caméra à la cible et à moins de `near` m de l'objectif (fondu sur le tiers
 * extérieur). Même calcul que le shader (`meshVegetation.addViewClearance`).
 */
export function clearanceKeep(p: T3, eye: T3, target: T3, radius: number, near: number): number {
  const ab = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
  const ap = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]];
  const l2 = Math.max(1e-6, (ab[0] as number) ** 2 + (ab[1] as number) ** 2 + (ab[2] as number) ** 2);
  const t = Math.max(0, Math.min(1, ((ap[0] as number) * (ab[0] as number) + (ap[1] as number) * (ab[1] as number) + (ap[2] as number) * (ab[2] as number)) / l2));
  const d = Math.hypot((ap[0] as number) - (ab[0] as number) * t, (ap[1] as number) - (ab[1] as number) * t, (ap[2] as number) - (ab[2] as number) * t);
  const seg = t < 0.94 ? Math.min(1, Math.max(0, (d - radius * 0.66) / (radius * 0.34))) : 1;
  const de = Math.hypot(ap[0] as number, ap[1] as number, ap[2] as number);
  const nearK = Math.min(1, Math.max(0, (de - near * 0.66) / (near * 0.34)));
  return Math.min(seg, nearK);
}
