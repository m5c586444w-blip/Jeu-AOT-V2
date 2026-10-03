import type { Law, Modifier } from "../../data/schemas";
import { Explainer } from "../core/explain";
import type { Explained } from "../core/explain";
import type { GameDate } from "../core/time";
import { pushLog, totals } from "../strategic/economy";
import type { EconomyMods, ModEntry, StrategicState } from "../strategic/economy";
import type { PoliticsWorld, World } from "../strategic/world";
import { averageRadicalisation, strataMoraleEffect } from "./society";
import { absDay, allTraits, clamp, politicsWorld } from "./state";
import type { PoliticalState, VoteLine, VoteRecord } from "./state";
import { WARM_RELATIONS } from "./vocabulary";

/** Décrets en vigueur avec leurs modificateurs effectifs (effets immédiats + effets différés déjà déclenchés). */
export function activeLawMods(pw: PoliticsWorld, pol: PoliticalState): { id: string; key: string; mods: Modifier[] }[] {
  return pol.laws.flatMap((a) => {
    const law = pw.laws.get(a.id);
    if (!law) return [];
    const mods = [...law.effects, ...a.triggered.flatMap((i) => law.delayed[i]?.effects ?? [])];
    return [{ id: law.id, key: law.name_key, mods }];
  });
}

/** Valeur du deuil à une date (s'estompe linéairement). */
function mourningValue(m: { start: number; value: number; days: number }, today: number): number {
  const left = 1 - (today - m.start) / m.days;
  return left > 0 ? m.value * left : 0;
}

/** Cible de légitimité (F-POL-01) : tradition, résultats, sécurité, religion, décrets, deuils, radicalisation. */
export function legitimacyTarget(world: World, pol: PoliticalState, st: StrategicState, date: GameDate, nationalMorale: number, foodDays: number): Explained {
  const pw = politicsWorld(world);
  const b = pw.balance.legitimacy;
  const e = new Explainer().base("why.legitimacy_base", b.base);
  e.add("why.legitimacy_morale", (nationalMorale - 50) * b.morale_k, { morale: Math.round(nationalMorale) });
  if (st.shortages.includes("food")) e.add("why.legitimacy_famine", b.famine);
  else if (foodDays >= world.economy.morale.reserve_days) e.add("why.legitimacy_reserve", b.reserve_bonus, { days: world.economy.morale.reserve_days });
  const culte = pol.orgs["org_culte"];
  if (culte) e.add("why.legitimacy_culte", (culte.loyalty - 50) * b.culte_k, { loyalty: Math.round(culte.loyalty) });
  for (const law of activeLawMods(pw, pol)) {
    const v = law.mods.filter((m) => m.target === "legitimacy").reduce((a, m) => a + m.value, 0);
    if (v !== 0) e.add("why.decree", v, { law: law.key });
  }
  const today = absDay(date);
  for (const m of pol.mourning) if (m.target === "legitimacy") e.add(m.key, mourningValue(m, today), m.params);
  e.add("why.legitimacy_radicalisation", averageRadicalisation(world, pw, pol, st) * b.radicalisation_k);
  return e.done();
}

/** Cible de loyauté d'une organisation : base, budget, chef, décrets, deuils (F-ECO-15). */
export function orgLoyaltyTarget(world: World, pol: PoliticalState, orgId: string, date: GameDate): Explained {
  const pw = politicsWorld(world);
  const b = pw.balance.orgs;
  const org = pol.orgs[orgId];
  const e = new Explainer().base("why.org_base", b.loyalty_base);
  if (!org) return e.done();
  const ref = world.scenario.politics?.budget[orgId];
  if (ref && ref > 0) e.add("why.org_budget", (org.budget / ref - 1) * b.budget_k, { share: Math.round(org.budget), ref });
  const leader = org.leader ? pol.characters[org.leader] : undefined;
  if (leader?.alive) e.add("why.org_leader", (leader.loyalty - 50) * b.leader_relation_k, { leader: pw.characters.get(org.leader ?? "")?.name ?? "" });
  for (const law of activeLawMods(pw, pol)) {
    const v = law.mods.filter((m) => m.target === `org_loyalty:${orgId}`).reduce((a, m) => a + m.value, 0);
    if (v !== 0) e.add("why.decree", v, { law: law.key });
  }
  const today = absDay(date);
  for (const m of pol.mourning) if (m.target === `org_loyalty:${orgId}`) e.add(m.key, mourningValue(m, today), m.params);
  return e.done();
}

export function orgInfluenceTarget(world: World, pol: PoliticalState, orgId: string): Explained {
  const pw = politicsWorld(world);
  const e = new Explainer().base("why.org_influence_base", world.scenario.politics?.org_influence[orgId] ?? 50);
  for (const law of activeLawMods(pw, pol)) {
    const v = law.mods.filter((m) => m.target === `org_influence:${orgId}`).reduce((a, m) => a + m.value, 0);
    if (v !== 0) e.add("why.decree", v, { law: law.key });
  }
  return e.done();
}

/** Modificateurs transmis à l'économie (production, consommation, moral, stabilité, impôts…). */
export function economyMods(world: World, pol: PoliticalState, st: StrategicState): EconomyMods {
  const pw = politicsWorld(world);
  const byTarget: Record<string, ModEntry[]> = {};
  const push = (target: string, entry: ModEntry): void => {
    (byTarget[target] ??= []).push(entry);
  };
  for (const law of activeLawMods(pw, pol)) {
    const sums = new Map<string, number>();
    for (const m of law.mods) {
      if (/^(production_mult|consumption_mult|losses_mult):|^(morale|stability|tax_mult|manpower_mult)$/.test(m.target)) sums.set(m.target, (sums.get(m.target) ?? 0) + m.value);
    }
    for (const [target, value] of sums) push(target, { key: "why.decree", value, params: { law: law.key } });
  }
  const sb = pw.balance.stability;
  push("stability", { key: "why.stability_legitimacy", value: (pol.legitimacy - 50) * sb.legitimacy_k, params: { legitimacy: Math.round(pol.legitimacy) } });
  push("stability", { key: "why.stability_radicalisation", value: averageRadicalisation(world, pw, pol, st) * sb.radicalisation_k });
  const provinceMorale: Record<string, ModEntry[]> = {};
  for (const p of world.provinces) {
    const ps = st.provinces[p.id];
    if (!ps || ps.control !== "paradis" || ps.population <= 0) continue;
    provinceMorale[p.id] = [{ key: "why.morale_strata", value: strataMoraleEffect(world, pw, pol, p) }];
  }
  return { byTarget, provinceMorale };
}

// ——— Cabinet et votes (F-POL-03) ————————————————————————————————————

/** Membres votants du Cabinet : titulaires vivants des rôles à siège + sièges supplémentaires (hors joueur). */
export function cabinetMembers(world: World, pol: PoliticalState): { character: string; role: string | null }[] {
  const pw = politicsWorld(world);
  const out: { character: string; role: string | null }[] = [];
  for (const r of pw.roles) {
    const who = pol.roles[r.id];
    if (r.cabinet && who && who !== pol.player && pol.characters[who]?.alive) out.push({ character: who, role: r.id });
  }
  for (const who of pol.cabinetExtra) if (who !== pol.player && pol.characters[who]?.alive && !out.some((m) => m.character === who)) out.push({ character: who, role: null });
  return out;
}

/** Score de vote d'un membre (sans l'effet de clique) : programme, traits, loyauté, intérêt d'organisation, persuasion. */
function baseVoteScore(pw: PoliticsWorld, pol: PoliticalState, who: string, law: Law): Explainer {
  const c = pw.characters.get(who);
  const cs = pol.characters[who];
  const b = pw.balance.votes;
  const e = new Explainer().base("why.vote_base", 0);
  if (!c || !cs) return e;
  const agenda = pw.balance.agenda_affinity[c.agenda] ?? {};
  const fromAgenda = law.tags.reduce((a, t) => a + (agenda[t] ?? 0), 0);
  e.add("why.vote_agenda", Math.max(-1, Math.min(1, fromAgenda)), { agenda: `agenda.${c.agenda}` });
  let fromTraits = 0;
  for (const t of allTraits(c, cs)) {
    const tr = pw.traits.get(t);
    if (tr) fromTraits += law.tags.reduce((a, tag) => a + (tr.vote[tag] ?? 0), 0);
  }
  e.add("why.vote_traits", Math.max(-1, Math.min(1, fromTraits)));
  e.add("why.vote_loyalty", ((cs.loyalty - 50) / 50) * b.loyalty_k, { loyalty: Math.round(cs.loyalty) });
  if (c.org) {
    const stake = law.effects.filter((m) => m.target === `org_loyalty:${c.org}` || m.target === `org_influence:${c.org}`).reduce((a, m) => a + m.value, 0);
    if (stake !== 0) e.add("why.vote_org_interest", Math.max(-0.6, Math.min(0.6, stake / 20)), { org: pw.organisations.get(c.org)?.name_key ?? c.org });
  }
  const persuaded = pol.persuasion[who] ?? 0;
  if (persuaded !== 0) e.add("why.vote_persuasion", persuaded);
  return e;
}

/** Calcule le vote du Cabinet sur un décret (déterministe, motivé membre par membre). */
export function computeVote(world: World, pol: PoliticalState, law: Law): { record: Omit<VoteRecord, "date">; reasons: Record<string, Explained> } {
  const pw = politicsWorld(world);
  const b = pw.balance.votes;
  const members = cabinetMembers(world, pol);
  const base = new Map(members.map((m) => [m.character, baseVoteScore(pw, pol, m.character, law)]));
  const reasons: Record<string, Explained> = {};
  const lines: VoteLine[] = [];
  for (const m of members) {
    const e = base.get(m.character) as Explainer;
    const c = pw.characters.get(m.character);
    // Clique : les membres liés par une relation forte s'alignent en partie sur leurs alliés.
    const allies = (c?.relations ?? []).filter((r) => WARM_RELATIONS.includes(r.type) && r.strength >= b.clique_min_strength && base.has(r.to) && r.to !== m.character);
    if (allies.length > 0) {
      const mean = allies.reduce((a, r) => a + (base.get(r.to)?.value ?? 0), 0) / allies.length;
      e.add("why.vote_clique", mean * b.clique_k, { n: allies.length });
    }
    const x = e.done();
    reasons[m.character] = x;
    lines.push({ character: m.character, score: x.value, vote: x.value > b.threshold ? "pour" : x.value < -b.threshold ? "contre" : "abstention" });
  }
  const pour = lines.filter((l) => l.vote === "pour").length;
  const contre = lines.filter((l) => l.vote === "contre").length;
  // Veto (F-ADV-03) : le titulaire du domaine, influent et hostile, bloque le décret.
  let veto: VoteRecord["veto"] = null;
  for (const r of pw.roles) {
    if (r.veto_category !== law.category) continue;
    const who = pol.roles[r.id];
    if (!who || who === pol.player || !pol.characters[who]?.alive) continue;
    const org = pw.characters.get(who)?.org;
    const influence = org ? (pol.orgs[org]?.influence ?? 0) : 0;
    const score = base.get(who)?.value ?? baseVoteScore(pw, pol, who, law).value;
    if (influence >= b.veto_influence && score <= b.veto_affinity) veto = { character: who, role: r.id };
  }
  return { record: { law: law.id, lines, pour, contre, abstention: lines.length - pour - contre, passed: pour > contre && !veto, veto }, reasons };
}

// ——— Commandes politiques ——————————————————————————————————————————

export interface EnactResult {
  state: PoliticalState;
  strategic: StrategicState;
  enacted: boolean;
}

/** Décréter (ou soumettre au Cabinet) un décret. Lève une erreur lisible si c'est impossible. */
export function enactLaw(world: World, pol: PoliticalState, st: StrategicState, date: GameDate, lawId: string, override: boolean): EnactResult {
  const pw = politicsWorld(world);
  const law = pw.laws.get(lawId);
  if (!law) throw new Error(`Décret inconnu : ${lawId}`);
  if (pol.laws.some((a) => a.id === lawId)) throw new Error("Ce décret est déjà en vigueur.");
  const conflict = law.exclusive_group ? pol.laws.find((a) => pw.laws.get(a.id)?.exclusive_group === law.exclusive_group) : undefined;
  if (conflict) throw new Error(`Incompatible avec un décret en vigueur : ${conflict.id}`);
  const capitalCost = law.cost.capital + (override ? pw.balance.votes.veto_override_cost : 0);
  if (pol.capital < capitalCost) throw new Error("Capital politique insuffisant.");
  if (st.stocks.gold < law.cost.gold) throw new Error("Trésor insuffisant.");
  const next = structuredClone(pol);
  const strat = structuredClone(st);
  next.capital -= capitalCost;
  strat.stocks.gold -= law.cost.gold;
  if (law.requires_vote) {
    const { record } = computeVote(world, pol, law);
    const vetoed = record.veto !== null && !override;
    const passed = record.pour > record.contre && !vetoed;
    next.lastVote = { ...record, date: { ...date }, passed, veto: vetoed ? record.veto : null };
    next.persuasion = {};
    if (!passed) {
      pushLog(strat, date, vetoed ? "alert.law_vetoed" : "alert.law_rejected", { law: law.name_key }, false);
      return { state: next, strategic: strat, enacted: false };
    }
  }
  next.laws.push({ id: law.id, since: absDay(date), triggered: [] });
  pushLog(strat, date, "alert.law_enacted", { law: law.name_key }, false);
  return { state: next, strategic: strat, enacted: true };
}

export function repealLaw(world: World, pol: PoliticalState, st: StrategicState, date: GameDate, lawId: string): { state: PoliticalState; strategic: StrategicState } {
  const pw = politicsWorld(world);
  const law = pw.laws.get(lawId);
  if (!law || !pol.laws.some((a) => a.id === lawId)) throw new Error("Ce décret n'est pas en vigueur.");
  const cost = Math.ceil(law.cost.capital / 2);
  if (pol.capital < cost) throw new Error("Capital politique insuffisant.");
  const next = structuredClone(pol);
  next.capital -= cost;
  next.laws = next.laws.filter((a) => a.id !== lawId);
  const strat = structuredClone(st);
  pushLog(strat, date, "alert.law_repealed", { law: law.name_key }, false);
  return { state: next, strategic: strat };
}

/** Persuasion (dépense de capital politique) : rapproche un membre du « pour » au prochain vote. */
export function persuade(world: World, pol: PoliticalState, who: string): PoliticalState {
  const b = politicsWorld(world).balance.votes;
  if (!cabinetMembers(world, pol).some((m) => m.character === who)) throw new Error("Ce personnage ne siège pas au Cabinet.");
  if (pol.capital < b.persuasion_cost) throw new Error("Capital politique insuffisant.");
  const next = structuredClone(pol);
  next.capital -= b.persuasion_cost;
  next.persuasion[who] = (next.persuasion[who] ?? 0) + b.persuasion_value;
  return next;
}

/** Répartition du budget militaire entre organisations (normalisée à 100 %). */
export function setBudget(world: World, pol: PoliticalState, shares: Record<string, number>): PoliticalState {
  const pw = politicsWorld(world);
  const ids = Object.keys(shares).filter((id) => pw.organisations.get(id)?.budgeted);
  const total = ids.reduce((a, id) => a + Math.max(0, shares[id] ?? 0), 0);
  if (total <= 0) throw new Error("Répartition du budget vide.");
  const next = structuredClone(pol);
  for (const id of ids) {
    const org = next.orgs[id];
    if (org) org.budget = (Math.max(0, shares[id] ?? 0) / total) * 100;
  }
  return next;
}

/** Moral national pondéré par la population (même définition que le bandeau). */
export function nationalMoraleOf(st: StrategicState): number {
  let pop = 0;
  let acc = 0;
  for (const p of Object.values(st.provinces)) {
    if (p.control !== "paradis" || p.population <= 0) continue;
    pop += p.population;
    acc += p.population * p.morale;
  }
  return pop > 0 ? acc / pop : 0;
}

/** Jours de nourriture en réserve (consommation du jour calculée sans les décrets). */
export function foodDays(st: StrategicState, world: World): number {
  const { population, soldiers } = totals(st);
  const perDay = population * world.economy.consumption.food_per_pop + soldiers * world.economy.consumption.food_per_soldier;
  return perDay > 0 ? st.stocks.food / perDay : Infinity;
}

export { clamp };
