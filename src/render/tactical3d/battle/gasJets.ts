/**
 * Jets de gaz de l'équipement de manœuvre (CLAUDE.md § Style des soldats : corps central dans le bas du dos « avec … la
 * sortie de gaz », C). Quand la simulation dépense du gaz pour un soldat (élan sur le câble), la vue relâche une bouffée à
 * la hauteur du bas du dos ; chaque bouffée grossit et se dissipe en un peu plus d'une seconde. Le relevé se fait au dessin
 * (positions passées), sans aléa à l'image ; tailles et durées : choix de rendu (A).
 */

export interface GasPuff {
  /** Temps de bataille (s) de l'émission, position (x, y de la carte ; z hauteur de la sortie de gaz). */
  t: number;
  x: number;
  y: number;
  z: number;
}

/** Durée de vie d'une bouffée (s), intervalle minimal entre deux bouffées d'un même soldat (s), hauteur de la sortie (m). */
export const PUFF_LIFE_S = 1.2;
export const PUFF_EVERY_S = 0.12;
export const NOZZLE_Z = 0.95;
/** Bouffées gardées par soldat. */
export const PUFFS_PER_SOLDIER = Math.ceil(PUFF_LIFE_S / PUFF_EVERY_S);

/**
 * Relevé d'un soldat au dessin : `spent` vrai si son gaz a baissé depuis le dernier dessin. Ajoute une bouffée (au plus une
 * toutes les `PUFF_EVERY_S`) et retire celles qui ont fini de se dissiper. Retourne la nouvelle liste.
 */
export function trailStep(trail: readonly GasPuff[], spent: boolean, time: number, x: number, y: number, z: number): GasPuff[] {
  const alive = trail.filter((p) => time - p.t >= 0 && time - p.t < PUFF_LIFE_S);
  const last = alive[alive.length - 1];
  if (spent && (!last || time - last.t >= PUFF_EVERY_S - 1e-9)) alive.push({ t: time, x, y, z: z + NOZZLE_Z });
  return alive.slice(-PUFFS_PER_SOLDIER);
}

/** Taille (rayon, m) et opacité relative d'une bouffée à un âge donné : naît petite et dense, grossit, s'efface. */
export function puffLook(age: number): { r: number; fade: number } {
  const k = Math.min(1, Math.max(0, age / PUFF_LIFE_S));
  return { r: 0.12 + 0.75 * k, fade: 1 - k };
}
