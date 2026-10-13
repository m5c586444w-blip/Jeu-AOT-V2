import type { SignalBalance } from "../../data/balance";
import type { Rng } from "../core/rng";
import type { CommsTier, Reception, RelayResult, Signal, SignalColor, SignalConditions, SignalError, SignalUnit } from "./types";
import { distance, visibilityRange } from "./visibility";

const COLORS: readonly SignalColor[] = ["rouge", "vert", "jaune", "noir"];
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Probabilités d'erreur d'une réception [A] : monotones en pluie, fumée, et décroissantes avec le moral. */
export function errorRates(u: SignalUnit, c: SignalConditions, tier: CommsTier, b: SignalBalance): { wrong: number; wet: number; smoke: number; misunderstand: number } {
  const e = b.errors;
  const comms = b.comms[tier]?.error_mult ?? 1;
  const form = e.formation_mult[u.formation ?? "defaut"] ?? e.formation_mult["defaut"] ?? 1;
  const k = comms * form;
  const lowMorale = 1 - clamp(u.morale, 0, 1);
  const smokeOver = Math.max(0, (clamp(c.smoke, 0, 1) - e.smoke_garble_from) / Math.max(1e-9, 1 - e.smoke_garble_from));
  return {
    wrong: clamp(e.wrong_code_base * k, 0, e.max_p),
    wet: clamp((e.wet_flare_base + e.wet_flare_rain_k * clamp(c.rain, 0, 1)) * comms, 0, e.max_p),
    smoke: clamp(e.smoke_garble_k * smokeOver * k, 0, e.max_p),
    misunderstand: clamp((e.misunderstand_base + e.misunderstand_morale_k * lowMorale) * k, 0, e.max_p),
  };
}

interface Node {
  unit: SignalUnit;
  hops: number;
  delayS: number;
  color: SignalColor;
  error: SignalError | null;
  path: string[];
  /** Cette unité répète-t-elle ? (fusée mouillée ou incompréhension coupent la chaîne). */
  repeats: boolean;
}

/**
 * Propagation d'une fusée dans les rangs de sa faction [A].
 * - Vue directe : toute unité de la faction dans le rayon de visibilité (délai `see_delay_s`).
 * - Relais : une unité qui a compris et dont la formation relaie (`relays`) relance la fusée de sa position ; toute
 *   unité de la faction dans le rayon la voit, avec un délai de plus (`hop_delay_s`, borné par `max_hops`).
 * - Un maillon manquant (aucun relais à portée, fusée mouillée) coupe la chaîne : l'unité reste dans `unreached`.
 * - Erreurs : tirées par un fork du RNG par (signal, unité), donc indépendantes de l'ordre d'évaluation et reproductibles.
 * - Les unités d'une autre faction ne reçoivent rien (pas de fuite entre factions).
 * Plus court délai d'abord (Dijkstra), ex æquo départagés par identifiant.
 */
export function propagate(signal: Signal, units: readonly SignalUnit[], cond: SignalConditions, tier: CommsTier, rng: Rng, b: SignalBalance): RelayResult {
  const mates = units.filter((u) => u.faction === signal.faction).sort((a, z) => (a.id < z.id ? -1 : a.id > z.id ? 1 : 0));
  const range = visibilityRange(signal.color, cond, b);
  const dm = b.comms[tier]?.delay_mult ?? 1;
  const done = new Map<string, Node>();
  const frontier: Node[] = [];

  const make = (u: SignalUnit, from: Node | null, base: Signal, delay: number): Node => {
    const color = from ? from.color : base.color;
    const r = errorRates(u, cond, tier, b);
    const f = rng.fork(`sig:${base.id}:${from ? from.unit.id : "src"}>${u.id}`);
    // quatre tirages toujours consommés : le flux ne dépend pas des branches prises
    const dSmoke = f.next();
    const dWrong = f.next();
    const dMis = f.next();
    const dWet = f.next();
    const dPick = f.next();
    let error: SignalError | null = null;
    let shown = color;
    if (dSmoke < r.smoke) error = "fumee";
    else if (dWrong < r.wrong) error = "mauvais_code";
    else if (dMis < r.misunderstand) error = "incomprehension";
    if (error === "mauvais_code" || error === "fumee") {
      const others = COLORS.filter((c) => c !== color);
      shown = others[Math.floor(dPick * others.length)] ?? color;
    }
    const wet = dWet < r.wet;
    if (wet && error === null) error = "fusee_mouillee";
    return { unit: u, hops: from ? from.hops + 1 : 0, delayS: delay, color: shown, error, path: [...(from ? from.path : []), u.id], repeats: u.relays && !wet && error !== "incomprehension" };
  };

  const better = (a: Node, z: Node): number => a.delayS - z.delayS || (a.unit.id < z.unit.id ? -1 : a.unit.id > z.unit.id ? 1 : 0);

  for (const u of mates) if (distance(signal, u) <= range) frontier.push(make(u, null, signal, b.relay.see_delay_s * dm));
  while (frontier.length > 0) {
    frontier.sort(better);
    const n = frontier.shift() as Node;
    if (done.has(n.unit.id)) continue;
    done.set(n.unit.id, n);
    if (!n.repeats || n.hops >= b.relay.max_hops) continue;
    for (const u of mates) {
      if (done.has(u.id) || distance(n.unit, u) > range) continue;
      frontier.push(make(u, n, signal, n.delayS + b.relay.hop_delay_s * dm));
    }
  }

  const receptions: Reception[] = [...done.values()]
    .sort((a, z) => (a.unit.id < z.unit.id ? -1 : 1))
    .map((n) => ({ unitId: n.unit.id, hops: n.hops, delayS: n.delayS, color: n.color, error: n.error, path: n.path }));
  return { signalId: signal.id, faction: signal.faction, range, receptions, unreached: mates.filter((u) => !done.has(u.id)).map((u) => u.id) };
}

/** Délai (s) avant qu'une unité donnée connaisse la fusée ; `Infinity` si la chaîne est coupée. */
export function timeToReach(r: RelayResult, unitId: string): number {
  return r.receptions.find((x) => x.unitId === unitId)?.delayS ?? Infinity;
}

/** Une fusée de Garnison « réussite » (jaune) annule une « échec » (rouge) précédente du même secteur [C] (03 §7). */
export function resolveCancellations(signals: readonly Signal[], b: SignalBalance): Signal[] {
  const out: Signal[] = [];
  for (const s of signals) {
    const cancelled = signals.some(
      (o) => o.branch === "garnison" && o.faction === s.faction && b.codes.cancels[o.color] === s.color && o.sector === s.sector && o.issuedAtS > s.issuedAtS && s.branch === "garnison",
    );
    if (!cancelled) out.push(s);
  }
  return out;
}
