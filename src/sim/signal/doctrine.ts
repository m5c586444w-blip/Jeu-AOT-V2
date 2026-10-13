import type { SignalBalance } from "../../data/balance";
import type { Condition, DoctrineContext, DoctrineRule, IssuedOrder, OrderKind } from "./types";

/** Validation d'une table de règles [A] : plafond, ids uniques, ordres connus (liste en données), bornes numériques. */
export function validateDoctrine(rules: readonly DoctrineRule[], b: SignalBalance): string[] {
  const errs: string[] = [];
  if (rules.length > b.doctrine.max_rules) errs.push(`trop de règles (${rules.length} > ${b.doctrine.max_rules})`);
  const ids = new Set<string>();
  for (const r of rules) {
    if (ids.has(r.id)) errs.push(`id dupliqué : ${r.id}`);
    ids.add(r.id);
    if (!b.doctrine.orders.includes(r.then.kind)) errs.push(`${r.id} : ordre inconnu « ${r.then.kind} »`);
    if (r.then.headingDeltaDeg !== undefined && (!Number.isFinite(r.then.headingDeltaDeg) || Math.abs(r.then.headingDeltaDeg) > 180)) errs.push(`${r.id} : déviation hors [-180, 180]`);
    if (r.when.kind === "depot_gaz" && (r.when.maxKm < 0 || r.when.gasBelowPct < 0 || r.when.gasBelowPct > 100)) errs.push(`${r.id} : condition de dépôt hors bornes`);
  }
  return errs;
}

export function conditionHolds(c: Condition, ctx: DoctrineContext, b: SignalBalance): boolean {
  if (c.kind === "signal") {
    return ctx.signals.some((s) => s.color === c.color && (c.sector === undefined || s.sector === c.sector) && (c.branch === undefined || s.meaning === (b.codes[c.branch][c.color] ?? null)));
  }
  return ctx.depotKm !== null && ctx.depotKm <= c.maxKm && ctx.gasPct < c.gasBelowPct;
}

/** Délai de descente d'un ordre dans la chaîne (chef d'escouade → unité), `null` si la chaîne est coupée (retombée sur les règles de formation). */
export function orderDelayS(depth: number, connected: boolean, b: SignalBalance): number | null {
  return connected ? Math.max(0, depth) * b.doctrine.order_hop_delay_s : null;
}

/**
 * Exécute la table de règles sur le contexte de l'expédition. Déterministe : règles triées par priorité décroissante
 * puis par id ; pour une même cible un seul ordre est émis (le plus prioritaire), les autres sont écartés.
 */
export function evaluateDoctrine(rules: readonly DoctrineRule[], ctx: DoctrineContext, b: SignalBalance, depthOf: (target: string) => { depth: number; connected: boolean } = () => ({ depth: 1, connected: true })): IssuedOrder[] {
  const ordered = [...rules].sort((a, z) => z.priority - a.priority || (a.id < z.id ? -1 : a.id > z.id ? 1 : 0));
  const taken = new Set<string>();
  const out: IssuedOrder[] = [];
  for (const r of ordered) {
    if (!conditionHolds(r.when, ctx, b) || taken.has(r.then.target)) continue;
    taken.add(r.then.target);
    const d = depthOf(r.then.target);
    out.push({ ...r.then, ruleId: r.id, delayS: orderDelayS(d.depth, d.connected, b) });
  }
  return out;
}

export const ORDER_KINDS_DEFAULT: readonly OrderKind[] = ["tenir", "avancer", "detourner", "escorter", "evacuer", "incendier", "couvrir", "retraite"];
