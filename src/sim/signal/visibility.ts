import type { SignalBalance } from "../../data/balance";
import type { Signal, SignalColor, SignalConditions } from "./types";

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export const CLEAR: SignalConditions = { rain: 0, smoke: 0, night: false, relief: 0 };

/**
 * Rayon de visibilité d'une fusée (m) [A]. Produit de facteurs décroissants : pluie, fumée, nuit, relief. Donc
 * monotone : une condition pire ne donne jamais une portée supérieure. Plancher `min_range_m`.
 */
export function visibilityRange(color: SignalColor, c: SignalConditions, b: SignalBalance): number {
  const v = b.visibility;
  const r =
    v.base_range_m *
    (v.color_mult[color] ?? 1) *
    (1 - v.rain_k * clamp01(c.rain)) *
    (1 - v.smoke_k * clamp01(c.smoke)) *
    (c.night ? v.night_mult : 1) *
    (1 - v.relief_k * clamp01(c.relief));
  return Math.max(v.min_range_m, r);
}

/** Une fusée est active entre son émission et la fin de sa durée. */
export const isActive = (s: Signal, nowS: number): boolean => nowS >= s.issuedAtS && nowS <= s.issuedAtS + s.durationS;

export const distance = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Un point voit la fusée s'il est dans le rayon de visibilité et que la fusée est active. */
export function canSee(s: Signal, at: { x: number; y: number }, nowS: number, c: SignalConditions, b: SignalBalance): boolean {
  return isActive(s, nowS) && distance(s, at) <= visibilityRange(s.color, c, b);
}

/** Sens d'un code selon la branche (03 §7) [C], null si la couleur n'existe pas pour cette branche. */
export function meaningOf(branch: Signal["branch"], color: SignalColor, b: SignalBalance): string | null {
  return b.codes[branch][color] ?? null;
}
