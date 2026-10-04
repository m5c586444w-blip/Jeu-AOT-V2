import { Explainer } from "../core/explain";
import type { Explained } from "../core/explain";
import { seasonOf } from "../core/time";
import type { GameDate } from "../core/time";
import { emptyResources, RESOURCE_IDS } from "./resources";
import type { RationingLevel, ResourceId, ResourceMap } from "./resources";
import type { World } from "./world";

/**
 * Économie de base (02 §3, F-ECO-01 à 05). Réserve nationale unique en P1 (décision D-24) :
 * la répartition par province et les convois arrivent avec la logistique (P3).
 */
export type Control = "paradis" | "titans" | "perdu";

export interface ProvinceState {
  control: Control;
  population: number;
  morale: number;
  stability: number;
  garrison: { org: string; soldiers: number } | null;
  buildings: string[];
  /** État structurel d'un segment de mur (0–100) ; null pour les autres provinces. */
  wall_structure: number | null;
}

export interface AlertEntry {
  seq: number;
  date: GameDate;
  key: string;
  params: Record<string, string | number>;
  pause: boolean;
}

export interface StrategicState {
  scenario: string;
  faction: string;
  rationing: RationingLevel;
  stocks: ResourceMap;
  provinces: Record<string, ProvinceState>;
  /** Ressources en rupture la veille (pour ne signaler qu'une fois). */
  shortages: ResourceId[];
  log: AlertEntry[];
  alertSeq: number;
  /** P5 : densité de Titans ajoutée par les événements (invasion de Rose, nettoyage…), par province. */
  titanMods?: Record<string, number>;
}

const LOG_LIMIT = 60;

/** Contribution nommée à une grandeur (décret, strates, légitimité…), pour l'explication « pourquoi ? ». */
export interface ModEntry {
  key: string;
  value: number;
  params?: Record<string, string | number>;
}

/**
 * Modificateurs venus de la couche politique (P2). Cibles : `production_mult:<r>`, `consumption_mult:<r>`,
 * `losses_mult:<r>`, `morale`, `stability`, `tax_mult`, `manpower_mult` ; `provinceMorale` : par province.
 */
export interface EconomyMods {
  byTarget: Readonly<Record<string, readonly ModEntry[]>>;
  provinceMorale: Readonly<Record<string, readonly ModEntry[]>>;
}

export const NO_MODS: EconomyMods = { byTarget: {}, provinceMorale: {} };

function mods(m: EconomyMods, target: string): readonly ModEntry[] {
  return m.byTarget[target] ?? [];
}
const EPSILON = 1e-6;

export function createStrategicState(world: World): StrategicState {
  const sc = world.scenario;
  const eco = world.economy;
  const controlOf = (id: string): Control => sc.control[id] ?? sc.default_control;
  const weightOf = (lvl: number): number => eco.population.level_weights[lvl] ?? 0;
  const populated = world.provinces.filter((p) => controlOf(p.id) === "paradis" && p.pop_level > 0);
  const totalWeight = populated.reduce((s, p) => s + weightOf(p.pop_level), 0);
  const provinces: Record<string, ProvinceState> = {};
  for (const p of world.provinces) {
    const control = controlOf(p.id);
    const share = control === "paradis" && totalWeight > 0 ? weightOf(p.pop_level) / totalWeight : 0;
    provinces[p.id] = {
      control,
      population: Math.round((sc.population_total ?? eco.population.total_start) * share),
      morale: sc.morale,
      stability: sc.stability,
      garrison: sc.garrisons[p.id] ? { ...sc.garrisons[p.id] } as ProvinceState["garrison"] : null,
      buildings: [...(sc.buildings[p.id] ?? [])],
      wall_structure: p.kind === "segment" ? 100 : null,
    };
  }
  const stocks = emptyResources();
  for (const r of RESOURCE_IDS) stocks[r] = sc.stocks[r] ?? 0;
  return { scenario: sc.id, faction: sc.faction, rationing: sc.rationing, stocks, provinces, shortages: [], log: [], alertSeq: 0 };
}

// ——— Facteurs ————————————————————————————————————————————————

const lerp = (range: { at_0: number; at_100: number }, v: number): number => range.at_0 + ((range.at_100 - range.at_0) * Math.max(0, Math.min(100, v))) / 100;

export function totals(state: StrategicState): { population: number; soldiers: number } {
  let population = 0;
  let soldiers = 0;
  for (const p of Object.values(state.provinces)) {
    if (p.control !== "paradis") continue;
    population += p.population;
    soldiers += p.garrison?.soldiers ?? 0;
  }
  return { population, soldiers };
}

/** Production quotidienne d'une ressource par une province (formule 02 §3.2), avec ses facteurs. */
export function provinceProduction(world: World, state: StrategicState, date: GameDate, provinceId: string, r: ResourceId, m: EconomyMods = NO_MODS): Explained {
  const def = world.provinceById.get(provinceId);
  const ps = state.provinces[provinceId];
  const e = new Explainer();
  if (!def || !ps) return e.done();
  const eco = world.economy;
  const keyOut = eco.output.key_resource[def.key_resource]?.[r] ?? 0;
  if (keyOut === 0) return e.done();
  const popMult = eco.output.pop_level_mult[def.pop_level] ?? 1;
  e.base("why.key_resource", keyOut, { resource: def.key_resource });
  e.mul("why.pop_level", popMult, { level: def.pop_level });
  if (ps.control !== "paradis") return e.mul("why.not_controlled", 0).done();
  let bonus = 0;
  for (const b of ps.buildings) bonus += world.buildings.get(b)?.production_bonus[r] ?? 0;
  e.mul("why.buildings", 1 + bonus);
  e.mul("why.morale", lerp(eco.output.morale_factor, ps.morale), { morale: Math.round(ps.morale) });
  e.mul("why.stability", lerp(eco.output.stability_factor, ps.stability), { stability: Math.round(ps.stability) });
  const season = seasonOf(date);
  const seasonal = eco.output.season[season]?.[r];
  if (seasonal !== undefined) e.mul("why.season", seasonal, { season });
  e.mul("why.rationing_productivity", 1 + (eco.rationing[state.rationing]?.productivity ?? 0), { level: state.rationing });
  const scenarioMult = world.scenario.production_mult[r];
  if (scenarioMult !== undefined) e.mul("why.scenario_conditions", scenarioMult, { note: world.scenario.production_note_key ?? "" });
  for (const x of mods(m, `production_mult:${r}`)) e.mul(x.key, 1 + x.value, x.params);
  return e.done();
}

/** Capacité de stockage nationale par ressource. */
export function capacity(world: World, state: StrategicState, r: ResourceId): Explained {
  const eco = world.economy;
  const e = new Explainer().base("why.capacity_base", 0);
  if (r === "manpower") {
    return e.add("why.capacity_manpower", totals(state).population * eco.storage.manpower_cap_per_pop).done();
  }
  let fromPop = 0;
  let fromSegments = 0;
  let fromBuildings = 0;
  for (const def of world.provinces) {
    const ps = state.provinces[def.id];
    if (!ps || ps.control !== "paradis") continue;
    fromPop += def.pop_level * (eco.storage.per_pop_level[r] ?? 0);
    if (def.kind === "segment") fromSegments += eco.storage.per_segment[r] ?? 0;
    for (const b of ps.buildings) fromBuildings += world.buildings.get(b)?.storage[r] ?? 0;
  }
  return e.add("why.capacity_pop", fromPop).add("why.capacity_segments", fromSegments).add("why.capacity_buildings", fromBuildings).done();
}

export interface ResourceDay {
  production: Explained;
  consumption: Explained;
  losses: Explained;
  capacity: Explained;
  /** Variation nette prévue (avant plafonnement et rupture). */
  net: Explained;
  next: number;
  overflow: number;
  shortfall: number;
}

export interface DayPlan {
  date: GameDate;
  resources: Record<ResourceId, ResourceDay>;
  /** Part de la demande de nourriture non couverte (0 = aucune famine). */
  famine: number;
  moraleTarget: Record<string, Explained>;
  stabilityTarget: Record<string, Explained>;
}

/** Consommation quotidienne nationale d'une ressource. */
function consumption(world: World, state: StrategicState, date: GameDate, r: ResourceId, m: EconomyMods): Explainer {
  const c = world.economy.consumption;
  const { population, soldiers } = totals(state);
  const rationing = 1 + (world.economy.rationing[state.rationing]?.consumption ?? 0);
  const e = new Explainer().base("why.consumption_base", 0);
  switch (r) {
    case "food":
      e.add("why.food_population", population * c.food_per_pop, { population }).add("why.food_soldiers", soldiers * c.food_per_soldier, { soldiers });
      e.mul("why.rationing", rationing, { level: state.rationing });
      break;
    case "gas":
      e.add("why.gas_soldiers", soldiers * c.gas_per_soldier, { soldiers });
      if (seasonOf(date) === "hiver") e.add("why.gas_heating", population * c.gas_heating_per_pop_winter, { population });
      break;
    case "steel":
      e.add("why.steel_wear", soldiers * c.steel_per_soldier, { soldiers });
      break;
    case "powder":
      e.add("why.powder_drill", soldiers * c.powder_per_soldier, { soldiers });
      break;
    case "horses":
      e.add("why.horse_mortality", state.stocks.horses * c.horse_mortality);
      break;
    default:
      break;
  }
  for (const x of mods(m, `consumption_mult:${r}`)) e.mul(x.key, 1 + x.value, x.params);
  return e;
}

/** Plan d'une journée : ce que le tick va appliquer, et sa justification complète. */
export function planDay(world: World, state: StrategicState, date: GameDate, m: EconomyMods = NO_MODS): DayPlan {
  const eco = world.economy;
  const prod: Record<string, Explainer> = {};
  const cons: Record<string, Explainer> = {};
  for (const r of RESOURCE_IDS) {
    prod[r] = new Explainer().base("why.production_base", 0);
    cons[r] = consumption(world, state, date, r, m);
  }
  for (const def of world.provinces) {
    for (const r of RESOURCE_IDS) {
      const v = provinceProduction(world, state, date, def.id, r, m).value;
      if (v !== 0) prod[r]?.add("why.from_province", v, { province: def.name_key });
    }
  }
  // Pertes (avaries, vols) calculées sur le stock du matin, avant les transformations.
  const lossX: Record<string, Explained> = {};
  for (const r of RESOURCE_IDS) {
    const lx = new Explainer().base("why.losses_base", 0).add("why.losses", state.stocks[r] * (eco.losses_per_day[r] ?? 0), { rate: eco.losses_per_day[r] ?? 0 });
    for (const x of mods(m, `losses_mult:${r}`)) lx.mul(x.key, 1 + x.value, x.params);
    lossX[r] = lx.done();
  }
  // Transformations (fabriques) : elles prennent dans le stock + la production du jour, sans créer de rupture.
  for (const def of world.provinces) {
    const ps = state.provinces[def.id];
    if (!ps || ps.control !== "paradis") continue;
    for (const b of ps.buildings) {
      const conv = world.buildings.get(b)?.conversion;
      if (!conv) continue;
      const available = state.stocks[conv.from] + (prod[conv.from]?.value ?? 0) - (cons[conv.from]?.value ?? 0) - (lossX[conv.from]?.value ?? 0);
      const used = Math.max(0, Math.min(conv.per_day * conv.ratio, available));
      cons[conv.from]?.add("why.conversion_input", used, { building: world.buildings.get(b)?.name_key ?? b });
      prod[conv.to]?.add("why.conversion_output", used / conv.ratio, { building: world.buildings.get(b)?.name_key ?? b });
    }
  }
  const resources = {} as Record<ResourceId, ResourceDay>;
  let famine = 0;
  for (const r of RESOURCE_IDS) {
    const production = (prod[r] as Explainer).done();
    const consumptionX = (cons[r] as Explainer).done();
    const losses = lossX[r] as Explained;
    const cap = capacity(world, state, r);
    const net = new Explainer()
      .base("why.net_production", production.value)
      .add("why.net_consumption", -consumptionX.value)
      .add("why.net_losses", -losses.value)
      .done();
    const raw = state.stocks[r] + net.value;
    // Tolérance d'arrondi flottant : une fabrique qui vide exactement son stock n'est pas une rupture.
    const shortfall = raw < -EPSILON ? -raw : 0;
    const bounded = Math.max(0, raw);
    const overflow = bounded > cap.value ? bounded - Math.max(cap.value, state.stocks[r]) : 0;
    const next = bounded - Math.max(0, overflow);
    if (r === "food" && consumptionX.value > 0) famine = shortfall / consumptionX.value;
    resources[r] = { production, consumption: consumptionX, losses, capacity: cap, net, next, overflow: Math.max(0, overflow), shortfall };
  }

  const moraleTarget: Record<string, Explained> = {};
  const stabilityTarget: Record<string, Explained> = {};
  const foodPerDay = resources.food.consumption.value;
  const reserveDays = foodPerDay > 0 ? state.stocks.food / foodPerDay : Infinity;
  for (const def of world.provinces) {
    const ps = state.provinces[def.id];
    if (!ps || ps.control !== "paradis") continue;
    const mt = new Explainer().base("why.morale_base", eco.morale.base_target);
    mt.add("why.morale_rationing", eco.rationing[state.rationing]?.morale ?? 0, { level: state.rationing });
    if (famine > 0) mt.add("why.morale_famine", eco.morale.famine);
    if (seasonOf(date) === "hiver") mt.add("why.morale_winter", eco.morale.winter);
    if (reserveDays >= eco.morale.reserve_days) mt.add("why.morale_reserve", eco.morale.reserve_bonus, { days: eco.morale.reserve_days });
    for (const x of mods(m, "morale")) mt.add(x.key, x.value, x.params);
    for (const x of m.provinceMorale[def.id] ?? []) mt.add(x.key, x.value, x.params);
    moraleTarget[def.id] = mt.done();
    const stx = new Explainer().base("why.stability_base", eco.stability.base_target).add("why.stability_morale", eco.stability.per_morale * ps.morale, { morale: Math.round(ps.morale) });
    for (const x of mods(m, "stability")) stx.add(x.key, x.value, x.params);
    stabilityTarget[def.id] = stx.done();
  }
  return { date, resources, famine, moraleTarget, stabilityTarget };
}

const clamp100 = (v: number): number => Math.max(0, Math.min(100, v));

export function pushLog(s: StrategicState, date: GameDate, key: string, params: Record<string, string | number>, pause: boolean): void {
  s.alertSeq += 1;
  s.log.push({ seq: s.alertSeq, date: { ...date }, key, params, pause });
  if (s.log.length > LOG_LIMIT) s.log.splice(0, s.log.length - LOG_LIMIT);
}

/** Applique le plan du jour (calculé à la date `plan.date`) ; renvoie un nouvel état. */
export function applyDay(world: World, state: StrategicState, plan: DayPlan): StrategicState {
  const eco = world.economy;
  const next: StrategicState = structuredClone(state);
  for (const r of RESOURCE_IDS) next.stocks[r] = plan.resources[r].next;
  for (const def of world.provinces) {
    const ps = next.provinces[def.id];
    const mt = plan.moraleTarget[def.id];
    const st = plan.stabilityTarget[def.id];
    if (!ps || !mt || !st) continue;
    ps.morale = clamp100(ps.morale + (mt.value - ps.morale) * eco.morale.approach_per_day);
    ps.stability = clamp100(ps.stability + (st.value - ps.stability) * eco.stability.approach_per_day);
    if (plan.famine > 0) ps.population = Math.max(0, ps.population - ps.population * eco.famine.mortality_per_day * plan.famine);
  }
  const shortages = RESOURCE_IDS.filter((r) => plan.resources[r].shortfall > 0);
  for (const r of shortages) {
    if (!state.shortages.includes(r)) pushLog(next, plan.date, "alert.shortage", { resource: r }, eco.alerts.pause_on_shortage.includes(r));
  }
  for (const r of state.shortages) if (!shortages.includes(r)) pushLog(next, plan.date, "alert.recovered", { resource: r }, false);
  next.shortages = shortages;
  return next;
}

export interface MonthPlan {
  taxes: Explained;
  upkeep: Explained;
  manpower: Explained;
}

/** Flux mensuels (02 §1 : économie, budgets, recrutement). */
export function planMonth(world: World, state: StrategicState, mm: EconomyMods = NO_MODS): MonthPlan {
  const m = world.economy.monthly;
  let weightedStability = 0;
  const { population, soldiers } = totals(state);
  for (const ps of Object.values(state.provinces)) if (ps.control === "paradis") weightedStability += ps.population * ps.stability;
  const stability = population > 0 ? weightedStability / population : 0;
  const tx = new Explainer()
    .base("why.taxes_population", population * m.tax_per_pop, { population })
    .mul("why.taxes_stability", m.tax_stability_floor + ((1 - m.tax_stability_floor) * stability) / 100, { stability: Math.round(stability) });
  for (const x of mods(mm, "tax_mult")) tx.mul(x.key, 1 + x.value, x.params);
  const taxes = tx.done();
  let buildingUpkeep = 0;
  for (const ps of Object.values(state.provinces)) {
    if (ps.control !== "paradis") continue;
    for (const b of ps.buildings) buildingUpkeep += world.buildings.get(b)?.upkeep_gold_month ?? 0;
  }
  const upkeep = new Explainer().base("why.upkeep_soldiers", soldiers * m.soldier_upkeep, { soldiers }).add("why.upkeep_buildings", buildingUpkeep).done();
  const mp = new Explainer().base("why.manpower_growth", population * m.manpower_growth_per_pop, { population });
  for (const x of mods(mm, "manpower_mult")) mp.mul(x.key, 1 + x.value, x.params);
  const manpower = mp.done();
  return { taxes, upkeep, manpower };
}

export function applyMonth(world: World, state: StrategicState, plan: MonthPlan, date: GameDate): StrategicState {
  const next = structuredClone(state);
  const gold = next.stocks.gold + plan.taxes.value - plan.upkeep.value;
  if (gold < 0) pushLog(next, date, "alert.treasury_empty", {}, true);
  next.stocks.gold = Math.max(0, Math.min(gold, capacity(world, next, "gold").value));
  next.stocks.manpower = Math.min(next.stocks.manpower + plan.manpower.value, capacity(world, next, "manpower").value);
  return next;
}
