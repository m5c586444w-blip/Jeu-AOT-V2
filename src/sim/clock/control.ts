import type { ClockBalance, ShiftersBalance } from "../../data/balance";
import type { Rng } from "../core/rng";
import type { Bearer, GeneralAction, TransformGate, TransformInput } from "./types";

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Alignement d'un porteur avec un ordre général, dans [-1, 1] ; 0 sans ordre ou sans conviction. */
export function alignment(bearer: Bearer, order: string | null): number {
  if (order === null) return 0;
  return clamp(bearer.convictions[order] ?? 0, -1, 1);
}

/**
 * Contrôle 0..100 (spec 26 §6) : base + volonté + liens − stress ; un ordre contraire à ses convictions retranche
 * `contrary_penalty × |alignement|`, un ordre conforme ajoute `aligned_bonus × alignement` ; l'épuisement (usure) retranche `exhausted_penalty`.
 */
export function controlOf(bearer: Bearer, order: string | null, b: ClockBalance, exhausted = false): number {
  const c = b.control;
  const al = alignment(bearer, order);
  const orderTerm = al < 0 ? c.contrary_penalty * al : c.aligned_bonus * al;
  const v = c.base + c.will_w * bearer.will + c.bonds_w * bearer.bonds - c.stress_w * bearer.stress + orderTerm - (exhausted ? c.exhausted_penalty : 0);
  return clamp(v, 0, 100);
}

/** Autonomie 0..100, dérivée du contrôle. */
export const autonomyOf = (control: number, b: ClockBalance): number => clamp(b.autonomy.base + b.autonomy.per_control * control, 0, 100);

/** Probabilité d'ignorer un ordre : nulle au-dessus de `below_control`, croissante jusqu'à `max_p` à contrôle nul. */
export function ignoreProbability(control: number, b: ClockBalance): number {
  const t = b.ignore.below_control;
  if (control >= t) return 0;
  return b.ignore.max_p * (1 - control / t);
}

/** Délai de réaction (s) : lent à autonomie nulle (`slow_s`), vif à autonomie pleine (`fast_s`). */
export const reactionDelayS = (autonomy: number, b: ClockBalance): number => b.reaction.slow_s - (b.reaction.slow_s - b.reaction.fast_s) * (clamp(autonomy, 0, 100) / 100);

export function isGeneralOrder(order: string, b: ClockBalance): boolean {
  return b.orders.includes(order);
}

/** Capacité préférée du modèle d'un Titan (poids le plus fort, ex æquo : ordre alphabétique) — comportement prévisible. */
export function modelTopAbility(titan: string, b: ClockBalance): string {
  const m = b.models[titan];
  if (!m) throw new RangeError(`clock : pas de modèle pour ${titan}`);
  return [...m].sort((x, y) => y.weight - x.weight || x.ability.localeCompare(y.ability))[0]?.ability as string;
}

/** Tirage pondéré d'une capacité du modèle d'un Titan (aléa injecté). */
export function modelPick(titan: string, rng: Rng, b: ClockBalance): string {
  const m = b.models[titan];
  if (!m) throw new RangeError(`clock : pas de modèle pour ${titan}`);
  const total = m.reduce((a, x) => a + x.weight, 0);
  let r = rng.next() * total;
  for (const x of m) {
    r -= x.weight;
    if (r < 0) return x.ability;
  }
  return (m[m.length - 1] as { ability: string }).ability;
}

/**
 * Décision d'un porteur commandé par l'IA (modèle propre à chaque Titan, 03 §8.2).
 * - Ordre donné : le contrôle (qui tient compte de l'alignement) peut le faire ignorer ; sinon, sous `predictable_below` d'autonomie
 *   le porteur exécute l'ordre toujours ; au-dessus, il fait de sa propre initiative (modèle du Titan) avec une probabilité autonomie/100.
 * - Sans ordre : il agit selon son modèle ; prévisible (capacité préférée) sous `predictable_below`, tirage pondéré au-dessus.
 */
export function decideAction(bearer: Bearer, titan: string, order: string | null, rng: Rng, b: ClockBalance, exhausted = false): GeneralAction {
  if (order !== null && !isGeneralOrder(order, b)) throw new RangeError(`clock : ordre général inconnu « ${order} »`);
  const control = controlOf(bearer, order, b, exhausted);
  const autonomy = autonomyOf(control, b);
  const predictable = autonomy < b.autonomy.predictable_below;
  if (order !== null) {
    if (rng.next() < ignoreProbability(control, b)) return { kind: "ignore", order };
    if (predictable || rng.next() >= autonomy / 100) return { kind: "order", order };
    return { kind: "own", ability: modelPick(titan, rng, b) };
  }
  return { kind: "own", ability: predictable ? modelTopAbility(titan, b) : modelPick(titan, rng, b) };
}

/**
 * Porte de transformation (03 §8.1 ; blessure volontaire [C], mains entravées [A]) : refus si mains entravées, endurance
 * insuffisante (`transform_cost`) ou cooldown en cours ; délai dans [transform_delay_s] — d'autant plus long que le contrôle est bas —
 * plus `surprised_extra_delay_s` si le porteur est surpris.
 */
export function transformGate(input: TransformInput, sb: ShiftersBalance, b: ClockBalance): TransformGate {
  const [lo, hi] = sb.transform_delay_s;
  const delayS = lo + (hi - lo) * (1 - clamp(input.control, 0, 100) / 100) + (input.surprised ? b.transform.surprised_extra_delay_s : 0);
  let reason: string | null = null;
  if (input.handsBound) reason = "clock.err.hands_bound";
  else if (input.endurance < sb.transform_cost) reason = "clock.err.endurance";
  else if (input.cooldownS > 0) reason = "clock.err.cooldown";
  return { ok: reason === null, reason, delayS };
}
