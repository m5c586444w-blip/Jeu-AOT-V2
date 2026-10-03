import type { Modifier, Province } from "../../data/schemas";
import { Explainer } from "../core/explain";
import type { Explained } from "../core/explain";
import type { StrategicState } from "../strategic/economy";
import type { PoliticsWorld, World } from "../strategic/world";
import type { PoliticalState } from "./state";

/** Composition sociale d'une province (F-POP-01) : gabarit de `society.json`, puis part de réfugiés du scénario. */
export function provinceComposition(world: World, pw: PoliticsWorld, p: Province): Record<string, number> {
  const rule = pw.society.rules.find(
    (r) =>
      (!r.atlas_codes || r.atlas_codes.includes(p.atlas_code ?? "")) &&
      (!r.terrains || r.terrains.includes(p.terrain)) &&
      (!r.kinds || r.kinds.includes(p.kind)) &&
      (!r.regions || r.regions.includes(p.region)),
  );
  const profile = (rule && pw.society.profiles[rule.profile]) ?? {};
  const total = Object.values(profile).reduce((a, b) => a + b, 0) || 1;
  const refugees = world.scenario.refugee_share[p.region] ?? 0;
  const out: Record<string, number> = {};
  for (const s of pw.strata) out[s.id] = ((profile[s.id] ?? 0) / total) * (1 - refugees);
  out["str_refugies"] = (out["str_refugies"] ?? 0) + refugees;
  return out;
}

/** Effectif national de chaque strate. */
export function strataPopulation(world: World, pw: PoliticsWorld, st: StrategicState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of pw.strata) out[s.id] = 0;
  for (const p of world.provinces) {
    const ps = st.provinces[p.id];
    if (!ps || ps.control !== "paradis" || ps.population <= 0) continue;
    const comp = provinceComposition(world, pw, p);
    for (const [sid, share] of Object.entries(comp)) out[sid] = (out[sid] ?? 0) + ps.population * share;
  }
  return out;
}

/**
 * Cible de satisfaction d'une strate : base, décrets, famine, rationnement, impôts, légitimité.
 * `active` = modificateurs des décrets en vigueur (effets différés déclenchés compris).
 */
export function satisfactionTarget(pw: PoliticsWorld, pol: PoliticalState, st: StrategicState, active: readonly { key: string; mods: readonly Modifier[] }[], stratum: string): Explained {
  const b = pw.balance.strata;
  const e = new Explainer().base("why.strata_base", b.base);
  for (const law of active) {
    const v = law.mods.filter((m) => m.target === `satisfaction:${stratum}`).reduce((a, m) => a + m.value, 0);
    if (v !== 0) e.add("why.decree", v, { law: law.key });
  }
  if (st.shortages.includes("food")) e.add("why.strata_famine", b.famine);
  const rationing = b.rationing[st.rationing]?.[stratum] ?? 0;
  e.add("why.strata_rationing", rationing, { level: st.rationing });
  const taxMult = active.reduce((a, l) => a + l.mods.filter((m) => m.target === "tax_mult").reduce((x, m) => x + m.value, 0), 0);
  const taxK = b.tax_k[stratum] ?? 0;
  if (taxMult !== 0 && taxK !== 0) e.add("why.strata_taxes", taxMult * taxK);
  const legK = b.legitimacy_k[stratum] ?? 0;
  if (legK !== 0) e.add("why.strata_legitimacy", (pol.legitimacy - 50) * legK, { legitimacy: Math.round(pol.legitimacy) });
  return e.done();
}

/** Cible de radicalisation : insatisfaction au-delà du seuil + décrets. */
export function radicalisationTarget(pw: PoliticsWorld, pol: PoliticalState, active: readonly { key: string; mods: readonly Modifier[] }[], stratum: string): Explained {
  const b = pw.balance.strata;
  const sat = pol.strata[stratum]?.satisfaction ?? b.base;
  const e = new Explainer().base("why.radicalisation_base", 0).add("why.radicalisation_discontent", Math.max(0, b.radicalisation_threshold - sat) * b.radicalisation_k, { satisfaction: Math.round(sat) });
  for (const law of active) {
    const v = law.mods.filter((m) => m.target === `radicalisation:${stratum}`).reduce((a, m) => a + m.value, 0);
    if (v !== 0) e.add("why.decree", v, { law: law.key });
  }
  return e.done();
}

/** Effet des strates sur la cible de moral d'une province : Σ part × (satisfaction − 50) × k. */
export function strataMoraleEffect(world: World, pw: PoliticsWorld, pol: PoliticalState, p: Province): number {
  const comp = provinceComposition(world, pw, p);
  let v = 0;
  for (const [sid, share] of Object.entries(comp)) v += share * ((pol.strata[sid]?.satisfaction ?? 50) - 50);
  return v * pw.balance.morale.strata_k;
}

/** Radicalisation nationale moyenne, pondérée par l'effectif des strates. */
export function averageRadicalisation(world: World, pw: PoliticsWorld, pol: PoliticalState, st: StrategicState): number {
  const pop = strataPopulation(world, pw, st);
  let acc = 0;
  let n = 0;
  for (const [sid, count] of Object.entries(pop)) {
    acc += count * (pol.strata[sid]?.radicalisation ?? 0);
    n += count;
  }
  return n > 0 ? acc / n : 0;
}
