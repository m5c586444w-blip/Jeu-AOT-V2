import { Explainer } from "../core/explain";
import type { Explained } from "../core/explain";
import type { GameDate } from "../core/time";
import { toAbsoluteDay } from "../core/time";
import type { StrategicState } from "../strategic/economy";
import type { NationsWorld, World } from "../strategic/world";

/**
 * Monde des nations (P7 ; 02 §11, §13–14 ; D-70) : économies de guerre agrégées, formations posées sur les provinces
 * du monde, relations, traités, guerres. Paradis y est résumé à partir de son état détaillé. Logique pure.
 */

export interface Relation {
  trust: number;
  interest: number;
  fear: number;
  ideology: number;
}

export interface NationState {
  industry: number;
  manpower: number;
  warSupport: number;
  stability: number;
  /** Pertes du mois (lassitude). */
  lossesMonth: number;
}

/** Formations d'un même type dans une province : nombre et état moyen (0–1). */
export interface Stack {
  count: number;
  strength: number;
  /** Mouvements restants cette semaine. */
  moves: number;
}

export interface BuildOrder {
  faction: string;
  formation: string;
  province: string;
  count: number;
  done: number;
}

export interface Treaty {
  kind: "alliance" | "non_agression" | "commerce" | "renseignement";
  a: string;
  b: string;
  since: number;
}

export interface Projection {
  shifter: string;
  faction: string;
  province: string;
  since: number;
  /** Repos forcé jusqu'à ce jour (usure). */
  restUntil: number | null;
}

export interface FrontReport {
  day: number;
  province: string;
  attacker: string;
  defender: string;
  attackPower: Explained;
  defensePower: Explained;
  attackerLoss: number;
  defenderLoss: number;
  captured: boolean;
}

export interface WorldLogEntry {
  day: number;
  key: string;
  params: Record<string, string | number>;
}

export interface AiDecision {
  day: number;
  faction: string;
  action: string;
  utility: number;
  reasons: { key: string; value: number }[];
}

export interface NationsState {
  player: string;
  nations: Record<string, NationState>;
  /** Contrôle des provinces de terre et de l'île Paradis (les zones maritimes n'ont pas de maître fixe). */
  control: Record<string, string>;
  forces: Record<string, Record<string, Stack>>;
  relations: Record<string, Record<string, Relation>>;
  /** Paires en guerre, « fac_a|fac_b » triées. */
  wars: string[];
  treaties: Treaty[];
  embargoes: string[];
  /** Neutralité crédible d'Hizuru (−100 Marley ↔ +100 Paradis) et son camp actuel. */
  hizuruLean: number;
  hizuruSide: "neutre" | "fac_paradis" | "fac_marley";
  orders: BuildOrder[];
  projections: Projection[];
  fronts: FrontReport[];
  log: WorldLogEntry[];
  ai: AiDecision[];
}

const LOG_CAP = 120;
const FRONT_CAP = 60;
const AI_CAP = 120;
const clamp = (v: number, lo = 0, hi = 100): number => Math.max(lo, Math.min(hi, v));

export function nationsWorld(world: World): NationsWorld {
  if (!world.nations) throw new Error("monde sans couche des nations (P7)");
  return world.nations;
}

export const warKey = (a: string, b: string): string => [a, b].sort().join("|");
export const atWar = (s: NationsState, a: string, b: string): boolean => s.wars.includes(warKey(a, b));
export const hasTreaty = (s: NationsState, kind: Treaty["kind"], a: string, b: string): boolean => s.treaties.some((t) => t.kind === kind && ((t.a === a && t.b === b) || (t.a === b && t.b === a)));

export function pushWorldLog(s: NationsState, day: number, key: string, params: Record<string, string | number>): void {
  s.log.push({ day, key, params });
  if (s.log.length > LOG_CAP) s.log.splice(0, s.log.length - LOG_CAP);
}

export function pushFront(s: NationsState, r: FrontReport): void {
  s.fronts.push(r);
  if (s.fronts.length > FRONT_CAP) s.fronts.splice(0, s.fronts.length - FRONT_CAP);
}

export function pushAi(s: NationsState, d: AiDecision): void {
  s.ai.push(d);
  if (s.ai.length > AI_CAP) s.ai.splice(0, s.ai.length - AI_CAP);
}

export function createNationsState(world: World, date: GameDate): NationsState | null {
  const nw = world.nations;
  const sw = world.scenario.world;
  if (!nw || !sw) return null;
  const nations: Record<string, NationState> = {};
  const relations: Record<string, Record<string, Relation>> = {};
  for (const f of nw.factions.values()) {
    nations[f.id] = { industry: f.industry_stock, manpower: f.manpower_stock, warSupport: f.war_support, stability: f.stability, lossesMonth: 0 };
    relations[f.id] = {};
    for (const [o, r] of Object.entries(f.relations)) (relations[f.id] as Record<string, Relation>)[o] = { ...r };
  }
  const control: Record<string, string> = {};
  for (const p of nw.order) if (p.faction !== "mer") control[p.id] = sw.control[p.id] ?? p.faction;
  const forces: Record<string, Record<string, Stack>> = {};
  for (const [p, list] of Object.entries(sw.formations)) {
    const at: Record<string, Stack> = {};
    for (const x of list) at[x.formation] = { count: (at[x.formation]?.count ?? 0) + x.count, strength: 1, moves: 0 };
    forces[p] = at;
  }
  const day = toAbsoluteDay(date);
  const lean = sw.hizuru_lean;
  const out: NationsState = {
    player: sw.playable[0] ?? "fac_paradis",
    nations,
    control,
    forces,
    relations,
    wars: sw.wars.map(([a, b]) => warKey(a, b)).sort(),
    treaties: sw.treaties.map((t) => ({ ...t, since: day })),
    embargoes: [],
    hizuruLean: lean,
    hizuruSide: Math.abs(lean) >= nw.balance.diplomacy.hizuru.threshold ? (lean > 0 ? "fac_paradis" : "fac_marley") : "neutre",
    orders: [],
    projections: [],
    fronts: [],
    log: [],
    ai: [],
  };
  weeklyMoves(world, out);
  return out;
}

/** Faction propriétaire d'une formation (donnée). */
export function ownerOf(world: World, formation: string): string | null {
  return world.nations?.formations.get(formation)?.faction ?? null;
}

/** Forces d'une faction dans une province : puissance totale (attaque ou défense), par domaine. */
export function forcesOf(world: World, s: NationsState, province: string, faction: string): { id: string; stack: Stack }[] {
  return Object.entries(s.forces[province] ?? {})
    .filter(([id, st]) => st.count > 0 && ownerOf(world, id) === faction)
    .map(([id, stack]) => ({ id, stack }));
}

/** Zone maritime bloquée pour une faction : une flotte d'une nation en guerre avec elle la tient (F-WAR-15). */
export function seaHeldBy(world: World, s: NationsState, sea: string): string | null {
  const nw = nationsWorld(world);
  const power = new Map<string, number>();
  for (const [id, st] of Object.entries(s.forces[sea] ?? {})) {
    const f = nw.formations.get(id);
    if (!f || f.domain !== "mer" || st.count <= 0) continue;
    power.set(f.faction, (power.get(f.faction) ?? 0) + st.count * st.strength * (f.attack + f.defense));
  }
  const ranked = [...power].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [first, second] = ranked;
  if (!first) return null;
  if (second && first[1] < second[1] * nw.balance.war.naval_control_ratio) return null;
  return first[0];
}

/** Une province côtière est sous blocus quand toutes ses mers voisines sont tenues par un ennemi. */
export function blockaded(world: World, s: NationsState, province: string, faction: string): boolean {
  const nw = nationsWorld(world);
  const seas = (nw.provinces.get(province)?.adjacent ?? []).filter((a) => nw.provinces.get(a)?.faction === "mer");
  if (seas.length === 0) return false;
  return seas.every((sea) => {
    const holder = seaHeldBy(world, s, sea);
    return holder !== null && holder !== faction && atWar(s, holder, faction);
  });
}

/** Revenu mensuel d'une nation, expliqué (industrie et hommes). Paradis : tiré de ses stocks détaillés. */
export function nationIncome(world: World, s: NationsState, faction: string, st: StrategicState | null): { industry: Explained; manpower: Explained } {
  const nw = nationsWorld(world);
  const eb = nw.balance.economy;
  const n = s.nations[faction];
  const ind = new Explainer();
  const man = new Explainer();
  if (!n) return { industry: ind.done(), manpower: man.done() };
  if (faction === "fac_paradis") {
    ind.base("why.world_paradis_steel", (st?.stocks["steel"] ?? 0) * eb.paradis_industry_per_steel);
    man.base("why.world_paradis_manpower", (st?.stocks["manpower"] ?? 0) * eb.paradis_manpower_share);
  } else {
    let i = 0;
    let m = 0;
    let blocked = 0;
    for (const p of nw.order) {
      if (s.control[p.id] !== faction) continue;
      const b = p.coastal && blockaded(world, s, p.id, faction);
      i += p.industry * (b ? eb.blockade_industry_mult : 1);
      if (b) blocked += p.industry * (1 - eb.blockade_industry_mult);
      m += p.manpower;
    }
    ind.base("why.world_provinces_industry", i + blocked);
    if (blocked > 0) ind.add("why.world_blockade", -blocked);
    man.base("why.world_provinces_manpower", m);
  }
  const stab = eb.stability_floor + (1 - eb.stability_floor) * (n.stability / 100);
  ind.mul("why.world_stability", stab, { v: Math.round(n.stability) });
  man.mul("why.world_war_support", 0.5 + n.warSupport / 100, { v: Math.round(n.warSupport) });
  if (s.embargoes.some((e) => e.endsWith(`>${faction}`))) ind.mul("why.world_embargo", nw.balance.diplomacy.embargo_industry_mult);
  // Commerce : un traité de commerce rapporte un peu à chaque partie.
  const trade = s.treaties.filter((t) => t.kind === "commerce" && (t.a === faction || t.b === faction)).length;
  if (trade > 0) ind.add("why.world_trade", trade * nw.balance.diplomacy.hizuru.trade_per_month, { n: trade });
  return { industry: ind.done(), manpower: man.done() };
}

/** Entretien mensuel des formations d'une nation, expliqué. */
export function nationUpkeep(world: World, s: NationsState, faction: string): Explained {
  const nw = nationsWorld(world);
  let total = 0;
  let count = 0;
  for (const at of Object.values(s.forces)) {
    for (const [id, st] of Object.entries(at)) {
      const f = nw.formations.get(id);
      if (!f || f.faction !== faction) continue;
      total += st.count * f.upkeep;
      count += st.count;
    }
  }
  return new Explainer().base("why.world_upkeep", total, { n: count }).mul("why.world_upkeep_mult", nw.balance.economy.upkeep_mult).done();
}

/** Mois d'une nation : revenus, entretien (pénurie → usure des formations), soutien à la guerre, stabilité. */
export function monthlyNations(world: World, s: NationsState, st: StrategicState | null, date: GameDate): void {
  const nw = nationsWorld(world);
  const eb = nw.balance.economy;
  const day = toAbsoluteDay(date);
  for (const f of nw.factions.values()) {
    const n = s.nations[f.id];
    if (!n) continue;
    const inc = nationIncome(world, s, f.id, st);
    const up = nationUpkeep(world, s, f.id).value;
    n.industry += inc.industry.value - up;
    n.manpower += inc.manpower.value;
    if (n.industry < 0) {
      // Pénurie : les formations s'usent faute d'entretien.
      for (const at of Object.values(s.forces)) for (const [id, stk] of Object.entries(at)) if (nw.formations.get(id)?.faction === f.id) stk.strength = Math.max(0.2, stk.strength - 0.1);
      pushWorldLog(s, day, "world.log.shortage", { faction: f.name_key });
      n.industry = 0;
    }
    const atWarNow = s.wars.some((w) => w.split("|").includes(f.id));
    const target = atWarNow ? f.war_support - 5 : f.war_support;
    n.warSupport = clamp(n.warSupport + Math.sign(target - n.warSupport) * Math.min(eb.war_support_drift, Math.abs(target - n.warSupport)) - n.lossesMonth * eb.war_weariness_per_loss);
    n.stability = clamp(n.stability + (n.warSupport < 30 ? -eb.stability_low_support : Math.sign(f.stability - n.stability) * Math.min(eb.stability_drift, Math.abs(f.stability - n.stability))));
    n.lossesMonth = 0;
  }
}

/** Raison pour laquelle une levée est impossible, ou null. */
export function buildProblem(world: World, s: NationsState, faction: string, formation: string, province: string, count: number): string | null {
  const nw = nationsWorld(world);
  const f = nw.formations.get(formation);
  if (!f) return "world.err.unknown_formation";
  if (f.faction !== faction) return "world.err.not_ours";
  if (!f.enabled) return "world.err.disabled";
  if (!Number.isInteger(count) || count < 1 || count > 20) return "world.err.count";
  const p = nw.provinces.get(province);
  if (!p || s.control[province] !== faction) return "world.err.not_controlled";
  if (f.domain === "mer" && !p.coastal) return "world.err.not_port";
  const n = s.nations[faction];
  if (!n || n.industry < f.cost.industry * count || n.manpower < f.cost.manpower * count) return "world.err.cost";
  return null;
}

export function orderBuild(world: World, s: NationsState, faction: string, formation: string, province: string, count: number, date: GameDate): void {
  const f = nationsWorld(world).formations.get(formation);
  const n = s.nations[faction];
  if (!f || !n) return;
  n.industry -= f.cost.industry * count;
  n.manpower -= f.cost.manpower * count;
  s.orders.push({ faction, formation, province, count, done: toAbsoluteDay(date) + f.build_days });
}

/** Levées achevées du jour : la formation rejoint sa province (si elle est toujours tenue). */
export function dailyBuilds(world: World, s: NationsState, date: GameDate): void {
  const day = toAbsoluteDay(date);
  const ready = s.orders.filter((o) => o.done <= day);
  if (ready.length === 0) return;
  s.orders = s.orders.filter((o) => o.done > day);
  for (const o of ready) {
    if (s.control[o.province] !== o.faction) continue;
    const at = (s.forces[o.province] ??= {});
    const cur = at[o.formation];
    at[o.formation] = cur ? { count: cur.count + o.count, strength: (cur.strength * cur.count + o.count) / (cur.count + o.count), moves: cur.moves } : { count: o.count, strength: 1, moves: 0 };
    pushWorldLog(s, day, "world.log.built", { formation: nationsWorld(world).formations.get(o.formation)?.name_key ?? o.formation, province: nationsWorld(world).provinces.get(o.province)?.name_key ?? o.province });
  }
}

/** Raison pour laquelle un mouvement est impossible, ou null. Terre : par la terre ; flotte : par mer et ports ; air : partout. */
export function moveProblem(world: World, s: NationsState, faction: string, formation: string, from: string, to: string, count: number): string | null {
  const nw = nationsWorld(world);
  const f = nw.formations.get(formation);
  if (!f) return "world.err.unknown_formation";
  if (f.faction !== faction) return "world.err.not_ours";
  const stack = s.forces[from]?.[formation];
  if (!stack || stack.count < count || count < 1 || !Number.isInteger(count)) return "world.err.count";
  if (stack.moves <= 0) return "world.err.no_moves";
  const a = nw.provinces.get(from);
  const b = nw.provinces.get(to);
  if (!a || !b || !a.adjacent.includes(to)) return "world.err.not_adjacent";
  const toSea = b.faction === "mer";
  if (f.domain === "mer" && !toSea && !(b.coastal && s.control[to] === faction)) return "world.err.navy_port";
  if (f.domain === "terre" && toSea) {
    // Embarquer : il faut des transports dans la même province (F-WAR-11).
    const transports = Object.entries(s.forces[from] ?? {}).some(([id, x]) => nw.formations.get(id)?.kind === "transports" && nw.formations.get(id)?.faction === faction && x.count > 0);
    if (!transports) return "world.err.no_transport";
  }
  if (f.domain === "terre" && !toSea && a.faction === "mer") {
    // Débarquement : la mer doit être tenue (F-WAR-11).
    const holder = seaHeldBy(world, s, from);
    if (holder !== null && holder !== faction) return "world.err.sea_not_held";
  }
  const owner = s.control[to];
  if (!toSea && owner && owner !== faction && !atWar(s, owner, faction) && !hasTreaty(s, "alliance", owner, faction)) return "world.err.not_at_war";
  return null;
}

export function moveForces(world: World, s: NationsState, formation: string, from: string, to: string, count: number): void {
  const src = s.forces[from]?.[formation];
  if (!src) return;
  const at = (s.forces[to] ??= {});
  const cur = at[formation];
  at[formation] = cur ? { count: cur.count + count, strength: (cur.strength * cur.count + src.strength * count) / (cur.count + count), moves: Math.min(cur.moves, src.moves - 1) } : { count, strength: src.strength, moves: src.moves - 1 };
  src.count -= count;
  if (src.count <= 0) s.forces[from] = Object.fromEntries(Object.entries(s.forces[from] ?? {}).filter(([id]) => id !== formation));
  void world;
}

/** Début de semaine : chaque formation retrouve ses mouvements (vitesse ; le rail double celle des troupes de terre). */
export function weeklyMoves(world: World, s: NationsState): void {
  const nw = nationsWorld(world);
  for (const [p, at] of Object.entries(s.forces)) {
    const rail = nw.provinces.get(p)?.rail ?? false;
    for (const [id, st] of Object.entries(at)) {
      const f = nw.formations.get(id);
      if (!f) continue;
      st.moves = Math.round(f.speed * (rail && f.domain === "terre" ? nw.balance.war.rail_speed_mult : 1));
    }
  }
}

/** Côté du joueur au monde. */
export function playerFaction(s: NationsState | null): string {
  return s?.player ?? "fac_paradis";
}
