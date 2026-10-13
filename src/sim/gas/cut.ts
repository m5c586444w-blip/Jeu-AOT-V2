import type { GasBalance } from "../../data/balance";
import type { CutInput, CutWindow } from "./types";

/** Chaîne de létalité (spec 26 §4) : approche → ancrage → fenêtre de coupe (≈ 0,2 s) → résultat. Fonctions pures. */

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * Réussite = f(vitesse, angle, compétence, usure de la lame, stress). Monotone : croît avec la vitesse (jusqu'à saturation) et
 * la compétence, décroît avec l'écart d'angle, l'usure et le stress.
 */
export function cutWindow(i: CutInput, b: GasBalance): CutWindow {
  const c = b.cut;
  const speedTerm = c.speed_k * clamp(i.speed / c.speed_ref, 0, 1.5);
  const angleTerm = c.angle_k * clamp(Math.abs(i.angle) / (Math.PI / 2), 0, 1);
  const raw = c.base + speedTerm - angleTerm + c.skill_k * clamp(i.skill, 0, 100);
  const p = raw - c.wear_k * clamp(i.bladeWear, 0, 1) * raw - c.stress_k * clamp(i.stress, 0, 1) * raw;
  const probability = clamp(p, c.min_p, c.max_p);
  // Cône d'ouverture : plus la réussite est probable, plus le cône est large (affichage en pause active).
  const [lo, hi] = c.cone_half_angle_deg;
  const t = (probability - c.min_p) / (c.max_p - c.min_p);
  const coneHalfAngle = ((lo + (hi - lo) * t) * Math.PI) / 180;
  return { probability, durationS: c.window_s, coneHalfAngle };
}

/** Résultat d'une coupe avec un tirage u ∈ [0, 1) fourni par l'appelant (Rng injecté) : nuque tranchée ssi u < probabilité. */
export function resolveCut(window: CutWindow, u: number): "nuque" | "raté" {
  return u < window.probability ? "nuque" : "raté";
}
