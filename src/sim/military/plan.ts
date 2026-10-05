import { Explainer } from "../core/explain";
import type { Explained } from "../core/explain";
import { seasonOf } from "../core/time";
import type { GameDate } from "../core/time";
import { advisorLens } from "../politics/advisors";
import type { PoliticalState } from "../politics/state";
import type { StrategicState } from "../strategic/economy";
import type { World } from "../strategic/world";
import { clamp } from "./random";
import { routeKm, routeProblem, shortestRoute, suggestRelays, titanDensity } from "./routes";
import type { ExpeditionPlan, MilitaryState } from "./state";
import { militaryWorld, readyMembers } from "./state";
import { OBJECTIVES } from "./vocabulary";

/** Planification d'une expédition (F-EXP-01, F-EXP-07, F-EXP-15, F-LOG-15). Fonctions pures. */

export interface Problem {
  key: string;
  params: Record<string, string | number>;
}

/** Effectif engagé par le plan : membres disponibles des escouades choisies, plus les officiers nommés. */
export function planSoldiers(mil: MilitaryState, plan: ExpeditionPlan): string[] {
  return plan.squads.flatMap((sq) => readyMembers(mil, sq).map((s) => s.id));
}

export function planHeadcount(mil: MilitaryState, plan: ExpeditionPlan): number {
  return planSoldiers(mil, plan).length + plan.officers.length;
}

/** Gaz prélevé sur le stock national : réservoirs pleins (D-53) + recharges emportées. */
export function gasFromStock(world: World, n: number, plan: ExpeditionPlan): number {
  const e = militaryWorld(world).exp;
  return (n * e.odm_tank) / e.odm_units_per_stock_unit + plan.supplies.gas;
}

/** Coût politique au départ (F-EXP-07) : capital de base + par centaine d'hommes. */
export function planCapitalCost(world: World, mil: MilitaryState, plan: ExpeditionPlan): Explained {
  const p = militaryWorld(world).exp.politics;
  const n = planHeadcount(mil, plan);
  return new Explainer().base("why.exp_capital_base", p.capital_base).add("why.exp_capital_size", Math.round(((p.capital_per_100 * n) / 100) * 10) / 10, { n }).done();
}

/** Plan exécutable ? Première raison de refus, ou null (AC3-05). */
export function planProblem(world: World, st: StrategicState, pol: PoliticalState | null, mil: MilitaryState, date: GameDate, plan: ExpeditionPlan): Problem | null {
  const m = world.military;
  if (!m) return { key: "plan.no_military", params: {} };
  const base = world.scenario.expedition_base;
  if (!base) return { key: "plan.no_base", params: {} };
  if (!(OBJECTIVES as readonly string[]).includes(plan.objective)) return { key: "plan.bad_objective", params: {} };
  if (plan.route[0] !== base) return { key: "plan.route_start", params: { base } };
  const rp = routeProblem(m.geo, plan.route);
  if (rp) return rp;
  const target = plan.route[plan.route.length - 1] as string;
  if (st.provinces[target]?.control === "paradis") return { key: "plan.target_held", params: { province: target } };
  if (plan.objective === "depot" && mil.depots.some((d) => d.province === target)) return { key: "plan.depot_exists", params: { province: target } };
  if (plan.squads.length === 0) return { key: "plan.no_squad", params: {} };
  const busy = new Set(mil.expeditions.flatMap((e) => e.plan.squads));
  for (const sq of plan.squads) {
    if (!mil.squads.some((x) => x.id === sq)) return { key: "plan.unknown_squad", params: { squad: sq } };
    if (busy.has(sq)) return { key: "plan.squad_busy", params: { squad: sq } };
  }
  const soldiers = planSoldiers(mil, plan);
  if (soldiers.length < m.exp.engagement.min_engaged) return { key: "plan.too_few", params: { n: soldiers.length, min: m.exp.engagement.min_engaged } };
  const busyOfficers = new Set(mil.expeditions.flatMap((e) => e.officers));
  for (const o of plan.officers) {
    const c = world.politics?.characters.get(o);
    const cs = pol?.characters[o];
    if (!c || !cs?.alive) return { key: "plan.officer_unavailable", params: { officer: o } };
    if (c.org !== "org_survey_corps") return { key: "plan.officer_not_corps", params: { officer: o } };
    if (c.active_from > date.year) return { key: "plan.officer_unavailable", params: { officer: o } };
    if (busyOfficers.has(o) || pol?.player === o) return { key: "plan.officer_busy", params: { officer: o } };
  }
  const n = soldiers.length + plan.officers.length;
  const lg = m.log;
  if (plan.horses < 0 || plan.wagons < 0 || !Number.isInteger(plan.horses) || !Number.isInteger(plan.wagons)) return { key: "plan.bad_numbers", params: {} };
  const horsesNeeded = plan.horses + plan.wagons * lg.convoy.horses_per_wagon;
  if (horsesNeeded > st.stocks.horses) return { key: "plan.no_horses", params: { need: horsesNeeded, have: Math.floor(st.stocks.horses) } };
  const sup = plan.supplies;
  const cargo = plan.depotCargo;
  for (const v of [sup.food, sup.gas, sup.steel, cargo.food, cargo.gas, cargo.steel]) if (!(v >= 0) || !Number.isFinite(v)) return { key: "plan.bad_numbers", params: {} };
  const gasStock = gasFromStock(world, n, plan) + cargo.gas;
  if (sup.food + cargo.food > st.stocks.food) return { key: "plan.no_stock", params: { resource: "food" } };
  if (gasStock > st.stocks.gas) return { key: "plan.no_stock", params: { resource: "gas" } };
  if (sup.steel + cargo.steel > st.stocks.steel) return { key: "plan.no_stock", params: { resource: "steel" } };
  const load = sup.food + sup.gas + sup.steel + cargo.food + cargo.gas + cargo.steel;
  if (load > plan.wagons * lg.convoy.wagon_capacity) return { key: "plan.no_wagons", params: { load: Math.ceil(load), capacity: plan.wagons * lg.convoy.wagon_capacity } };
  if (plan.objective !== "depot" && cargo.food + cargo.gas + cargo.steel > 0) return { key: "plan.cargo_without_depot", params: {} };
  const r = plan.retreat;
  if (!(r.losses_pct > 0 && r.losses_pct <= 100 && r.gas_pct >= 0 && r.gas_pct < 100 && r.abnormal >= 1 && r.max_days >= 1)) return { key: "plan.bad_retreat", params: {} };
  if (pol) {
    const cost = planCapitalCost(world, mil, plan).value;
    if (pol.capital < cost) return { key: "plan.no_capital", params: { need: Math.ceil(cost), have: Math.floor(pol.capital) } };
  }
  if (plan.objective === "depot" && st.stocks.gold < lg.depot.gold_cost) return { key: "plan.no_gold", params: { need: lg.depot.gold_cost } };
  return null;
}

export interface PlanEstimate {
  km: number;
  days: Explained;
  contacts: Explained;
  engagements: Explained;
  deaths: Explained;
  /** Fourchette des pertes (queues épaisses, 03 §12). */
  deathsLow: number;
  deathsHigh: number;
  gasOdm: Explained;
  food: Explained;
  outside: string[];
  relays: string[];
}

/** Durée prévue : aller et retour à l'allure de la formation, plus les jours sur l'objectif. */
export function planDays(world: World, plan: ExpeditionPlan): Explained {
  const e = militaryWorld(world).exp;
  const km = routeKm(militaryWorld(world).geo, plan.route);
  const pace = e.pace_km_per_day[plan.formation];
  return new Explainer().base("why.exp_days_travel", Math.ceil(km / pace) * 2, { km: Math.round(km), pace }).add("why.exp_days_objective", e.objective_days[plan.objective] ?? 0).done();
}

/** Gaz par homme engagé contre une classe de Titan (R-gaz, D-77) ; la table couvre toutes les classes (contrôlé par les tests de données). */
export function gasPerEngaged(g: { gas_per_engaged_by_class: Record<string, [number, number]> }, classId: string): [number, number] {
  const r = g.gas_per_engaged_by_class[classId];
  if (!r) throw new Error(`gaz par engagement : classe ${classId} absente de data/balance/expeditions.json`);
  return r;
}

/**
 * Estimation analytique du pré-brief (F-EXP-15) : espérance des contacts, engagements et morts sur l'itinéraire,
 * avec les mêmes paramètres que l'auto-résolution (hors aléa). Chaque grandeur est expliquée.
 */
export function estimatePlan(world: World, st: StrategicState, mil: MilitaryState, date: GameDate, plan: ExpeditionPlan): PlanEstimate {
  const m = militaryWorld(world);
  const e = m.exp;
  const n = Math.max(1, planHeadcount(mil, plan));
  const g = m.geo;
  const km = routeKm(g, plan.route);
  const days = planDays(world, plan);
  const f = e.formations[plan.formation];
  const pace = e.pace_km_per_day[plan.formation];
  // Jours passés dans chaque province (aller + retour) : longueur des arêtes adjacentes / allure.
  let densityDays = 0;
  for (let i = 1; i < plan.route.length; i++) {
    const a = plan.route[i - 1] as string;
    const b = plan.route[i] as string;
    const edge = g.adj.get(a)?.find((x) => x.to === b)?.km ?? 0;
    densityDays += ((titanDensity(world, a) + titanDensity(world, b)) / 2) * (edge / pace) * 2;
  }
  const target = plan.route[plan.route.length - 1] as string;
  densityDays += titanDensity(world, target) * (e.objective_days[plan.objective] ?? 0);
  const size = Math.pow(n / e.encounters.size_ref, e.encounters.size_exponent);
  const season = e.encounters.season[seasonOf(date)];
  const contacts = new Explainer()
    .base("why.exp_contacts_base", e.encounters.per_day_at_density_1 * densityDays, { dd: Math.round(densityDays * 10) / 10 })
    .mul("why.exp_contacts_night", 1 + e.encounters.night_share)
    .mul("why.exp_contacts_size", size, { n })
    .mul("why.exp_contacts_season", season, { season: seasonOf(date) })
    .done();
  const avoided = clamp(f.detection * f.evasion, 0, 0.98);
  const engagements = new Explainer().base("why.exp_engagements_contacts", contacts.value).mul("why.exp_engagements_avoided", 1 - avoided, { formation: `formation.${plan.formation}` }).done();
  const meanThreat = m.titans.reduce((s, t) => s + t.weight * t.threat, 0);
  const lnMean = Math.exp((e.engagement.sigma * e.engagement.sigma) / 2);
  const engaged = clamp(Math.round(n * f.engaged_share), e.engagement.min_engaged, e.engagement.max_engaged);
  const cat = e.engagement.catastrophe;
  const catP = cat.p_base * (1 + (cat.abnormal_mult - 1) * (m.titans.find((t) => t.abnormal)?.weight ?? 0)) * (plan.formation === "colonnes" ? cat.column_mult : 1);
  const catDeaths = catP * ((cat.share[0] + cat.share[1]) / 2) * Math.min(n, e.engagement.max_engaged);
  const deaths = new Explainer()
    .base("why.exp_deaths_engagements", engagements.value)
    .mul("why.exp_deaths_per_engagement", e.engagement.deaths_base * meanThreat * lnMean * f.exposure)
    .add("why.exp_deaths_catastrophe", engagements.value * catDeaths)
    .done();
  const wounded = deaths.value * e.engagement.wounded_per_death * e.engagement.serious_share * e.medical.serious_death_without;
  const deathsAll = new Explainer().base("why.exp_deaths_combat", deaths.value).add("why.exp_deaths_wounds", wounded).mul("why.exp_deaths_cap", Math.min(1, n / Math.max(1, deaths.value + wounded))).done();
  // Gaz moyen par homme engagé : table par classe (R-gaz, D-77), pondérée par la fréquence des classes.
  const gasPerMan = m.titans.reduce((s, t) => {
    const r = gasPerEngaged(e.engagement, t.id);
    return s + t.weight * ((r[0] + r[1]) / 2);
  }, 0) / Math.max(1e-9, m.titans.reduce((s, t) => s + t.weight, 0));
  const gas = new Explainer().base("why.exp_gas_engagements", engagements.value * engaged * gasPerMan, { engaged, per: Math.round(gasPerMan * 10) / 10 }).done();
  const food = new Explainer()
    .base("why.exp_food_soldiers", days.value * n * e.attrition.food_per_soldier, { n, days: days.value })
    .add("why.exp_food_horses", days.value * plan.horses * e.attrition.fodder_per_horse, { horses: plan.horses })
    .done();
  const relays = suggestRelays(world, st, mil, plan.route);
  return {
    km,
    days,
    contacts,
    engagements,
    deaths: deathsAll,
    deathsLow: Math.max(0, Math.round(deathsAll.value * 0.4)),
    deathsHigh: Math.min(n, Math.round(deathsAll.value * 2.2)),
    gasOdm: gas,
    food,
    outside: relays.outside,
    relays: relays.depots,
  };
}

/** Pré-brief : ce que le stratège annonce des pertes (sa fiabilité et son biais, P2) et ce que l'intendant annonce du gaz. */
export function preBrief(world: World, pol: PoliticalState | null, date: GameDate, est: PlanEstimate): { strategist: string | null; losses: number | null; reliability: number; bias: string | null; intendant: string | null; gas: number | null; gasReliability: number; gasBias: string | null } {
  const strategist = pol?.roles["role_stratege"] ?? null;
  const intendant = pol?.roles["role_intendant"] ?? null;
  const a = strategist && pol && pol.characters[strategist]?.alive ? advisorLens(world, pol, strategist, date, est.deaths.value, true) : null;
  const b = intendant && pol && pol.characters[intendant]?.alive ? advisorLens(world, pol, intendant, date, est.gasOdm.value, true) : null;
  return {
    strategist: a ? strategist : null,
    losses: a?.shown ?? null,
    reliability: a?.estimatedReliability ?? 0,
    bias: a?.bias ?? null,
    intendant: b ? intendant : null,
    gas: b?.shown ?? null,
    gasReliability: b?.estimatedReliability ?? 0,
    gasBias: b?.bias ?? null,
  };
}

/** Plan par défaut proposé par le planificateur : itinéraire, provisions et retrait calculés pour l'effectif choisi. */
export function defaultSupplies(world: World, mil: MilitaryState, plan: Omit<ExpeditionPlan, "supplies" | "wagons">): Pick<ExpeditionPlan, "supplies" | "wagons"> {
  const m = militaryWorld(world);
  const e = m.exp;
  const n = planHeadcount(mil, { ...plan, supplies: { food: 0, gas: 0, steel: 0 }, wagons: 0 });
  const days = planDays(world, { ...plan, supplies: { food: 0, gas: 0, steel: 0 }, wagons: 0 }).value + 2;
  const food = Math.ceil(days * (n * e.attrition.food_per_soldier + plan.horses * e.attrition.fodder_per_horse));
  const gas = Math.ceil((n * e.gas_spare_tanks_per_soldier * e.odm_tank) / e.odm_units_per_stock_unit);
  const steel = Math.ceil(n * e.blades.spare_pairs_per_soldier * e.blades.steel_per_pair);
  const cargo = plan.depotCargo.food + plan.depotCargo.gas + plan.depotCargo.steel;
  const wagons = Math.ceil((food + gas + steel + cargo) / m.log.convoy.wagon_capacity);
  return { supplies: { food, gas, steel }, wagons };
}

/**
 * Plan « type » proposé par le planificateur et utilisé par `sim:expeditions` : les `squadCount` premières escouades
 * disponibles, le plus court chemin depuis la base, un cheval par homme, provisions et chariots par défaut.
 */
export function standardPlan(world: World, mil: MilitaryState, target: string, formation: ExpeditionPlan["formation"], squadCount: number, officers: string[] = [], objective: ExpeditionPlan["objective"] = "reconnaissance"): ExpeditionPlan | null {
  const m = militaryWorld(world);
  const base = world.scenario.expedition_base;
  if (!base) return null;
  const route = shortestRoute(m.geo, base, target);
  if (!route) return null;
  const busy = new Set(mil.expeditions.flatMap((e) => e.plan.squads));
  const squads = mil.squads.filter((sq) => !busy.has(sq.id) && readyMembers(mil, sq.id).length === sq.members.length).slice(0, squadCount).map((sq) => sq.id);
  const partial = { objective, route, formation, squads, officers, horses: 0, depotCargo: { food: 0, gas: 0, steel: 0 }, retreat: { ...m.exp.retreat_defaults } };
  const n = planHeadcount(mil, { ...partial, supplies: { food: 0, gas: 0, steel: 0 }, wagons: 0 });
  const withHorses = { ...partial, horses: n };
  return { ...withHorses, ...defaultSupplies(world, mil, withHorses) };
}
