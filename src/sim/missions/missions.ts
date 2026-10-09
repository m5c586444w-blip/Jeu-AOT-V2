import type { Mission, MissionCondition, MissionNation } from "../../data/missionSchemas";
import { MISSION_NATIONS, NATION_FACTION } from "../../data/missionSchemas";
import type { ArmiesState } from "../armies/state";
import type { GameDate } from "../core/time";
import { DAYS_PER_MONTH, toAbsoluteDay } from "../core/time";
import { applyEffect, conditionHolds, triggerEvent } from "../events/engine";
import type { EventCtx, EventsState } from "../events/engine";
import type { IntelState } from "../intel/intel";
import type { MilitaryState } from "../military/state";
import type { PoliticalState } from "../politics/state";
import type { ResearchState, TechMods } from "../research/research";
import { techMods } from "../research/research";
import type { ShiftersState } from "../shifters/shifters";
import { pushLog, totals } from "../strategic/economy";
import type { EconomyMods, ModEntry, StrategicState } from "../strategic/economy";
import { RESOURCE_IDS } from "../strategic/resources";
import type { ResourceId } from "../strategic/resources";
import type { MissionsWorld, World } from "../strategic/world";
import type { NationsState } from "../world/nations";
import { atWar, pushWorldLog } from "../world/nations";

/**
 * Missions nationales (MIS) : une mission coûte, dure, puis donne des effets ponctuels (moteur d'événements), des modificateurs
 * durables (économie, expéditions) et peut déclencher des événements non canon. État facultatif de la partie : absent d'une
 * partie où personne n'a rien lancé (le hash ne change pas). Logique pure, déterministe (aucun tirage).
 */

export interface MissionRun {
  id: string;
  /** Jours absolus. */
  start: number;
  end: number;
  paid: Partial<Record<ResourceId, number>>;
}

export interface MissionSide {
  current: MissionRun[];
  done: string[];
  /** Jour absolu de l'accomplissement. */
  doneDay: Record<string, number>;
}

export interface MissionLogEntry {
  day: number;
  key: string;
  params: Record<string, string | number>;
}

export interface MissionAiDecision {
  day: number;
  nation: string;
  mission: string;
  utility: number;
  reasons: { key: string; value: number }[];
}

export interface MissionsState {
  sides: Record<string, MissionSide>;
  log: MissionLogEntry[];
  ai: MissionAiDecision[];
}

const AI_CAP = 60;

export function emptyMissions(): MissionsState {
  return { sides: {}, log: [], ai: [] };
}

export const emptySide = (): MissionSide => ({ current: [], done: [], doneDay: {} });

export function sideOf(ms: MissionsState | undefined | null, nation: string): MissionSide {
  return ms?.sides[nation] ?? emptySide();
}

/** Nation de missions de la partie jouée : Marley si la nation jouée est Marley, sinon Paradis. */
export function playerNation(ns: NationsState | null): MissionNation {
  return ns?.player === NATION_FACTION.marley ? "marley" : "paradis";
}

export function missionsWorld(world: World): MissionsWorld {
  if (!world.missions) throw new Error("Ce scénario n'a pas de missions.");
  return world.missions;
}

/** Ce que la simulation lit pour juger une mission (copie en lecture ou de travail). */
export interface MissionView {
  date: GameDate;
  st: StrategicState;
  pol: PoliticalState | null;
  rs: ResearchState | null;
  intel: IntelState | null;
  ev: EventsState | null;
  ns: NationsState | null;
  armies: ArmiesState | undefined;
  ms: MissionsState | undefined | null;
}

/** Raison pour laquelle une mission n'est pas lançable (clé i18n, paramètres, condition en cause). */
export type MissionLock =
  | { key: "mission.lock.done" }
  | { key: "mission.lock.running" }
  | { key: "mission.lock.nation" }
  | { key: "mission.lock.year"; year: number }
  | { key: "mission.lock.prereq"; mission: string }
  | { key: "mission.lock.any_of"; missions: string[] }
  | { key: "mission.lock.exclusive"; mission: string }
  | { key: "mission.lock.condition"; condition: MissionCondition }
  | { key: "mission.lock.slots" }
  | { key: "mission.lock.cost"; resource: ResourceId };

const SCRATCH = (): EventsState => ({ history: {}, scheduled: [], pending: [], divergence: 0, branch: "canon", flags: {}, chronicle: [], genericLast: {}, lastGeneric: -999 });

function conditionMet(world: World, v: MissionView, nation: MissionNation, c: MissionCondition): boolean {
  if ("stock_at_least" in c) return (nation === "marley" ? 0 : (v.st.stocks[c.stock_at_least] ?? 0)) >= c.value;
  if ("garrison_at_least" in c) return (v.st.provinces[c.garrison_at_least]?.garrison?.soldiers ?? 0) >= c.value;
  if ("soldiers_at_least" in c) return totals(v.st).soldiers >= c.soldiers_at_least;
  if ("year_at_least" in c) return v.date.year >= c.year_at_least;
  if ("law" in c) return v.pol?.laws.some((l) => l.id === c.law) ?? false;
  if ("armies_at_least" in c) return (v.armies?.armies.filter((a) => a.faction === NATION_FACTION[nation]).length ?? 0) >= c.armies_at_least;
  if ("army_in" in c) return v.armies?.armies.some((a) => a.faction === NATION_FACTION[nation] && a.province === c.army_in) ?? false;
  if ("at_war" in c) return (v.ns ? atWar(v.ns, NATION_FACTION[nation], c.at_war) : false) === c.eq;
  return conditionHolds({ world, date: v.date, st: v.st, pol: v.pol, ev: v.ev ?? SCRATCH(), intel: v.intel, rs: v.rs }, c);
}

/** Réserves de la nation pour payer : stocks de Paradis, industrie et hommes de Marley. */
function stockOf(v: MissionView, nation: MissionNation, r: ResourceId): number {
  if (nation === "paradis") return v.st.stocks[r] ?? 0;
  const n = v.ns?.nations[NATION_FACTION.marley];
  return r === "gold" ? (n?.industry ?? 0) : r === "manpower" ? (n?.manpower ?? 0) : 0;
}

/** Verrou d'une mission pour sa nation (null = lançable maintenant). L'ordre des vérifications est celui de l'affichage. */
export function missionLock(world: World, v: MissionView, m: Mission): MissionLock | null {
  const side = sideOf(v.ms, m.nation);
  if (side.done.includes(m.id)) return { key: "mission.lock.done" };
  if (side.current.some((r) => r.id === m.id)) return { key: "mission.lock.running" };
  if (v.date.year < m.min_year) return { key: "mission.lock.year", year: m.min_year };
  const missing = m.prereqs.find((p) => !side.done.includes(p));
  if (missing) return { key: "mission.lock.prereq", mission: missing };
  if (m.any_of.length > 0 && !m.any_of.some((p) => side.done.includes(p))) return { key: "mission.lock.any_of", missions: m.any_of };
  const excl = m.exclusive_with.find((x) => side.done.includes(x) || side.current.some((r) => r.id === x));
  if (excl) return { key: "mission.lock.exclusive", mission: excl };
  const cond = m.requires.find((c) => !conditionMet(world, v, m.nation, c));
  if (cond) return { key: "mission.lock.condition", condition: cond };
  return null;
}

/** Raison d'un lancement impossible maintenant : verrou, places, coût. */
export function startLock(world: World, v: MissionView, m: Mission): MissionLock | null {
  const lock = missionLock(world, v, m);
  if (lock) return lock;
  const side = sideOf(v.ms, m.nation);
  if (side.current.length >= missionsWorld(world).balance.slots[m.nation]) return { key: "mission.lock.slots" };
  for (const r of RESOURCE_IDS) {
    const cost = m.cost[r] ?? 0;
    if (cost > 0 && stockOf(v, m.nation, r) < cost) return { key: "mission.lock.cost", resource: r };
  }
  return null;
}

/** Contexte de travail : copies des couches qu'une mission peut modifier. */
export interface MissionCtx {
  world: World;
  date: GameDate;
  st: StrategicState;
  pol: PoliticalState | null;
  rs: ResearchState | null;
  intel: IntelState | null;
  ev: EventsState | null;
  mil: MilitaryState | null;
  sh: ShiftersState | null;
  ns: NationsState | null;
  armies: ArmiesState | undefined;
  ms: MissionsState;
  seed: number;
  /** Nation jouée (alertes et pauses) ; les autres sont menées par l'IA. */
  player: MissionNation;
}

const viewOf = (c: MissionCtx): MissionView => ({ date: c.date, st: c.st, pol: c.pol, rs: c.rs, intel: c.intel, ev: c.ev, ns: c.ns, armies: c.armies, ms: c.ms });

function logMission(c: MissionCtx, key: string, params: Record<string, string | number>): void {
  c.ms.log.push({ day: toAbsoluteDay(c.date), key, params });
  const cap = missionsWorld(c.world).balance.log_cap;
  if (c.ms.log.length > cap) c.ms.log.splice(0, c.ms.log.length - cap);
}

const nameKey = (id: string): string => `mission.${id}`;

/** Lance une mission (coût payé d'avance). Lève une erreur (clé i18n) si elle n'est pas lançable. */
export function startMission(c: MissionCtx, id: string): void {
  const m = missionsWorld(c.world).byId.get(id);
  if (!m) throw new Error("mission.err.unknown");
  if (m.nation !== c.player) throw new Error("mission.lock.nation");
  launch(c, m);
}

function launch(c: MissionCtx, m: Mission): void {
  const lock = startLock(c.world, viewOf(c), m);
  if (lock) throw new Error(lock.key);
  const paid: Partial<Record<ResourceId, number>> = {};
  for (const r of RESOURCE_IDS) {
    const cost = m.cost[r] ?? 0;
    if (cost <= 0) continue;
    paid[r] = cost;
    if (m.nation === "paradis") c.st.stocks[r] = Math.max(0, (c.st.stocks[r] ?? 0) - cost);
    else {
      const n = c.ns?.nations[NATION_FACTION.marley];
      if (n && r === "gold") n.industry -= cost;
      if (n && r === "manpower") n.manpower -= cost;
    }
  }
  const day = toAbsoluteDay(c.date);
  const side = (c.ms.sides[m.nation] ??= emptySide());
  side.current.push({ id: m.id, start: day, end: day + m.duration_days, paid });
  logMission(c, "mission.log.started", { mission: nameKey(m.id), days: m.duration_days });
  note(c, m, "mission.log.started", { mission: nameKey(m.id) }, false);
}

/** Annule une mission en cours : la part `refund_share` du coût est rendue, le reste est perdu. */
export function cancelMission(c: MissionCtx, id: string): void {
  const m = missionsWorld(c.world).byId.get(id);
  if (!m) throw new Error("mission.err.unknown");
  if (m.nation !== c.player) throw new Error("mission.lock.nation");
  const side = c.ms.sides[m.nation];
  const run = side?.current.find((r) => r.id === id);
  if (!side || !run) throw new Error("mission.err.not_running");
  const share = missionsWorld(c.world).balance.refund_share;
  for (const r of RESOURCE_IDS) {
    const back = Math.floor((run.paid[r] ?? 0) * share);
    if (back <= 0) continue;
    if (m.nation === "paradis") c.st.stocks[r] = (c.st.stocks[r] ?? 0) + back;
    else {
      const n = c.ns?.nations[NATION_FACTION.marley];
      if (n && r === "gold") n.industry += back;
      if (n && r === "manpower") n.manpower += back;
    }
  }
  side.current = side.current.filter((r) => r !== run);
  logMission(c, "mission.log.cancelled", { mission: nameKey(id) });
  note(c, m, "mission.log.cancelled", { mission: nameKey(id) }, false);
}

/** Journal de la partie pour la nation jouée : journal de Paradis (alertes, pause), journal du monde pour Marley. */
function note(c: MissionCtx, m: Mission, key: string, params: Record<string, string | number>, pause: boolean): void {
  if (m.nation !== c.player) return;
  pushLog(c.st, c.date, key === "mission.log.done" ? "alert.mission_done" : key, params, pause);
  if (c.ns && m.nation === "marley") pushWorldLog(c.ns, toAbsoluteDay(c.date), key, params);
}

function eventCtx(c: MissionCtx): EventCtx {
  return { world: c.world, seed: c.seed, date: c.date, st: c.st, pol: c.pol, mil: c.mil, rs: c.rs, intel: c.intel, ev: c.ev ?? SCRATCH(), sh: c.sh, na: c.ns };
}

/** Accomplissement : effets par le moteur d'événements, événements non canon déclenchés, drapeau pour les conditions d'événements. */
function complete(c: MissionCtx, run: MissionRun, m: Mission): void {
  const ec = eventCtx(c);
  for (const f of m.effects) applyEffect(ec, f, {}, nameKey(m.id));
  // Les couches sont modifiées en place par `applyEffect` ; l'éventuelle copie de travail de l'état d'événements est reprise.
  c.st = ec.st;
  c.pol = ec.pol;
  c.rs = ec.rs;
  c.intel = ec.intel;
  if (c.ev) {
    ec.ev.flags[`mission_${m.id.slice(4)}`] = true;
    for (const e of m.events) triggerEvent(ec, e);
    c.ev = ec.ev;
    c.st = ec.st;
    c.pol = ec.pol;
  }
  const side = (c.ms.sides[m.nation] ??= emptySide());
  side.current = side.current.filter((r) => r !== run);
  side.done.push(m.id);
  side.doneDay[m.id] = toAbsoluteDay(c.date);
  logMission(c, "mission.log.done", { mission: nameKey(m.id) });
  note(c, m, "mission.log.done", { mission: nameKey(m.id) }, true);
}

// ——— IA (MIS.6) ———

/** Utilité d'une mission pour une nation menée par l'ordinateur, avec ses raisons (consignées). */
export function aiUtility(world: World, v: MissionView, m: Mission): { utility: number; reasons: { key: string; value: number }[] } {
  const w = missionsWorld(world).balance.ai.weights;
  const n = v.ns?.nations[NATION_FACTION[m.nation]];
  const reasons: { key: string; value: number }[] = [{ key: "mission.ai.base", value: w.base * m.ai_weight }];
  const fac = NATION_FACTION[m.nation];
  const warring = v.ns ? v.ns.wars.some((x) => x.split("|").includes(fac)) : false;
  if (warring && m.branch === "militaire") reasons.push({ key: "mission.ai.at_war", value: w.at_war });
  if (n && m.branch === "economique") reasons.push({ key: "mission.ai.industry_low", value: w.branch_need * Math.max(0, (300 - n.industry) / 300) });
  if (n && m.branch === "politique") reasons.push({ key: "mission.ai.stability_low", value: w.branch_need * Math.max(0, (60 - n.stability) / 60) });
  if (n && m.branch === "monde") reasons.push({ key: "mission.ai.isolated", value: warring ? 0 : w.branch_need * 0.5 });
  const cost = (m.cost.gold ?? 0) + (m.cost.manpower ?? 0);
  if (n) reasons.push({ key: "mission.ai.cheap", value: w.cheap * Math.max(0, 1 - cost / Math.max(1, n.industry + n.manpower)) });
  const utility = reasons.reduce((a, r) => a + r.value, 0);
  return { utility: Math.round(utility * 1000) / 1000, reasons: reasons.map((r) => ({ key: r.key, value: Math.round(r.value * 1000) / 1000 })) };
}

/**
 * Nations dont l'ordinateur choisit les missions : Marley en 854 quand elle n'est pas jouée. Paradis n'a pas d'IA de missions
 * (hors-périmètre de MIS : quand Marley est jouée, Paradis ne lance rien d'elle-même).
 */
function aiNations(world: World, ns: NationsState | null, player: MissionNation): MissionNation[] {
  if (!ns || !world.missions) return [];
  return MISSION_NATIONS.filter((n) => n === "marley" && n !== player && ns.nations[NATION_FACTION[n]] !== undefined && world.missions?.order.some((m) => m.nation === n));
}

function reviewDue(world: World, date: GameDate): boolean {
  const b = missionsWorld(world).balance.ai;
  const since = toAbsoluteDay(date) - toAbsoluteDay(world.scenario.start);
  return since >= b.first_after_days && since % b.review_every_days === 0;
}

/** Revue de l'IA : tant qu'une place est libre, lance la mission lançable d'utilité maximale (égalité : identifiant). */
function aiReview(c: MissionCtx, nation: MissionNation): void {
  const mw = missionsWorld(c.world);
  const b = mw.balance;
  for (let guard = 0; guard < b.slots[nation]; guard++) {
    const v = viewOf(c);
    if (sideOf(c.ms, nation).current.length >= b.slots[nation]) return;
    const n = c.ns?.nations[NATION_FACTION[nation]];
    if (!n) return;
    let best: { m: Mission; utility: number; reasons: { key: string; value: number }[] } | null = null;
    for (const m of mw.order) {
      if (m.nation !== nation || startLock(c.world, v, m)) continue;
      // L'IA garde une part de ses réserves.
      if ((m.cost.gold ?? 0) > n.industry * (1 - b.ai.reserve_share) || (m.cost.manpower ?? 0) > n.manpower * (1 - b.ai.reserve_share)) continue;
      const u = aiUtility(c.world, v, m);
      if (!best || u.utility > best.utility || (u.utility === best.utility && m.id < best.m.id)) best = { m, ...u };
    }
    if (!best) return;
    launch(c, best.m);
    c.ms.ai.push({ day: toAbsoluteDay(c.date), nation, mission: best.m.id, utility: best.utility, reasons: best.reasons });
    if (c.ms.ai.length > AI_CAP) c.ms.ai.splice(0, c.ms.ai.length - AI_CAP);
  }
}

// ——— Jour ———

/** Couches lues et modifiées par les missions (références de l'état courant ; `tickMissions` copie avant d'écrire). */
export interface MissionParts {
  st: StrategicState;
  pol: PoliticalState | null;
  rs: ResearchState | null;
  intel: IntelState | null;
  ev: EventsState | null;
  mil: MilitaryState | null;
  sh: ShiftersState | null;
  ns: NationsState | null;
  armies: ArmiesState | undefined;
  ms: MissionsState | undefined;
}

export function ctxOf(world: World, seed: number, date: GameDate, p: MissionParts): MissionCtx {
  return {
    world,
    seed,
    date,
    st: structuredClone(p.st),
    pol: p.pol ? structuredClone(p.pol) : null,
    rs: p.rs ? structuredClone(p.rs) : null,
    intel: p.intel ? structuredClone(p.intel) : null,
    ev: p.ev ? structuredClone(p.ev) : null,
    mil: p.mil,
    sh: p.sh ? structuredClone(p.sh) : null,
    ns: p.ns ? structuredClone(p.ns) : null,
    armies: p.armies,
    ms: p.ms ? structuredClone(p.ms) : emptyMissions(),
    player: playerNation(p.ns),
  };
}

/** Un jour : accomplit les missions arrivées à terme, puis revue de l'IA. Sans rien à faire, rend `null` (aucune copie). */
export function tickMissions(world: World, seed: number, date: GameDate, p: MissionParts): MissionCtx | null {
  if (!world.missions) return null;
  const day = toAbsoluteDay(date);
  const due = Object.values(p.ms?.sides ?? {}).some((s) => s.current.some((r) => r.end <= day));
  const player = playerNation(p.ns);
  const ai = aiNations(world, p.ns, player);
  const review = ai.length > 0 && reviewDue(world, date);
  if (!due && !review) return null;
  const c = ctxOf(world, seed, date, p);
  if (due) {
    const finished = Object.values(c.ms.sides)
      .flatMap((s) => s.current.filter((r) => r.end <= day))
      .sort((a, b) => a.end - b.end || a.id.localeCompare(b.id));
    for (const run of finished) {
      const m = missionsWorld(world).byId.get(run.id);
      if (m) complete(c, run, m);
      else for (const s of Object.values(c.ms.sides)) s.current = s.current.filter((r) => r !== run);
    }
  }
  if (review) for (const n of ai) aiReview(c, n);
  // Une revue sans décision ne crée pas l'état (le hash d'une partie où rien n'a été lancé ne change pas).
  if (!p.ms && c.ms.log.length === 0 && c.ms.ai.length === 0) return null;
  return c;
}

// ——— Modificateurs durables ———

/** Missions accomplies de Paradis qui portent un modificateur ou un crochet. */
function doneMissions(world: World, ms: MissionsState | undefined | null, nation: MissionNation): Mission[] {
  const mw = world.missions;
  if (!mw || !ms) return [];
  return sideOf(ms, nation).done.map((id) => mw.byId.get(id)).filter((m): m is Mission => m !== undefined);
}

/** Modificateurs économiques des missions de Paradis accomplies, ajoutés à ceux des décrets (« pourquoi ? » : « Mission : … »). */
export function withMissionMods(world: World, ms: MissionsState | undefined | null, base: EconomyMods): EconomyMods {
  const list = doneMissions(world, ms, "paradis").filter((m) => m.modifiers.length > 0);
  if (list.length === 0) return base;
  const byTarget: Record<string, ModEntry[]> = {};
  for (const [k, v] of Object.entries(base.byTarget)) byTarget[k] = [...v];
  for (const m of list) for (const x of m.modifiers) (byTarget[x.target] ??= []).push({ key: "why.mission", value: x.value, params: { mission: nameKey(m.id) } });
  return { byTarget, provinceMorale: base.provinceMorale };
}

/** Effets des technologies, multipliés par les crochets des missions accomplies (expéditions, logistique). */
export function techModsWithMissions(world: World, rs: ResearchState | null, ms: MissionsState | undefined | null): TechMods {
  const base = techMods(world, rs);
  const list = doneMissions(world, ms, "paradis").filter((m) => m.hooks.length > 0);
  if (list.length === 0) return base;
  const out = { ...base };
  const field = { exp_gas_odm_mult: "gasOdm", exp_night_loss_mult: "nightLoss", exp_wound_death_mult: "woundDeath", exp_loss_mult: "loss", log_attrition_mult: "attrition", log_interception_mult: "interception" } as const;
  for (const m of list) for (const h of m.hooks) out[field[h.hook]] *= h.value;
  return out;
}

/** Mois restants avant l'accomplissement d'une mission en cours (affichage). */
export function monthsLeft(run: MissionRun, date: GameDate): number {
  return Math.max(0, Math.ceil((run.end - toAbsoluteDay(date)) / DAYS_PER_MONTH));
}

/** Avancement d'une mission en cours, de 0 à 1. */
export function progressOf(run: MissionRun, date: GameDate): number {
  const total = Math.max(1, run.end - run.start);
  return Math.max(0, Math.min(1, (toAbsoluteDay(date) - run.start) / total));
}
