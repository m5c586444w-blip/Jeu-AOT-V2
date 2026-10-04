import type { Role } from "../../data/schemas";
import { fnv1a } from "../core/hash";
import { Rng } from "../core/rng";
import type { GameDate } from "../core/time";
import { pushLog } from "../strategic/economy";
import type { StrategicState } from "../strategic/economy";
import type { PoliticsWorld, World } from "../strategic/world";
import { resign, stressCharacter } from "./characters";
import { enactLaw, foodDays, nationalMoraleOf } from "./politics";
import type { EnactResult } from "./politics";
import { absDay, allTraits, clamp, effectiveAttributes, politicsWorld } from "./state";
import type { PoliticalState } from "./state";
import { averageRadicalisation } from "./society";

/** Grandeurs « mauvaises quand elles montent » (les autres sont mauvaises quand elles baissent). */
const HIGH_IS_BAD = new Set(["radicalisation"]);

export type Bias = "gonfle" | "exagere" | "ignore" | null;

/** Avis d'un conseiller (08 §3.2) : ce qu'il dit, ce qui est vrai, et pourquoi il le dit. */
export interface Advice {
  role: string;
  advisor: string | null;
  metric: Role["metric"];
  /** Valeur réelle (connue de la simulation seulement). */
  real: number | null;
  /** Valeur annoncée au joueur. */
  shown: number | null;
  /** Fiabilité réelle (0–100) et fiabilité telle que le joueur peut l'estimer. */
  reliability: number;
  estimatedReliability: number;
  bias: Bias;
  /** Le conseiller juge-t-il la situation alarmante (d'après SA lecture) ? */
  alarm: boolean;
  recommendation: string | null;
  /** Intérêt personnel : affinité de son programme avec le décret recommandé (−1 à 1). */
  interest: number;
}

/** Valeur réelle de la grandeur surveillée par un rôle. */
export function metricValue(world: World, pol: PoliticalState, st: StrategicState, metric: Role["metric"]): number | null {
  const pw = politicsWorld(world);
  const c = world.economy.consumption;
  switch (metric) {
    case "food_days":
      return foodDays(st, world);
    case "gas_days": {
      let soldiers = 0;
      for (const p of Object.values(st.provinces)) if (p.control === "paradis") soldiers += p.garrison?.soldiers ?? 0;
      const per = soldiers * c.gas_per_soldier;
      return per > 0 ? st.stocks.gas / per : null;
    }
    case "steel_days":
      return st.stocks.steel;
    case "gold":
      return st.stocks.gold;
    case "legitimacy":
      return pol.legitimacy;
    case "morale":
      return nationalMoraleOf(st);
    case "stability": {
      let pop = 0;
      let acc = 0;
      for (const p of Object.values(st.provinces)) {
        if (p.control !== "paradis" || p.population <= 0) continue;
        pop += p.population;
        acc += p.population * p.stability;
      }
      return pop > 0 ? acc / pop : null;
    }
    case "radicalisation":
      return averageRadicalisation(world, pw, pol, st);
    case "faith":
      return pol.strata["str_clerge"]?.satisfaction ?? null;
    case "manpower":
      return st.stocks.manpower;
    case "wall_structure": {
      const values = Object.values(st.provinces).filter((p) => p.control === "paradis" && p.wall_structure !== null).map((p) => p.wall_structure ?? 100);
      return values.length > 0 ? Math.min(...values) : null;
    }
    case "horses":
      return st.stocks.horses;
    case "capital":
      return pol.capital;
    case "none":
      return null;
  }
}

/** Biais d'un conseiller : premier trait biaisé, sinon programme opportuniste (gonfle). */
export function biasOf(pw: PoliticsWorld, pol: PoliticalState, id: string): Bias {
  const c = pw.characters.get(id);
  if (!c) return null;
  for (const t of allTraits(c, pol.characters[id])) {
    const b = pw.traits.get(t)?.advice_bias;
    if (b) return b;
  }
  return c.agenda === "opportuniste" ? "gonfle" : null;
}

/**
 * Ce qu'un conseiller annonce d'une grandeur réelle (08 §3) : erreur selon sa fiabilité, déformation selon son biais.
 * `highIsBad` : une valeur haute est mauvaise (pertes, radicalisation) ; un biais optimiste la minimise alors.
 */
export function advisorLens(world: World, pol: PoliticalState, who: string, date: GameDate, real: number | null, highIsBad: boolean): { shown: number | null; reliability: number; estimatedReliability: number; bias: "gonfle" | "exagere" | "ignore" | null } {
  const pw = politicsWorld(world);
  const c = pw.characters.get(who);
  const cs = pol.characters[who];
  if (!c || !cs) return { shown: real, reliability: 0, estimatedReliability: 0, bias: null };
  const a = effectiveAttributes(pw, c, cs);
  const competence = (a.intellect + Math.max(a.tactics, a.command, a.charisma, a.faith)) / 2;
  const reliability = clamp(0.6 * competence + 0.4 * c.honesty);
  const estimatedReliability = Math.round(clamp(0.6 * competence + 0.4 * 50) / 10) * 10;
  const bias = biasOf(pw, pol, who);
  let shown = real;
  if (real !== null && Number.isFinite(real)) {
    const wobble = new Rng(fnv1a(`${who}:${date.year}:${Math.ceil(date.day / 30)}`)).next() * 2 - 1;
    const error = (1 - reliability / 100) * 0.25 * wobble;
    const k = (100 - c.honesty) * pw.balance.advisors.bias_k + 0.1;
    const optimistic = highIsBad ? -1 : 1;
    const biasFactor = bias === "gonfle" || bias === "ignore" ? optimistic * k : bias === "exagere" ? -optimistic * k : 0;
    shown = real * (1 + error + biasFactor);
  }
  return { shown, reliability, estimatedReliability, bias };
}

/** Avis d'un rôle à une date (déterministe : le « bruit » d'un avis dépend du conseiller et du mois). */
export function adviceFor(world: World, pol: PoliticalState, st: StrategicState, date: GameDate, roleId: string): Advice | null {
  const pw = politicsWorld(world);
  const role = pw.roles.find((r) => r.id === roleId);
  if (!role) return null;
  const who = pol.roles[roleId] ?? null;
  const cs = who ? pol.characters[who] : undefined;
  const c = who ? pw.characters.get(who) : undefined;
  const real = metricValue(world, pol, st, role.metric);
  if (!who || !c || !cs?.alive) return { role: roleId, advisor: null, metric: role.metric, real, shown: null, reliability: 0, estimatedReliability: 0, bias: null, alarm: false, recommendation: null, interest: 0 };
  const { shown, reliability, estimatedReliability, bias } = advisorLens(world, pol, who, date, real, HIGH_IS_BAD.has(role.metric));
  const lowIsBad = !HIGH_IS_BAD.has(role.metric);
  const alarm = bias !== "ignore" && shown !== null && Number.isFinite(shown) && (lowIsBad ? shown < role.alarm : shown > role.alarm);
  const law = role.proposal ? pw.laws.get(role.proposal) : undefined;
  const agenda = pw.balance.agenda_affinity[c.agenda] ?? {};
  const interest = law ? Math.max(-1, Math.min(1, law.tags.reduce((x, t) => x + (agenda[t] ?? 0), 0))) : 0;
  return { role: roleId, advisor: who, metric: role.metric, real, shown, reliability, estimatedReliability, bias, alarm, recommendation: alarm && law ? law.id : null, interest };
}

/** Propositions mensuelles « à signer » (F-ADV-02) : un conseiller alarmé propose son décret. */
export function generateProposals(world: World, pol: PoliticalState, st: StrategicState, date: GameDate): void {
  const pw = politicsWorld(world);
  const today = absDay(date);
  for (const role of pw.roles) {
    const advice = adviceFor(world, pol, st, date, role.id);
    const law = advice?.recommendation;
    if (!advice || !law || !advice.advisor) continue;
    if (pol.laws.some((a) => a.id === law) || pol.proposals.some((p) => p.law === law)) continue;
    const group = pw.laws.get(law)?.exclusive_group;
    if (group && pol.laws.some((a) => pw.laws.get(a.id)?.exclusive_group === group)) continue;
    pol.proposalSeq += 1;
    pol.proposals.push({ id: pol.proposalSeq, advisor: advice.advisor, role: role.id, law, created: today, expires: today + pw.balance.advisors.proposal_days });
    pushLog(st, date, "alert.proposal", { name: pw.characters.get(advice.advisor)?.name ?? "", law: pw.laws.get(law)?.name_key ?? law }, false);
  }
}

/** Propositions expirées : légère perte de loyauté du conseiller (08 §3.3). */
export function expireProposals(world: World, pol: PoliticalState, date: GameDate): void {
  const pw = politicsWorld(world);
  const today = absDay(date);
  for (const p of pol.proposals.filter((x) => x.expires <= today)) {
    const cs = pol.characters[p.advisor];
    if (cs) cs.loyalty = clamp(cs.loyalty - pw.balance.advisors.expire_loss);
  }
  pol.proposals = pol.proposals.filter((x) => x.expires > today);
}

/** Signer une proposition : le décret est pris (ou soumis au vote) ; le conseiller y gagne s'il y trouve son intérêt. */
export function acceptProposal(world: World, pol: PoliticalState, st: StrategicState, date: GameDate, id: number): EnactResult {
  const pw = politicsWorld(world);
  const prop = pol.proposals.find((p) => p.id === id);
  if (!prop) throw new Error("Proposition inconnue ou expirée.");
  const result = enactLaw(world, pol, st, date, prop.law, false);
  const next = result.state;
  next.proposals = next.proposals.filter((p) => p.id !== id);
  const cs = next.characters[prop.advisor];
  const advice = adviceFor(world, pol, st, date, prop.role);
  if (cs) {
    cs.loyalty = clamp(cs.loyalty + (result.enacted ? ((advice?.interest ?? 0) > 0 ? pw.balance.advisors.accept_gain : 1) : 0));
    if (!result.enacted) stressCharacter(world, next, prop.advisor, pw.balance.stress.vote_defeat);
  }
  return result;
}

/** Refuser une proposition : perte de loyauté, stress ; refus répétés → démission (F-ADV-03). */
export function rejectProposal(world: World, pol: PoliticalState, st: StrategicState, date: GameDate, id: number): { state: PoliticalState; strategic: StrategicState } {
  const pw = politicsWorld(world);
  const prop = pol.proposals.find((p) => p.id === id);
  if (!prop) throw new Error("Proposition inconnue ou expirée.");
  const next = structuredClone(pol);
  const strat = structuredClone(st);
  next.proposals = next.proposals.filter((p) => p.id !== id);
  const cs = next.characters[prop.advisor];
  if (cs) {
    cs.loyalty = clamp(cs.loyalty - pw.balance.advisors.reject_loss);
    cs.rejections += 1;
    stressCharacter(world, next, prop.advisor, pw.balance.stress.proposal_rejected);
    if (cs.rejections >= pw.balance.advisors.rejections_to_resign) {
      resign(world, next, strat, date, prop.advisor, "resign.ignored");
      cs.rejections = 0;
    }
  }
  return { state: next, strategic: strat };
}
