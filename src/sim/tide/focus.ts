import type { TideBalance } from "../../data/balance";
import type { Rng } from "../core/rng";
import type { Human, Titan } from "./types";

/** Intérêt d'un Titan pour un humain : proximité, taille du groupe, bruit, mouvement (spec 26 §3, attention tactique). */
export function interest(t: Pick<Titan, "x" | "y">, h: Human, b: TideBalance): number {
  const f = b.focus;
  const d = Math.hypot(h.x - t.x, h.y - t.y);
  if (d > f.range_m) return 0;
  const base = f.w_distance * (1 - d / f.range_m) + f.w_group * Math.log2(1 + h.group) + f.w_noise * h.noise + f.w_motion * (h.moving ? 1 : 0);
  return h.bait === true ? base * f.bait_mult : base;
}

/**
 * Choisit et entretient le `focus` d'un Titan. Il décroît avec le temps et se réattribue ; il ne change de cible que si une autre
 * dépasse la cible actuelle de `switch_margin`. Un anormal ignore un appât avec la probabilité `anomalous_bait_ignore`.
 * Un Titan immobile ne se donne aucun focus (réveil par le bruit géré par l'activité locale).
 */
export function updateFocus(t: Titan, humans: readonly Human[], immobile: boolean, dtS: number, rng: Rng, b: TideBalance): Titan {
  if (immobile) return { ...t, focus: null };
  const f = b.focus;
  let current = t.focus ? { target: t.focus.target, strength: t.focus.strength - f.decay_per_s * dtS } : null;
  if (current && current.strength < f.drop_below) current = null;
  const sorted = [...humans].sort((a, z) => (a.id < z.id ? -1 : 1));
  let best: { id: string; score: number } | null = null;
  for (const h of sorted) {
    const ignores = t.behavior === "anormal" && h.bait === true && rng.fork(`focus:${t.id}:${h.id}`).next() < f.anomalous_bait_ignore;
    const score = ignores ? 0 : interest(t, h, b);
    if (score > 0 && (!best || score > best.score)) best = { id: h.id, score };
  }
  if (!best) return { ...t, focus: current };
  if (current) {
    const cur = sorted.find((h) => h.id === current.target);
    const curScore = cur ? interest(t, cur, b) : 0;
    if (curScore > 0 && best.score <= curScore * (1 + f.switch_margin)) return { ...t, focus: { target: current.target, strength: Math.max(current.strength, curScore) } };
  }
  return { ...t, focus: { target: best.id, strength: best.score } };
}

/** Saturation d'un point : plus de Titans que d'ancrages (ratio ≥ `saturation_ratio`). */
export function isSaturated(titansAtPoint: number, anchorsAtPoint: number, b: TideBalance): boolean {
  return titansAtPoint >= b.focus.saturation_ratio * Math.max(1, anchorsAtPoint);
}

/** Rayon de saisie, vitesse et cadence d'une classe de taille (03 §5.2). */
export function sizeClassOf(t: Pick<Titan, "sizeClass">, b: TideBalance): { grab_radius_m: number; speed_mps: number; cadence_s: number } {
  const c = b.focus.size_classes[t.sizeClass];
  if (!c) throw new RangeError(`sizeClassOf : classe de taille inconnue « ${t.sizeClass} »`);
  return c;
}

/**
 * Un pas du Titan vers son focus : avance à la vitesse de sa classe sans dépasser le rayon de saisie, saisit quand la cible est
 * à portée de saisie et que la cadence le permet. Un Titan immobile ou sans focus ne bouge pas.
 */
export function stepTitan(t: Titan, humans: readonly Human[], immobile: boolean, dtS: number, b: TideBalance): { titan: Titan; grabbed: string | null } {
  const c = sizeClassOf(t, b);
  const cooldown = Math.max(0, (t.cooldownS ?? 0) - dtS);
  const target = !immobile && t.focus ? humans.find((h) => h.id === t.focus?.target) : undefined;
  if (!target) return { titan: { ...t, cooldownS: cooldown }, grabbed: null };
  const d = Math.hypot(target.x - t.x, target.y - t.y);
  const travel = Math.min(c.speed_mps * dtS, Math.max(0, d - c.grab_radius_m));
  const k = d > 0 ? travel / d : 0;
  const x = t.x + (target.x - t.x) * k;
  const y = t.y + (target.y - t.y) * k;
  const within = Math.hypot(target.x - x, target.y - y) <= c.grab_radius_m + 1e-9;
  if (within && cooldown <= 0) return { titan: { ...t, x, y, cooldownS: c.cadence_s }, grabbed: target.id };
  return { titan: { ...t, x, y, cooldownS: cooldown }, grabbed: null };
}
