import { Rng } from "../core/rng";
import { seasonOf, toAbsoluteDay } from "../core/time";
import type { GameDate } from "../core/time";
import { characterDies } from "../politics/characters";
import type { PoliticalState } from "../politics/state";
import { effectiveAttributes } from "../politics/state";
import { runBattle } from "../tactical/battle";
import type { BattleSetup, TimedOrder } from "../tactical/types";
import { pushLog } from "../strategic/economy";
import type { StrategicState } from "../strategic/economy";
import type { MilitaryWorld, World } from "../strategic/world";
import type { ExpeditionsBalance } from "../../data/balance";
import { gasFromStock, planCapitalCost, planProblem, planSoldiers } from "./plan";
import { clamp, lognormal, poisson, uniform, weighted } from "./random";
import { edgeKm, supplyAt, titanDensity } from "./routes";
import type { DeadRecord, Expedition, ExpeditionPlan, ExpeditionReport, FieldLogEntry, MilitaryState, Soldier } from "./state";
import { militaryWorld, REPORTS_LIMIT, soldierName } from "./state";
import type { FieldDeathCause, Signal, Weather } from "./vocabulary";
import { WEATHERS } from "./vocabulary";

/** Contexte mutable d'un jour de simulation militaire (copies déjà faites par l'appelant). */
export interface MilCtx {
  world: World;
  m: MilitaryWorld;
  seed: number;
  date: GameDate;
  st: StrategicState;
  pol: PoliticalState | null;
  mil: MilitaryState;
}

const LOG_CAP = 80;
const SIGNAL_CAP = 60;

function fieldLog(e: Expedition, key: string, params: Record<string, string | number>): void {
  e.log.push({ day: e.day, key, params });
  if (e.log.length > LOG_CAP) e.log.splice(0, e.log.length - LOG_CAP);
}

function signal(e: Expedition, province: string, color: Signal, misread: boolean): void {
  e.signals.push({ day: e.day, province, color, misread });
  if (e.signals.length > SIGNAL_CAP) e.signals.splice(0, e.signals.length - SIGNAL_CAP);
}

/** Temps du jour, commun à toutes les expéditions (tirage par date, F-EXP-05). */
export function weatherOn(world: World, seed: number, date: GameDate): Weather {
  const e = militaryWorld(world).exp;
  const table = e.weather.by_season[seasonOf(date)];
  const rng = new Rng(seed).fork(`meteo:${toAbsoluteDay(date)}`);
  return weighted(rng, WEATHERS.map((w) => [w, table[w] ?? 0] as const));
}

/**
 * Contacts attendus en une journée (F-EXP-05) : densité × taille de la colonne × saison × temps ;
 * la nuit, au camp, les Titans sont bien moins actifs (03 §5.2) : `night_share` du taux de jour.
 */
export function contactRate(world: World, density: number, n: number, date: GameDate, weather: Weather): { day: number; night: number; total: number } {
  const x = militaryWorld(world).exp;
  const day = x.encounters.per_day_at_density_1 * density * Math.pow(n / x.encounters.size_ref, x.encounters.size_exponent) * x.encounters.season[seasonOf(date)] * x.weather.effects[weather].encounters;
  const night = day * x.encounters.night_share;
  return { day, night, total: day + night };
}

/** Lance une expédition (AC3-05) : vérifie le plan, prélève hommes, chevaux, provisions, or et capital. */
export function launchExpedition(ctx: MilCtx, plan: ExpeditionPlan): Expedition {
  const p = planProblem(ctx.world, ctx.st, ctx.pol, ctx.mil, ctx.date, plan);
  if (p) throw new Error(`Plan refusé : ${p.key} ${JSON.stringify(p.params)}`);
  const e = ctx.m.exp;
  const lg = ctx.m.log;
  const soldiers = planSoldiers(ctx.mil, plan);
  const n = soldiers.length + plan.officers.length;
  const capital = ctx.pol ? planCapitalCost(ctx.world, ctx.mil, plan).value : 0;
  const gold = plan.objective === "depot" ? lg.depot.gold_cost : 0;
  const s = ctx.st.stocks;
  s.gas -= gasFromStock(ctx.world, n, plan) + plan.depotCargo.gas;
  s.food -= plan.supplies.food + plan.depotCargo.food;
  s.steel -= plan.supplies.steel + plan.depotCargo.steel;
  s.horses -= plan.horses + plan.wagons * lg.convoy.horses_per_wagon;
  s.gold -= gold;
  if (ctx.pol) ctx.pol.capital -= capital;
  for (const id of soldiers) {
    const so = ctx.mil.soldiers[id];
    if (so) so.status = "mission";
  }
  ctx.mil.seq.expedition += 1;
  const gasOdm = n * e.odm_tank + plan.supplies.gas * e.odm_units_per_stock_unit;
  const exp: Expedition = {
    id: `exp_${ctx.mil.seq.expedition}`,
    number: ctx.mil.seq.expedition,
    plan: structuredClone(plan),
    status: "en_route",
    phase: "aller",
    launched: { ...ctx.date },
    day: 0,
    path: plan.route.slice(),
    trail: [plan.route[0] as string],
    progressKm: 0,
    objectiveDaysLeft: 0,
    objectiveReached: false,
    retreat: null,
    soldiers,
    officers: plan.officers.slice(),
    horses: plan.horses + plan.wagons * lg.convoy.horses_per_wagon,
    horseFatigue: 0,
    morale: 70,
    gasOdm,
    gasOdmStart: gasOdm,
    bladePairs: n * e.blades.pairs_per_soldier + plan.supplies.steel / e.blades.steel_per_pair,
    food: plan.supplies.food,
    foodStart: plan.supplies.food,
    seriousWounded: [],
    alerted: [],
    stats: { departed: n, encounters: 0, detected: 0, evaded: 0, engagements: 0, abnormal: 0, titansKilled: 0, byClass: {}, gasUsedOdm: 0, bladesUsed: 0, foodUsed: 0, horsesLost: 0, wounded: 0, deathsByCause: {}, daysOutside: 0 },
    signals: [],
    log: [],
    dead: [],
    namedDead: [],
    pending: null,
    capitalPaid: capital,
    goldPaid: gold,
  };
  fieldLog(exp, "field.departure", { n, formation: `formation.${plan.formation}`, target: plan.route[plan.route.length - 1] as string });
  pushLog(ctx.st, ctx.date, "log.expedition_departed", { n: exp.number, soldiers: n, target: plan.route[plan.route.length - 1] as string }, false);
  ctx.mil.expeditions.push(exp);
  return exp;
}

/** Rappel (F-EXP-04) : demi-tour immédiat, comme un retrait. */
export function recallExpedition(ctx: MilCtx, id: string): void {
  const e = ctx.mil.expeditions.find((x) => x.id === id);
  if (!e || e.status !== "en_route") throw new Error(`Expédition introuvable ou terminée : ${id}`);
  if (e.phase === "retour") return;
  startReturn(e, "max_days", "field.recalled");
}

function startReturn(e: Expedition, reason: Expedition["retreat"], key: string): void {
  e.phase = "retour";
  e.retreat = reason;
  e.path = e.trail.slice().reverse();
  e.progressKm = 0;
  fieldLog(e, key, { reason: reason ?? "" });
  signal(e, e.path[0] as string, "vert", false);
}

function alive(ctx: MilCtx, e: Expedition): Soldier[] {
  return e.soldiers.map((id) => ctx.mil.soldiers[id]).filter((s): s is Soldier => !!s && s.status !== "mort");
}

function headcount(ctx: MilCtx, e: Expedition): number {
  return alive(ctx, e).length + e.officers.length;
}

/** Commandant : premier officier nommé vivant ; sa tactique améliore détection et esquive. */
function commanderTactics(ctx: MilCtx, e: Expedition): number {
  const pw = ctx.world.politics;
  const id = e.officers[0];
  if (!pw || !ctx.pol || !id) return 50;
  const c = pw.characters.get(id);
  const cs = ctx.pol.characters[id];
  return c && cs ? effectiveAttributes(pw, c, cs).tactics : 50;
}

function isAckerman(ctx: MilCtx, id: string): boolean {
  return ctx.world.politics?.characters.get(id)?.traits.includes("trait_ackerman") ?? false;
}

function killSoldier(ctx: MilCtx, e: Expedition, s: Soldier, cause: FieldDeathCause, province: string): void {
  s.status = "mort";
  s.death = { date: { ...ctx.date }, province, cause, expedition: e.id, squad: s.squad };
  e.dead.push(s.id);
  e.stats.deathsByCause[cause] = (e.stats.deathsByCause[cause] ?? 0) + 1;
  e.seriousWounded = e.seriousWounded.filter((x) => x !== s.id);
}

function killOfficer(ctx: MilCtx, e: Expedition, id: string, cause: FieldDeathCause, province: string): void {
  e.officers = e.officers.filter((x) => x !== id);
  e.namedDead.push(id);
  e.stats.deathsByCause[cause] = (e.stats.deathsByCause[cause] ?? 0) + 1;
  fieldLog(e, "field.officer_killed", { name: id, province });
  if (ctx.pol && ctx.pol.characters[id]?.alive) {
    const r = characterDies(ctx.world, ctx.pol, ctx.st, ctx.date, id, "combat", "death.circumstances.expedition");
    ctx.pol = r.state;
    ctx.st = r.strategic;
  }
}

const ROLE_EXPOSURE: Record<string, number> = { tueur: 1.5, eclaireur: 1.2, cavalier: 1, soutien: 0.7, medecin: 0.5 };

export interface EngagementFactors {
  threat: number;
  group: number;
  skill: number;
  /** Facteur des vétérans (1 = aucun). */
  veteran: number;
  gasMult: number;
  bladeMult: number;
  morale: number;
  exposure: number;
  misread: boolean;
}

/**
 * Médiane des morts d'un engagement (auto-résolution, 03 §12) : menace × taille du groupe × compétence × vétérans
 * × gaz × lames × moral × exposition de la formation. Partagée avec la comparaison au combat joué (AC4-08).
 */
export function engagementMedian(x: ExpeditionsBalance, f: EngagementFactors): number {
  const g = x.engagement;
  return g.deaths_base * f.threat * f.group * Math.exp(-g.skill_k * (f.skill - 50)) * f.veteran * f.gasMult * f.bladeMult * Math.exp(-g.morale_k * (f.morale - 50)) * f.exposure * (f.misread ? x.signals.misread_engage_mult : 1);
}

type PoolEntry = { kind: "s" | "o"; id: string; w: number; odm: number };

/** Hommes engagés dans un contact : les plus exposés d'abord (tueurs, éclaireurs) ; officiers nommés moins exposés, Ackerman encore moins. */
function selectEngaged(ctx: MilCtx, e: Expedition, rng: Rng, abnormal: boolean, group: number): { engaged: PoolEntry[]; rest: PoolEntry[]; engagedN: number } {
  const x = ctx.m.exp;
  const g = x.engagement;
  const troops = alive(ctx, e);
  const n = troops.length + e.officers.length;
  const f = x.formations[e.plan.formation];
  const engagedN = clamp(Math.round(n * f.engaged_share * (abnormal ? 1.5 : 1) * Math.sqrt(group)), Math.min(n, g.min_engaged), Math.min(n, g.max_engaged));
  const pool: PoolEntry[] = [
    ...troops.map((s) => ({ kind: "s" as const, id: s.id, w: ROLE_EXPOSURE[s.role] ?? 1, odm: s.odm })),
    ...e.officers.map((id) => ({ kind: "o" as const, id, w: x.named.exposure_mult * (isAckerman(ctx, id) ? x.named.ackerman_mult : 1), odm: 80 })),
  ];
  const engaged: PoolEntry[] = [];
  const rest = pool.slice();
  while (engaged.length < engagedN && rest.length > 0) {
    const pick = weighted(rng, rest.map((p, i) => [i, p.w] as const));
    engaged.push(rest.splice(pick, 1)[0] as PoolEntry);
  }
  return { engaged, rest, engagedN };
}

/** Carte tactique du terrain d'une province (P4). */
function battleMapFor(ctx: MilCtx, province: string): string {
  const terrain = ctx.world.provinceById.get(province)?.terrain;
  if (terrain === "foret") return "tmap_foret";
  if (terrain === "mur") return "tmap_mur";
  if (terrain === "urbain" || terrain === "souterrain" || terrain === "fort" || terrain === "ruines") return "tmap_ville";
  return "tmap_plaine";
}

/** Prépare un engagement à jouer (F-EXP-18) : mêmes hommes engagés que l'auto-résolution, carte du terrain, type de Titan de la classe. */
function pendBattle(ctx: MilCtx, e: Expedition, province: string, titanId: string, group: number, misread: boolean, weather: Weather): void {
  const tw = ctx.world.tactical;
  const cls = ctx.m.titans.find((t) => t.id === titanId);
  if (!tw || !cls) return;
  const rng = new Rng(ctx.seed).fork(`bataille:${e.id}:${e.day}`);
  const { engaged } = selectEngaged(ctx, e, rng, cls.abnormal, group);
  const types = [...tw.titanTypes.values()].filter((t) => t.class === titanId);
  const type = types.length > 0 ? weighted(rng, types.map((t) => [t.id, t.weight] as const)) : null;
  if (!type) return;
  const pw = ctx.world.politics;
  const soldiers: BattleSetup["soldiers"] = engaged.map((p) => {
    if (p.kind === "s") {
      const s = ctx.mil.soldiers[p.id] as Soldier;
      return { id: s.id, name: soldierName(s), squad: s.squad, leader: s.leader, named: null, odm: s.odm, melee: s.melee, courage: s.courage, reaction: s.endurance, ackerman: false, veteran: s.expeditions };
    }
    const c = pw?.characters.get(p.id);
    const a = c && pw && ctx.pol ? effectiveAttributes(pw, c, ctx.pol.characters[p.id]) : null;
    return { id: p.id, name: c?.display_name ?? c?.name ?? p.id, squad: "officiers", leader: true, named: p.id, odm: a?.odm ?? 80, melee: a?.melee ?? 70, courage: a?.composure ?? 70, reaction: a?.endurance ?? 70, ackerman: isAckerman(ctx, p.id), veteran: 5 };
  });
  const night = rng.next() < x_night(ctx);
  e.pending = {
    setup: { map: battleMapFor(ctx, province), seed: new Rng(ctx.seed).fork(`seed:${e.id}:${e.day}`).int(1, 2 ** 30), night, soldiers, titans: [{ type, count: group }], wagon: false },
    province,
    titan: titanId,
    group,
    misread,
    weather,
    engaged: { soldiers: engaged.filter((p) => p.kind === "s").map((p) => p.id), officers: engaged.filter((p) => p.kind === "o").map((p) => p.id) },
  };
  fieldLog(e, "field.battle_pending", { province, titan: cls.name_key });
  pushLog(ctx.st, ctx.date, "log.battle_pending", { n: e.number, province }, true);
}

/** Part des contacts nocturnes (03 §5.2) : la même que pour les rencontres. */
function x_night(ctx: MilCtx): number {
  const ns = ctx.m.exp.encounters.night_share;
  return ns / (1 + ns);
}

/**
 * Résout une bataille en attente (AC4-10) : « jouer » rejoue la bataille tactique à partir de sa graine et des ordres
 * du joueur, puis reporte morts, blessés, gaz, lames et Titans abattus ; « auto » applique l'auto-résolution de P3.
 */
export function resolveBattle(ctx: MilCtx, id: string, mode: "jouer" | "auto", orders: readonly TimedOrder[]): void {
  const e = ctx.mil.expeditions.find((x) => x.id === id);
  const p = e?.pending;
  if (!e || !p) throw new Error(`Aucune bataille en attente pour ${id}`);
  e.pending = null;
  if (mode === "auto") {
    engage(ctx, e, new Rng(ctx.seed).fork(`auto:${e.id}:${e.day}`), p.province, p.titan, p.group, p.misread, p.weather);
    fieldLog(e, "field.battle_auto", { province: p.province });
    return;
  }
  const result = runBattle(ctx.world, p.setup, orders);
  const cls = ctx.m.titans.find((t) => t.id === p.titan);
  for (const u of result.dead) {
    const cause: FieldDeathCause = u.death?.cause === "hemorragie" ? "hemorragie" : cls?.abnormal ? "anormal" : "titan";
    if (u.named) killOfficer(ctx, e, u.named, cause, p.province);
    else {
      const s = ctx.mil.soldiers[u.id];
      if (s && s.status !== "mort") killSoldier(ctx, e, s, cause, p.province);
    }
  }
  for (const u of result.survivors) {
    if (u.wound === "grave" && !u.named && !e.seriousWounded.includes(u.id)) e.seriousWounded.push(u.id);
    if (u.wound !== "aucune") e.stats.wounded += 1;
    const s = ctx.mil.soldiers[u.id];
    if (s) s.kills += u.kills;
  }
  const gasUsed = result.state.stats.gasUsed;
  e.gasOdm = Math.max(0, e.gasOdm - gasUsed);
  e.stats.gasUsedOdm += gasUsed;
  e.bladePairs = Math.max(0, e.bladePairs - result.state.stats.bladesBroken);
  e.stats.bladesUsed += result.state.stats.bladesBroken;
  e.stats.titansKilled += result.state.stats.napes;
  e.stats.engagements += 1;
  e.morale = clamp(e.morale - result.dead.length * 1.5 + result.state.stats.napes, 0, 100);
  fieldLog(e, "field.battle_played", { province: p.province, deaths: result.dead.length, killed: result.state.stats.napes, end: `battle.end_short.${result.state.ended?.reason ?? "temps"}` });
}

/** Un engagement (03 §12) : pertes à queue épaisse (log-normale + catastrophe rare), blessés, Titans abattus, gaz. */
function engage(ctx: MilCtx, e: Expedition, rng: Rng, province: string, titanId: string, group: number, misread: boolean, weather: Weather): void {
  const x = ctx.m.exp;
  const g = x.engagement;
  const cls = ctx.m.titans.find((t) => t.id === titanId);
  if (!cls) return;
  const troops = alive(ctx, e);
  const n = troops.length + e.officers.length;
  if (n === 0) return;
  const f = x.formations[e.plan.formation];
  const { engaged, rest } = selectEngaged(ctx, e, rng, cls.abnormal, group);
  const skill = engaged.reduce((s, p) => s + p.odm, 0) / Math.max(1, engaged.length);
  const vets = troops.length > 0 ? troops.reduce((s, t) => s + t.expeditions, 0) / troops.length : 0;
  const veteran = 1 - Math.min(x.experience.max_bonus, x.experience.survival_per_expedition * vets * g.veteran_k * 10);
  const gasNeed = engaged.length * g.gas_per_engaged[0];
  const gasMult = e.gasOdm < gasNeed ? g.no_gas_mult : 1;
  const bladeMult = e.bladePairs < engaged.length * 0.5 ? g.no_blades_mult : 1;
  const median = engagementMedian(x, { threat: cls.threat, group, skill, veteran, gasMult, bladeMult, morale: e.morale, exposure: f.exposure, misread });
  let deaths = Math.min(engaged.length, Math.floor(lognormal(rng, median, g.sigma)));
  const catP = g.catastrophe.p_base * (cls.abnormal ? g.catastrophe.abnormal_mult : 1) * (e.plan.formation === "colonnes" ? g.catastrophe.column_mult : 1);
  let catastrophe = false;
  const victims: PoolEntry[] = [];
  const pickVictim = (from: PoolEntry[]): void => {
    if (from.length === 0) return;
    const i = weighted(rng, from.map((p, k) => [k, (110 - p.odm) * p.w] as const));
    victims.push(from.splice(i, 1)[0] as PoolEntry);
  };
  for (let k = 0; k < deaths; k++) pickVictim(engaged);
  if (rng.next() < catP) {
    // Rupture de formation : la catastrophe déborde sur le reste de la colonne (ex. un anormal au cœur de la formation).
    catastrophe = true;
    // Taille bornée par `max_engaged`, identique pour toutes les formations : la colonne paie par la fréquence, pas par l'ampleur.
    const extra = Math.round(uniform(rng, g.catastrophe.share[0], g.catastrophe.share[1]) * Math.min(rest.length + engaged.length, g.max_engaged));
    for (let k = 0; k < extra; k++) pickVictim(rng.next() < 0.5 && engaged.length > 0 ? engaged : rest.length > 0 ? rest : engaged);
    deaths = victims.length;
  }
  const cause: FieldDeathCause = cls.abnormal ? "anormal" : "titan";
  for (const v of victims) {
    if (v.kind === "s") {
      const s = ctx.mil.soldiers[v.id];
      if (s) killSoldier(ctx, e, s, cause, province);
    } else killOfficer(ctx, e, v.id, cause, province);
  }
  // Blessés parmi les survivants engagés ; un blessé grave peut mourir d'hémorragie ou d'infection (03 §9).
  const survivors = engaged.filter((p) => p.kind === "s");
  const woundedN = Math.min(survivors.length, Math.round(deaths * g.wounded_per_death * uniform(rng, 0.5, 1.5)));
  const hasMedic = alive(ctx, e).some((s) => s.role === "medecin");
  let fromWounds = 0;
  for (let k = 0; k < woundedN; k++) {
    const i = Math.floor(rng.next() * survivors.length);
    const w = survivors.splice(i, 1)[0];
    const s = w ? ctx.mil.soldiers[w.id] : undefined;
    if (!s) continue;
    e.stats.wounded += 1;
    if (rng.next() >= g.serious_share) continue;
    const pDeath = hasMedic ? ctx.m.exp.medical.serious_death_with : ctx.m.exp.medical.serious_death_without;
    if (rng.next() < pDeath) {
      killSoldier(ctx, e, s, rng.next() < ctx.m.exp.medical.infection_share ? "infection" : "hemorragie", province);
      fromWounds++;
    } else if (!e.seriousWounded.includes(s.id)) e.seriousWounded.push(s.id);
  }
  let killed = 0;
  for (let k = 0; k < group; k++) if (rng.next() < clamp(g.kill_prob * Math.exp(g.skill_k * (skill - 50)), 0.05, 0.95)) killed++;
  e.stats.titansKilled += killed;
  const credited = alive(ctx, e);
  for (let k = 0; k < killed && credited.length > 0; k++) {
    const s = credited[Math.floor(rng.next() * credited.length)];
    if (s) s.kills += 1;
  }
  const gasUsed = engaged.length * uniform(rng, g.gas_per_engaged[0], g.gas_per_engaged[1]);
  e.gasOdm = Math.max(0, e.gasOdm - gasUsed);
  e.stats.gasUsedOdm += gasUsed;
  const blades = Math.min(e.bladePairs, Math.round(engaged.length * 0.5));
  e.bladePairs -= blades;
  e.stats.bladesUsed += blades;
  const horses = Math.min(e.horses, Math.round(deaths * g.horses_per_death));
  e.horses -= horses;
  e.stats.horsesLost += horses;
  e.stats.engagements += 1;
  e.morale = clamp(e.morale - deaths * 1.5 + killed, 0, 100);
  fieldLog(e, catastrophe ? "field.catastrophe" : "field.engagement", { province, titan: cls.name_key, group, deaths: deaths + fromWounds, killed, weather });
}

/** Un jour d'expédition : marche, rencontres, consommation, ravitaillement, retrait, retour. */
export function stepExpedition(ctx: MilCtx, e: Expedition, weather: Weather): void {
  // Bataille en attente : l'expédition attend la décision du joueur (jouer ou auto-résoudre).
  if (e.pending) return;
  const x = ctx.m.exp;
  const g = ctx.m.geo;
  e.day += 1;
  const rng = new Rng(ctx.seed).fork(`exp:${e.id}:${e.day}`);
  const eff = x.weather.effects[weather];
  const visited: string[] = [e.path[0] as string];
  // 1. Marche (sauf pendant les jours sur l'objectif).
  if (e.phase === "objectif") {
    e.objectiveDaysLeft -= 1;
    e.horseFatigue = Math.max(0, e.horseFatigue - x.attrition.horse_rest_per_day);
  } else {
    const n = headcount(ctx, e);
    const horseFactor = e.horses >= n ? 1 : 0.6;
    let budget = x.pace_km_per_day[e.plan.formation] * eff.pace * horseFactor * (1 - e.horseFatigue / 200);
    while (budget > 0 && e.path.length > 1) {
      const here = e.path[0] as string;
      const next = e.path[1] as string;
      const left = (edgeKm(g, here, next) ?? 0) - e.progressKm;
      if (budget >= left) {
        budget -= left;
        e.path.shift();
        e.progressKm = 0;
        visited.push(next);
        if (e.phase === "aller") e.trail.push(next);
        else e.trail.pop();
      } else {
        e.progressKm += budget;
        budget = 0;
      }
    }
    e.horseFatigue = clamp(e.horseFatigue + x.attrition.horse_fatigue_per_day, 0, 100);
  }
  const here = e.path[0] as string;
  if (e.phase === "aller" && e.path.length === 1) {
    e.phase = "objectif";
    e.objectiveDaysLeft = x.objective_days[e.plan.objective] ?? 0;
    fieldLog(e, "field.arrived", { province: here });
    if (e.plan.objective === "depot") {
      ctx.mil.seq.depot += 1;
      ctx.mil.depots.push({ id: `dep_${ctx.mil.seq.depot}`, province: here, stocks: { ...e.plan.depotCargo }, built: { ...ctx.date }, lowAlerted: false });
      fieldLog(e, "field.depot_built", { province: here });
      pushLog(ctx.st, ctx.date, "log.depot_built", { province: here }, false);
    }
  }
  // 2. Rencontres : densité moyenne des provinces traversées dans la journée.
  const back = e.phase === "retour" && e.path.length === 1;
  if (!back) {
    const dens = visited.reduce((s, p) => s + titanDensity(ctx.world, p), 0) / visited.length;
    const n = headcount(ctx, e);
    const contacts = poisson(rng, contactRate(ctx.world, dens, n, ctx.date, weather).total);
    const tactics = commanderTactics(ctx, e);
    const f = x.formations[e.plan.formation];
    for (let k = 0; k < contacts && headcount(ctx, e) > 0; k++) {
      const titan = weighted(rng, ctx.m.titans.map((t) => [t.id, t.weight] as const));
      const cls = ctx.m.titans.find((t) => t.id === titan);
      const group = 1 + poisson(rng, dens * 0.6);
      e.stats.encounters += 1;
      e.stats.byClass[titan] = (e.stats.byClass[titan] ?? 0) + group;
      if (cls?.abnormal) e.stats.abnormal += 1;
      const pDetect = clamp(f.detection * eff.detection * (1 + x.encounters.commander_k * (tactics - 50)), 0.02, 0.98);
      let misread = false;
      if (rng.next() < pDetect) {
        e.stats.detected += 1;
        // Fusée rouge (Titan repéré) ou noire (anormal) ; une erreur de lecture empêche la réorientation (03 §7).
        misread = rng.next() < (x.signals.error_base + eff.signal_error) / f.signal_quality;
        signal(e, here, cls?.abnormal ? "noir" : "rouge", misread);
        const pEvade = clamp(f.evasion * (cls?.abnormal ? x.encounters.abnormal_evasion_mult : 1) * (1 + x.encounters.commander_k * (tactics - 50)), 0, 0.95);
        if (!misread && rng.next() < pEvade) {
          e.stats.evaded += 1;
          signal(e, here, "vert", false);
          continue;
        }
      }
      if (e.plan.play && ctx.world.tactical) {
        pendBattle(ctx, e, here, titan, group, misread, weather);
        break;
      }
      engage(ctx, e, rng, here, titan, group, misread, weather);
    }
  }
  // 3. Vivres et fourrage.
  const n = headcount(ctx, e);
  const need = n * x.attrition.food_per_soldier + e.horses * x.attrition.fodder_per_horse;
  const eaten = Math.min(e.food, need);
  e.food -= eaten;
  e.stats.foodUsed += eaten;
  if (eaten < need && n > 0) {
    e.morale = clamp(e.morale - 5, 0, 100);
    for (const s of alive(ctx, e)) if (rng.next() < x.attrition.hunger_death_rate) killSoldier(ctx, e, s, "epuisement", here);
  }
  // 4. Ravitaillement ou attrition (F-LOG-01, F-LOG-02).
  const sup = supplyAt(ctx.world, ctx.st, ctx.mil, here);
  if (sup.inSupply) {
    const wantFood = Math.max(0, e.foodStart - e.food);
    const wantGas = Math.max(0, e.gasOdmStart - e.gasOdm) / x.odm_units_per_stock_unit;
    const from = sup.depot ? sup.depot.stocks : ctx.st.stocks;
    const food = Math.min(wantFood, Math.max(0, from.food));
    const gas = Math.min(wantGas, Math.max(0, from.gas));
    from.food -= food;
    from.gas -= gas;
    e.food += food;
    e.gasOdm += gas * x.odm_units_per_stock_unit;
    e.morale = clamp(e.morale + 2, 0, 100);
  } else if (!back) {
    e.stats.daysOutside += 1;
    e.morale = clamp(e.morale - x.attrition.outside_morale_per_day, 0, 100);
    let lost = 0;
    const p = (e.horseFatigue / 100) * x.attrition.horse_mortality_at_fatigue_100;
    for (let k = 0; k < e.horses; k++) if (rng.next() < p) lost++;
    e.horses -= lost;
    e.stats.horsesLost += lost;
  }
  // 5. Alertes de seuil (F-LOG-13), une fois chacune.
  const gasPct = (100 * e.gasOdm) / Math.max(1, e.gasOdmStart);
  if (gasPct < ctx.m.log.alerts.expedition_gas_pct && !e.alerted.includes("gas")) {
    e.alerted.push("gas");
    pushLog(ctx.st, ctx.date, "log.expedition_low_gas", { n: e.number, pct: Math.round(gasPct) }, false);
  }
  if (need > 0 && e.food / need < ctx.m.log.alerts.expedition_food_days && !e.alerted.includes("food")) {
    e.alerted.push("food");
    pushLog(ctx.st, ctx.date, "log.expedition_low_food", { n: e.number }, false);
  }
  // 6. Retrait (F-EXP-04) : la première condition atteinte déclenche le demi-tour.
  if (e.phase !== "retour") {
    const r = e.plan.retreat;
    const lossPct = (100 * (e.stats.departed - headcount(ctx, e))) / Math.max(1, e.stats.departed);
    const reason = lossPct >= r.losses_pct ? "losses_pct" : gasPct <= r.gas_pct ? "gas_pct" : e.stats.abnormal >= r.abnormal ? "abnormal" : e.day >= r.max_days ? "max_days" : null;
    if (reason) startReturn(e, reason, "field.retreat");
    else if (e.phase === "objectif" && e.objectiveDaysLeft <= 0) {
      e.objectiveReached = true;
      fieldLog(e, "field.objective_done", { province: here });
      startReturn(e, null, "field.return");
    }
  }
  if (headcount(ctx, e) === 0) {
    fieldLog(e, "field.lost", { province: here });
    finishExpedition(ctx, e);
    return;
  }
  if (e.phase === "retour" && e.path.length === 1) finishExpedition(ctx, e);
}

/** Effets politiques du retour (F-EXP-07, AC3-09) : modificateurs décroissants de légitimité et de loyauté du Corps. */
export function returnEffects(world: World, reached: boolean, mortalityPct: number): { legitimacy: number; corpsLoyalty: number } {
  const p = militaryWorld(world).exp.politics;
  const legitimacy = (reached ? p.legitimacy_success : p.legitimacy_failure) + p.legitimacy_per_loss_pct * mortalityPct;
  const corpsLoyalty = (reached ? p.corps_loyalty_success : 0) + p.corps_loyalty_per_loss_pct * mortalityPct;
  return { legitimacy: Math.round(legitimacy * 10) / 10, corpsLoyalty: Math.round(corpsLoyalty * 10) / 10 };
}

function lessonsOf(e: Expedition, mortalityPct: number): FieldLogEntry[] {
  const out: FieldLogEntry[] = [];
  const s = e.stats;
  if (s.encounters > 0) out.push({ day: e.day, key: "lesson.detection", params: { detected: s.detected, encounters: s.encounters, evaded: s.evaded } });
  if (e.retreat) out.push({ day: e.day, key: `lesson.retreat_${e.retreat}`, params: {} });
  if (s.abnormal > 0) out.push({ day: e.day, key: "lesson.abnormal", params: { n: s.abnormal } });
  if (s.daysOutside > 0) out.push({ day: e.day, key: "lesson.outside", params: { days: s.daysOutside } });
  if (e.alerted.includes("gas")) out.push({ day: e.day, key: "lesson.gas", params: {} });
  const fromWounds = (s.deathsByCause.hemorragie ?? 0) + (s.deathsByCause.infection ?? 0);
  if (fromWounds > 0) out.push({ day: e.day, key: "lesson.wounds", params: { n: fromWounds } });
  if (e.signals.some((x) => x.misread)) out.push({ day: e.day, key: "lesson.signals", params: { n: e.signals.filter((x) => x.misread).length } });
  out.push({ day: e.day, key: mortalityPct >= 40 ? "lesson.heavy" : mortalityPct <= 15 ? "lesson.light" : "lesson.usual", params: { pct: Math.round(mortalityPct) } });
  return out;
}

/** Retour à la base : bilan, dossiers des morts, restitution des provisions, effets politiques, rapport (F-EXP-06). */
export function finishExpedition(ctx: MilCtx, e: Expedition): void {
  const x = ctx.m.exp;
  e.status = "terminee";
  const survivors = alive(ctx, e);
  const today = toAbsoluteDay(ctx.date);
  for (const s of survivors) {
    s.expeditions += 1;
    if (e.seriousWounded.includes(s.id)) {
      s.status = "blesse";
      s.recovers = today + x.wounds.recovery_days;
    } else s.status = "pret";
  }
  const st = ctx.st;
  st.stocks.food += e.food;
  st.stocks.gas += e.gasOdm / x.odm_units_per_stock_unit;
  st.stocks.steel += Math.max(0, e.bladePairs - survivors.length * x.blades.pairs_per_soldier) * x.blades.steel_per_pair;
  st.stocks.horses += e.horses;
  // L'effectif de garnison du Corps suit les morts (cohérence avec la consommation de l'économie).
  const soldiersDead = e.dead.length;
  for (const ps of Object.values(st.provinces)) {
    if (ps.garrison?.org === "survey_corps" && soldiersDead > 0) {
      ps.garrison = { ...ps.garrison, soldiers: Math.max(0, ps.garrison.soldiers - soldiersDead) };
      break;
    }
  }
  const departed = e.stats.departed;
  const deadTotal = e.dead.length + e.namedDead.length;
  const mortality = (100 * deadTotal) / Math.max(1, departed);
  const reached = e.objectiveReached;
  const fx = returnEffects(ctx.world, reached, mortality);
  if (ctx.pol) {
    const days = x.politics.mourning_days;
    ctx.pol.mourning.push({ target: "legitimacy", key: "why.expedition_outcome", params: { n: e.number }, start: today, value: fx.legitimacy, days });
    if (ctx.pol.orgs["org_survey_corps"]) ctx.pol.mourning.push({ target: "org_loyalty:org_survey_corps", key: "why.expedition_corps", params: { n: e.number }, start: today, value: fx.corpsLoyalty, days });
  }
  const dead: DeadRecord[] = [
    ...e.dead.map((id) => {
      const s = ctx.mil.soldiers[id] as Soldier;
      const d = s.death as NonNullable<Soldier["death"]>;
      return { id, name: soldierName(s), leader: s.leader, squad: s.squad, cause: d.cause, province: d.province, date: d.date, named: false };
    }),
    ...e.namedDead.map((id) => {
      const c = ctx.world.politics?.characters.get(id);
      return { id, name: c?.display_name ?? c?.name ?? id, leader: true, squad: "", cause: "titan" as FieldDeathCause, province: e.trail[e.trail.length - 1] ?? "", date: { ...ctx.date }, named: true };
    }),
  ];
  const outcome: ExpeditionReport["outcome"] = !reached ? "echec" : mortality >= 40 ? "partielle" : "reussie";
  const report: ExpeditionReport = {
    id: e.id,
    number: e.number,
    objective: e.plan.objective,
    target: e.plan.route[e.plan.route.length - 1] as string,
    formation: e.plan.formation,
    launched: e.launched,
    returned: { ...ctx.date },
    days: e.day,
    outcome,
    retreat: e.retreat,
    stats: structuredClone(e.stats),
    dead,
    signals: e.signals.slice(),
    log: e.log.slice(),
    lessons: lessonsOf(e, mortality),
    politics: { capital: e.capitalPaid, legitimacy: fx.legitimacy, corpsLoyalty: fx.corpsLoyalty },
  };
  ctx.mil.reports.push(report);
  if (ctx.mil.reports.length > REPORTS_LIMIT) ctx.mil.reports.splice(0, ctx.mil.reports.length - REPORTS_LIMIT);
  ctx.mil.expeditions = ctx.mil.expeditions.filter((y) => y.id !== e.id);
  pushLog(st, ctx.date, "log.expedition_returned", { n: e.number, outcome: `outcome.${outcome}`, dead: deadTotal, departed }, true);
}

/** Soldats blessés rétablis (F-CHR-10). */
export function recoverWounded(mil: MilitaryState, date: GameDate): void {
  const today = toAbsoluteDay(date);
  for (const s of Object.values(mil.soldiers)) {
    if (s.status === "blesse" && s.recovers !== null && s.recovers <= today) {
      s.status = "pret";
      s.recovers = null;
    }
  }
}
