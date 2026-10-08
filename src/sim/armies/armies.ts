import { Explainer } from "../core/explain";
import type { Explained } from "../core/explain";
import { fnv1a } from "../core/hash";
import { Rng } from "../core/rng";
import type { GameDate } from "../core/time";
import { DAYS_PER_MONTH, toAbsoluteDay } from "../core/time";
import type { EventsState } from "../events/engine";
import { edgeKm, shortestRoute, titanDensity } from "../military/routes";
import { characterDies } from "../politics/characters";
import { effectiveAttributes } from "../politics/state";
import type { PoliticalState } from "../politics/state";
import type { ResearchState } from "../research/research";
import type { StrategicState } from "../strategic/economy";
import { pushLog } from "../strategic/economy";
import type { ArmiesWorld, GeoGraph, World } from "../strategic/world";
import { runBattle } from "../tactical/battle";
import { skirmishSetup } from "../tactical/setup";
import type { BatterySpec, BattleSetup, TimedOrder } from "../tactical/types";
import type { NationsState } from "../world/nations";
import { armyBaseSpeed, armyMen, armyPieces, ENCOUNTER_CAP, hostile, isStatic, playerOf, pushArmyLog, regimentOf, requiresMet } from "./state";
import type { ArmiesState, ArmyState, Encounter, EncounterKind, EncounterResult, EncounterSide, FleetMission, FleetState } from "./state";

/** Contexte d'un jour ou d'un ordre : copies de travail des couches touchées. */
export interface ArmyCtx {
  world: World;
  aw: ArmiesWorld;
  seed: number;
  date: GameDate;
  s: ArmiesState;
  st: StrategicState;
  pol: PoliticalState | null;
  ns: NationsState | null;
  research: ResearchState | null;
  events: EventsState | null;
}

export type ArmyOrder =
  | { type: "ArmyMove"; army: string; to: string }
  | { type: "ArmyHalt"; army: string }
  | { type: "ArmyForcedMarch"; army: string; on: boolean }
  | { type: "ArmyIntercept"; army: string; target: string }
  | { type: "ArmyRetreat"; army: string }
  | { type: "ArmyMerge"; army: string; into: string }
  | { type: "ArmySplit"; army: string; regiments: { regiment: string; count: number }[]; general: string | null }
  | { type: "ArmySetGeneral"; army: string; general: string | null }
  | { type: "ArmyGarrison"; army: string; mode: "deposer" | "prelever"; soldiers: number }
  | { type: "FleetMove"; fleet: string; to: string }
  | { type: "FleetMission"; fleet: string; mission: FleetMission }
  | { type: "FleetEmbark"; fleet: string; army: string }
  | { type: "FleetLand"; fleet: string; army: string; province: string };

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const dayOf = (ctx: ArmyCtx): number => toAbsoluteDay(ctx.date);

export function geoOf(world: World): GeoGraph {
  if (!world.military) throw new Error("monde sans graphe de routage");
  return world.military.geo;
}

const isWallProvince = (g: GeoGraph, p: string): boolean => (g.nodes.get(p)?.zone ?? "").startsWith("mur_");
const terrainOf = (world: World, p: string): string => world.provinceById.get(p)?.terrain ?? "plaine";

/** Province tenue par une faction : Paradis tient ses provinces non occupées ; une autre faction, celles qu'elle occupe. */
export function holds(ctx: Pick<ArmyCtx, "st" | "s">, faction: string, p: string): boolean {
  const occ = ctx.s.occupied[p];
  if (faction === "fac_paradis") return ctx.st.provinces[p]?.control === "paradis" && occ === undefined;
  return occ === faction;
}

/** Technologie acquise : Paradis par sa recherche ; les nations, dès que la date et l'événement le permettent. */
export function techKnown(ctx: Pick<ArmyCtx, "world" | "research" | "events" | "date">, faction: string, id: string): boolean {
  if (faction === "fac_paradis") return ctx.research?.done.includes(id) ?? false;
  const t = ctx.world.research?.techs.get(id);
  if (!t) return true;
  if (t.min_year > ctx.date.year) return false;
  const evs = t.unlock_event === undefined ? [] : Array.isArray(t.unlock_event) ? t.unlock_event : [t.unlock_event];
  return evs.length === 0 || evs.some((e) => eventDone(ctx, e));
}

export function eventDone(ctx: Pick<ArmyCtx, "events">, id: string): boolean {
  const r = ctx.events?.history[id];
  return r?.status === "survenu" || r?.status === "passe";
}

/** Un régiment peut-il servir à cette date (aucune arme anachronique, 11 §8) ? */
export function regimentAvailable(ctx: Pick<ArmyCtx, "world" | "aw" | "research" | "events" | "date">, faction: string, id: string): boolean {
  const r = ctx.aw.regiments.get(id);
  if (!r || !r.enabled || r.faction !== faction) return false;
  const piece = r.pieces ? ctx.aw.pieces.get(r.pieces.piece) : undefined;
  if (r.pieces && (!piece || !piece.enabled)) return false;
  return requiresMet(r.requires, ctx.date, (t) => techKnown(ctx, faction, t), (e) => eventDone(ctx, e));
}

// ——— Ordres ———

export function findArmy(s: ArmiesState, id: string): ArmyState | undefined {
  return s.armies.find((a) => a.id === id);
}

function generalBusy(s: ArmiesState, who: string): boolean {
  return s.armies.some((a) => a.general === who);
}

/** Raison pour laquelle un ordre est refusé (clé i18n), ou null. `faction` : camp qui donne l'ordre. */
export function orderProblem(ctx: ArmyCtx, faction: string, o: ArmyOrder): string | null {
  const g = geoOf(ctx.world);
  if (o.type === "FleetMove" || o.type === "FleetMission" || o.type === "FleetEmbark" || o.type === "FleetLand") {
    const f = ctx.s.fleets.find((x) => x.id === o.fleet);
    if (!f) return "army.err.unknown";
    if (f.faction !== faction) return "army.err.not_ours";
    if (o.type === "FleetMove") return ctx.aw.seas.has(o.to) && seaRoute(ctx.aw, f.sea, o.to) ? null : "army.err.no_route";
    if (o.type === "FleetMission") return null;
    const a = findArmy(ctx.s, o.army);
    if (!a || a.faction !== faction) return "army.err.unknown";
    if (a.engaged) return "army.err.engaged";
    if (o.type === "FleetEmbark") {
      if (a.fleet) return "army.err.embarked";
      const sea = ctx.aw.seas.get(f.sea);
      if (!a.province || !sea?.coasts.includes(a.province)) return "army.err.not_coast";
      if (fleetLoad(ctx, f) + a.regiments.reduce((n, r) => n + r.count, 0) > fleetCapacity(ctx.aw, f)) return "army.err.capacity";
      return null;
    }
    if (a.fleet !== f.id) return "army.err.not_embarked";
    if (f.route.length > 0) return "army.err.at_sea";
    return ctx.aw.seas.get(f.sea)?.coasts.includes(o.province) ? null : "army.err.not_coast";
  }
  const a = findArmy(ctx.s, (o as { army: string }).army);
  if (!a) return "army.err.unknown";
  if (a.faction !== faction) return "army.err.not_ours";
  if (a.engaged && o.type !== "ArmySetGeneral") return "army.err.engaged";
  if (a.fleet && o.type !== "ArmySetGeneral") return "army.err.embarked";
  switch (o.type) {
    case "ArmyMove": {
      if (isStatic(ctx.aw, a)) return "army.err.static";
      if (!a.province || !g.nodes.has(o.to) || o.to === a.province) return "army.err.no_route";
      return shortestRoute(g, a.province, o.to) ? null : "army.err.no_route";
    }
    case "ArmyIntercept": {
      const t = findArmy(ctx.s, o.target);
      if (!t || !t.province || !hostile(ctx.ns, a.faction, t.faction)) return "army.err.bad_target";
      if (!visibleProvinces(ctx, a.faction).has(t.province)) return "army.err.not_visible";
      if (isStatic(ctx.aw, a)) return "army.err.static";
      return null;
    }
    case "ArmyRetreat":
      return retreatProvince(ctx, a) ? null : "army.err.no_retreat";
    case "ArmyMerge": {
      const into = findArmy(ctx.s, o.into);
      if (!into || into.id === a.id || into.faction !== a.faction || into.province !== a.province || into.engaged || into.fleet) return "army.err.not_together";
      return null;
    }
    case "ArmySplit": {
      if (o.regiments.length === 0) return "army.err.split_empty";
      let left = a.regiments.reduce((n, r) => n + r.count, 0);
      for (const x of o.regiments) {
        const r = a.regiments.find((y) => y.regiment === x.regiment);
        if (!r || !Number.isInteger(x.count) || x.count < 1 || x.count > r.count) return "army.err.split_count";
        left -= x.count;
      }
      if (left < 1) return "army.err.split_all";
      return o.general ? generalProblem(ctx, a.faction, o.general) : null;
    }
    case "ArmySetGeneral":
      return o.general ? generalProblem(ctx, a.faction, o.general) : null;
    case "ArmyGarrison": {
      if (!a.province || a.faction !== "fac_paradis" || !holds(ctx, "fac_paradis", a.province)) return "army.err.not_held";
      if (!Number.isInteger(o.soldiers) || o.soldiers < 1 || o.soldiers > ctx.aw.balance.garrison.transfer_max) return "army.err.count";
      if (o.mode === "deposer") return armyMen(ctx.aw, a) - o.soldiers >= 50 ? null : "army.err.count";
      return (ctx.st.provinces[a.province]?.garrison?.soldiers ?? 0) >= o.soldiers ? null : "army.err.count";
    }
    default:
      return null;
  }
}

function generalProblem(ctx: ArmyCtx, faction: string, who: string): string | null {
  const c = ctx.pol?.characters[who];
  const def = ctx.world.politics?.characters.get(who);
  if (!c?.alive || !def) return "army.err.general";
  const side = faction === "fac_paradis" ? "paradis" : faction === "fac_marley" ? "marley" : faction.replace(/^fac_/, "");
  if (def.faction !== side || def.rank_key === "rank.cadet" || def.active_from > ctx.date.year) return "army.err.general";
  if (generalBusy(ctx.s, who)) return "army.err.general_busy";
  return null;
}

/** Applique un ordre validé (`orderProblem` doit être null). */
export function applyOrder(ctx: ArmyCtx, o: ArmyOrder): void {
  const g = geoOf(ctx.world);
  const day = dayOf(ctx);
  if (o.type === "FleetMove" || o.type === "FleetMission" || o.type === "FleetEmbark" || o.type === "FleetLand") {
    const f = ctx.s.fleets.find((x) => x.id === o.fleet) as FleetState;
    if (o.type === "FleetMove") {
      f.route = (seaRoute(ctx.aw, f.sea, o.to) ?? []).slice(1);
      f.progress = 0;
    } else if (o.type === "FleetMission") f.mission = o.mission;
    else if (o.type === "FleetEmbark") {
      const a = findArmy(ctx.s, o.army) as ArmyState;
      a.fleet = f.id;
      a.province = null;
      a.route = [];
      a.target = null;
      f.embarked.push(a.id);
      pushArmyLog(ctx.s, ctx.date, "army.log.embarked", { army: a.name_key, fleet: f.name_key });
    } else {
      const a = findArmy(ctx.s, o.army) as ArmyState;
      land(ctx, f, a, o.province);
    }
    return;
  }
  const a = findArmy(ctx.s, o.army) as ArmyState;
  switch (o.type) {
    case "ArmyMove":
      a.route = (shortestRoute(g, a.province as string, o.to) ?? []).slice(1);
      a.progress = 0;
      a.target = null;
      a.stance = "marche";
      break;
    case "ArmyHalt":
      a.route = [];
      a.progress = 0;
      a.target = null;
      a.stance = "halte";
      break;
    case "ArmyForcedMarch":
      a.forced = o.on;
      break;
    case "ArmyIntercept":
      a.target = o.target;
      a.stance = "marche";
      steerToTarget(ctx, a);
      break;
    case "ArmyRetreat": {
      const to = retreatProvince(ctx, a) as string;
      a.route = [to];
      a.progress = 0;
      a.target = null;
      a.stance = "retraite";
      a.morale = clamp(a.morale - 2, 0, 100);
      break;
    }
    case "ArmyMerge": {
      const into = findArmy(ctx.s, o.into) as ArmyState;
      const ma = armyMen(ctx.aw, a);
      const mb = armyMen(ctx.aw, into);
      const w = (x: number, y: number): number => (ma + mb > 0 ? (x * ma + y * mb) / (ma + mb) : y);
      into.morale = w(a.morale, into.morale);
      into.supply = w(a.supply, into.supply);
      into.fatigue = w(a.fatigue, into.fatigue);
      for (const r of a.regiments) addStack(into, r.regiment, r.count, r.strength);
      if (!into.general && a.general) {
        into.general = a.general;
        into.general_key = a.general_key;
        into.interim = false;
      }
      ctx.s.armies = ctx.s.armies.filter((x) => x.id !== a.id);
      pushArmyLog(ctx.s, ctx.date, "army.log.merged", { army: a.name_key, into: into.name_key });
      break;
    }
    case "ArmySplit": {
      ctx.s.seq += 1;
      const id = `army_${ctx.s.seq}`;
      const part: ArmyState = { ...structuredClone(a), id, number: ctx.s.seq, name_key: "army.detachment", general: o.general, general_key: o.general ? a.general_key : "army.general.interim", interim: o.general === null, regiments: [], route: [], progress: 0, target: null, stance: "halte", engaged: null };
      for (const x of o.regiments) {
        const r = a.regiments.find((y) => y.regiment === x.regiment);
        if (!r) continue;
        part.regiments.push({ regiment: r.regiment, count: x.count, strength: r.strength });
        r.count -= x.count;
      }
      a.regiments = a.regiments.filter((r) => r.count > 0);
      ctx.s.armies.push(part);
      pushArmyLog(ctx.s, ctx.date, "army.log.split", { army: a.name_key, n: ctx.s.seq });
      break;
    }
    case "ArmySetGeneral":
      a.general = o.general;
      a.interim = o.general === null;
      if (o.general) a.general_key = ctx.world.politics?.characters.get(o.general)?.rank_key ?? a.general_key;
      pushArmyLog(ctx.s, ctx.date, "army.log.general", { army: a.name_key, general: o.general ?? "army.general.interim" });
      break;
    case "ArmyGarrison": {
      const p = ctx.st.provinces[a.province as string];
      if (!p) break;
      if (o.mode === "deposer") {
        removeMen(ctx.aw, a, o.soldiers);
        p.garrison = { org: p.garrison?.org ?? "garrison", soldiers: (p.garrison?.soldiers ?? 0) + o.soldiers };
        p.morale = clamp(p.morale + ctx.aw.balance.garrison.relief_morale, 0, 100);
        pushArmyLog(ctx.s, ctx.date, "army.log.garrison_in", { army: a.name_key, n: o.soldiers, province: a.province as string });
      } else if (p.garrison) {
        p.garrison.soldiers -= o.soldiers;
        const per = regimentOf(ctx.aw, "rgt_garnison").men;
        addStack(a, "rgt_garnison", Math.max(1, Math.round(o.soldiers / per)), Math.min(1, o.soldiers / (per * Math.max(1, Math.round(o.soldiers / per)))));
        pushArmyLog(ctx.s, ctx.date, "army.log.garrison_out", { army: a.name_key, n: o.soldiers, province: a.province as string });
      }
      break;
    }
  }
  void day;
}

function addStack(a: ArmyState, regiment: string, count: number, strength: number): void {
  const cur = a.regiments.find((r) => r.regiment === regiment);
  if (cur) {
    cur.strength = (cur.strength * cur.count + strength * count) / (cur.count + count);
    cur.count += count;
  } else a.regiments.push({ regiment, count, strength });
}

/** Retire `men` hommes des régiments d'infanterie d'abord (dépôt en garnison). */
function removeMen(aw: ArmiesWorld, a: ArmyState, men: number): void {
  let left = men;
  const order = [...a.regiments].sort((x, y) => Number(aw.regiments.get(y.regiment)?.kind === "infanterie") - Number(aw.regiments.get(x.regiment)?.kind === "infanterie"));
  for (const r of order) {
    if (left <= 0) break;
    const per = aw.regiments.get(r.regiment)?.men ?? 1;
    const have = per * r.count * r.strength;
    const take = Math.min(have - 1, left);
    if (take <= 0) continue;
    r.strength = Math.max(0.05, (have - take) / (per * r.count));
    left -= take;
  }
}

/** Province voisine où se replier : tenue par son camp, sans ennemi, la plus éloignée de l'ennemi le plus proche. */
export function retreatProvince(ctx: ArmyCtx, a: ArmyState): string | null {
  if (!a.province) return null;
  const g = geoOf(ctx.world);
  const enemies = ctx.s.armies.filter((x) => x.province && hostile(ctx.ns, x.faction, a.faction));
  const options = (g.adj.get(a.province) ?? [])
    .map((e) => e.to)
    .filter((p) => !enemies.some((x) => x.province === p))
    .filter((p) => holds(ctx, a.faction, p) || ctx.s.occupied[p] === undefined);
  const friendly = options.filter((p) => holds(ctx, a.faction, p));
  const pool = friendly.length > 0 ? friendly : options;
  return [...pool].sort((x, y) => Number(isWallProvince(g, y)) - Number(isWallProvince(g, x)) || x.localeCompare(y))[0] ?? null;
}

function steerToTarget(ctx: ArmyCtx, a: ArmyState): void {
  const t = a.target ? findArmy(ctx.s, a.target) : undefined;
  if (!t?.province || !a.province) {
    a.target = null;
    return;
  }
  if (t.province === a.province) {
    a.route = [];
    return;
  }
  a.route = (shortestRoute(geoOf(ctx.world), a.province, t.province) ?? []).slice(1);
}

// ——— Mer ———

export function seaKm(aw: ArmiesWorld, a: string, b: string): number {
  const x = aw.seas.get(a);
  const y = aw.seas.get(b);
  if (!x || !y) return 400;
  if (x.offmap || y.offmap) return 450;
  return Math.max(50, Math.hypot(x.x - y.x, x.y - y.y));
}

/** Itinéraire maritime (parcours en largeur, voisins triés). */
export function seaRoute(aw: ArmiesWorld, from: string, to: string): string[] | null {
  if (from === to) return [from];
  const prev = new Map<string, string>([[from, ""]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift() as string;
    for (const n of [...(aw.seas.get(cur)?.adjacent ?? [])].sort()) {
      if (prev.has(n)) continue;
      prev.set(n, cur);
      if (n === to) {
        const path = [n];
        let k = cur;
        while (k) {
          path.unshift(k);
          k = prev.get(k) ?? "";
        }
        return path;
      }
      queue.push(n);
    }
  }
  return null;
}

export function fleetCapacity(aw: ArmiesWorld, f: FleetState): number {
  return f.ships.reduce((n, s) => n + (aw.ships.get(s.ship)?.capacity ?? 0) * s.count, 0);
}

function fleetLoad(ctx: ArmyCtx, f: FleetState): number {
  return f.embarked.reduce((n, id) => n + (findArmy(ctx.s, id)?.regiments.reduce((m, r) => m + r.count, 0) ?? 0), 0);
}

export function fleetPower(aw: ArmiesWorld, f: FleetState): number {
  return f.ships.reduce((n, s) => {
    const d = aw.ships.get(s.ship);
    return n + (d ? (d.attack + d.defense) * s.count * s.strength : 0);
  }, 0);
}

function fleetGuns(aw: ArmiesWorld, f: FleetState): { piece: string; count: number }[] {
  const out: { piece: string; count: number }[] = [];
  for (const s of f.ships) {
    const gdef = aw.ships.get(s.ship)?.guns;
    if (gdef) out.push({ piece: gdef.piece, count: Math.round(gdef.count * s.count * s.strength) });
  }
  return out.filter((x) => x.count > 0);
}

function land(ctx: ArmyCtx, f: FleetState, a: ArmyState, province: string): void {
  f.embarked = f.embarked.filter((x) => x !== a.id);
  a.fleet = null;
  a.province = province;
  a.landed = dayOf(ctx);
  a.route = [];
  a.progress = 0;
  a.stance = "halte";
  pushArmyLog(ctx.s, ctx.date, "army.log.landed", { army: a.name_key, province });
  if (hostile(ctx.ns, a.faction, "fac_paradis")) pushLog(ctx.st, ctx.date, "alert.army_landing", { province, army: a.name_key }, true);
}

// ——— Vision ———

/** Provinces vues par une faction : autour de ses armées (cavalerie et ODM : plus loin), de ses provinces tenues, des côtes de ses flottes. */
export function visibleProvinces(ctx: Pick<ArmyCtx, "world" | "aw" | "s" | "st">, faction: string): Set<string> {
  const g = geoOf(ctx.world);
  const seen = new Set<string>();
  const around = (p: string, range: number): void => {
    let frontier = [p];
    seen.add(p);
    for (let i = 0; i < range; i++) {
      const next: string[] = [];
      for (const q of frontier) for (const e of g.adj.get(q) ?? []) if (!seen.has(e.to)) {
        seen.add(e.to);
        next.push(e.to);
      }
      frontier = next;
    }
  };
  for (const a of ctx.s.armies) {
    if (a.faction !== faction || !a.province) continue;
    const scout = Math.max(0, ...a.regiments.map((r) => ctx.aw.regiments.get(r.regiment)?.scout ?? 0));
    around(a.province, ctx.aw.balance.vision.base + scout);
  }
  if (faction === "fac_paradis") for (const [p, ps] of Object.entries(ctx.st.provinces)) if (ps.control === "paradis" && ctx.s.occupied[p] === undefined) around(p, 1);
  for (const [p, f] of Object.entries(ctx.s.occupied)) if (f === faction) around(p, 1);
  for (const f of ctx.s.fleets) if (f.faction === faction) for (const c of ctx.aw.seas.get(f.sea)?.coasts ?? []) seen.add(c);
  return seen;
}

// ——— Puissance et rencontres ———

function bestCommand(ctx: ArmyCtx, armies: readonly ArmyState[]): { value: number; interim: boolean } {
  let best = 50;
  let interim = true;
  for (const a of armies) {
    if (!a.general) continue;
    const def = ctx.world.politics?.characters.get(a.general);
    const cs = ctx.pol?.characters[a.general];
    const cmd = def && ctx.world.politics ? effectiveAttributes(ctx.world.politics, def, cs).command : 50;
    if (interim || cmd > best) best = cmd;
    interim = false;
  }
  return { value: best, interim };
}

function artilleryScore(aw: ArmiesWorld, pieces: readonly { piece: string; count: number }[]): number {
  return pieces.reduce((n, p) => {
    const d = aw.pieces.get(p.piece);
    return n + (d ? p.count * d.vs_soldier * d.blast_m * Math.min(1, d.rate_per_min) : 0);
  }, 0);
}

/** Puissance d'un camp dans une rencontre, expliquée (infobulle « pourquoi ? »). */
export function sidePower(ctx: ArmyCtx, enc: Encounter, side: EncounterSide, role: "attaque" | "defense", enemyPieces: readonly { piece: string; count: number }[], fleetSupport: readonly { piece: string; count: number }[] = []): Explained {
  const b = ctx.aw.balance;
  const armies = side.armies.map((id) => findArmy(ctx.s, id)).filter((a): a is ArmyState => !!a);
  const e = new Explainer();
  let base = 0;
  let men = 0;
  let morale = 0;
  let fatigue = 0;
  for (const a of armies) {
    const m = armyMen(ctx.aw, a);
    men += m;
    morale += a.morale * m;
    fatigue += a.fatigue * m;
    for (const r of a.regiments) {
      const d = ctx.aw.regiments.get(r.regiment);
      if (!d) continue;
      const v = enc.kind === "titans" ? d.anti_titan : role === "attaque" ? d.attack : d.defense;
      base += (d.men * r.count * r.strength * v) / 100;
    }
  }
  e.base(enc.kind === "titans" ? "why.army_anti_titan" : role === "attaque" ? "why.army_attack" : "why.army_defense", base, { n: Math.round(men) });
  if (men > 0) {
    e.mul("why.army_morale", 0.5 + morale / men / 100, { v: Math.round(morale / men) });
    const f = fatigue / men;
    if (f > 0) e.mul("why.army_fatigue", 1 - (b.combat.fatigue_penalty * f) / 100, { v: Math.round(f) });
  }
  const cmd = bestCommand(ctx, armies);
  e.mul(cmd.interim ? "why.army_interim" : "why.army_command", (1 + b.combat.command_bonus_per_point * (cmd.value - 50)) * (cmd.interim ? b.succession.interim_command_mult : 1), { v: Math.round(cmd.value) });
  const own = artilleryScore(ctx.aw, [...armies.flatMap((a) => armyPieces(ctx.aw, a)), ...fleetSupport]);
  const theirs = artilleryScore(ctx.aw, enemyPieces);
  if (own > 0 && enc.kind !== "titans") {
    const share = own / (own + men / 50);
    const counter = theirs > 0 ? 1 - b.combat.counter_battery * (theirs / (own + theirs)) : 1;
    e.mul("why.army_artillery", 1 + b.combat.artillery_weight * share * counter, { n: Math.round(own) });
  }
  if (role === "defense" && enc.kind !== "titans") {
    e.mul("why.army_terrain", b.combat.defender_terrain[terrainOf(ctx.world, enc.province)] ?? 1, { terrain: terrainOf(ctx.world, enc.province) });
    if (isWallProvince(geoOf(ctx.world), enc.province)) e.mul("why.army_wall", b.combat.wall_defense_mult);
  }
  if (role === "attaque" && enc.kind === "debarquement") {
    const t = terrainOf(ctx.world, enc.province);
    e.mul("why.army_landing", t === "plateau" || t === "montagne" ? b.combat.landing_cliffs_penalty : b.combat.landing_penalty);
  }
  return e.done();
}

/** Ouvre une rencontre ; celle d'une faction non jouée se résout aussitôt (calcul rapide). */
export function openEncounter(ctx: ArmyCtx, province: string, kind: EncounterKind, sides: EncounterSide[], titans: number, defender: string | null): Encounter {
  ctx.s.seq += 1;
  const enc: Encounter = { id: `enc_${ctx.s.seq}`, day: dayOf(ctx), province, kind, sides, titans, defender, status: "attente", result: null };
  ctx.s.encounters.push(enc);
  for (const sd of sides) for (const id of sd.armies) {
    const a = findArmy(ctx.s, id);
    if (a) {
      a.engaged = enc.id;
      a.progress = 0;
    }
  }
  const player = playerOf(ctx.ns);
  if (sides.some((x) => x.faction === player)) {
    pushLog(ctx.st, ctx.date, kind === "titans" ? "alert.army_titans" : kind === "debarquement" ? "alert.army_landing_battle" : "alert.army_contact", { province, n: titans }, true);
  } else resolveEncounter(ctx, enc.id, "auto", []);
  trimEncounters(ctx.s);
  return enc;
}

function trimEncounters(s: ArmiesState): void {
  const done = s.encounters.filter((e) => e.status === "resolue");
  if (done.length > ENCOUNTER_CAP) {
    const drop = new Set(done.slice(0, done.length - ENCOUNTER_CAP).map((e) => e.id));
    s.encounters = s.encounters.filter((e) => !drop.has(e.id));
  }
}

/** Le joueur peut-il jouer cette rencontre en bataille tactique (soldats de Paradis contre Titans ou batteries) ? */
export function canPlay(ctx: Pick<ArmyCtx, "aw" | "s" | "ns" | "world">, enc: Encounter): boolean {
  if (!ctx.world.tactical || enc.status !== "attente" || playerOf(ctx.ns) !== "fac_paradis") return false;
  const para = enc.sides.find((x) => x.faction === "fac_paradis");
  if (!para) return false;
  if (enc.kind === "titans") return enc.titans > 0;
  return enc.sides.some((x) => x.faction !== "fac_paradis" && x.armies.some((id) => {
    const a = findArmy(ctx.s, id);
    return !!a && armyPieces(ctx.aw, a).length > 0;
  }));
}

const TERRAIN_MAP: Record<string, string> = { urbain: "tmap_ville", foret: "tmap_foret", mur: "tmap_mur", fort: "tmap_mur", militaire: "tmap_ville" };

/** Bataille tactique d'une rencontre (PA.5) : échantillon de soldats de Paradis, Titans rencontrés, batteries des deux camps. */
export function encounterSetup(ctx: Pick<ArmyCtx, "world" | "aw" | "s" | "seed"> & { st?: StrategicState }, encId: string): BattleSetup | null {
  const enc = ctx.s.encounters.find((e) => e.id === encId);
  const tw = ctx.world.tactical;
  if (!enc || !tw) return null;
  const para = enc.sides.find((x) => x.faction === "fac_paradis");
  if (!para) return null;
  const ours = para.armies.map((id) => findArmy(ctx.s, id)).filter((a): a is ArmyState => !!a);
  const men = ours.reduce((n, a) => n + armyMen(ctx.aw, a), 0);
  const n = Math.max(12, Math.min(ctx.aw.balance.encounter.battle_soldiers_max, Math.round(men / 25)));
  const seed = fnv1a(`${ctx.seed}:${enc.id}`);
  const rng = new Rng(seed);
  const types = [...tw.titanTypes.values()].filter((t) => t.weight > 0).sort((a, b) => a.id.localeCompare(b.id));
  const titans: { type: string; count: number }[] = [];
  for (let i = 0; i < Math.min(enc.titans, 12); i++) {
    const total = types.reduce((x, t) => x + t.weight, 0);
    let r = rng.next() * total;
    const pick = types.find((t) => (r -= t.weight) <= 0) ?? types[0];
    if (!pick) break;
    const cur = titans.find((x) => x.type === pick.id);
    if (cur) cur.count += 1;
    else titans.push({ type: pick.id, count: 1 });
  }
  const map = TERRAIN_MAP[terrainOf(ctx.world, enc.province)] ?? "tmap_plaine";
  const setup = skirmishSetup(ctx.world, tw.maps.has(map) ? map : "tmap_plaine", titans, n, seed);
  const batteries: BatterySpec[] = [];
  const add = (side: "allie" | "ennemi", list: readonly { piece: string; count: number }[]): void => {
    for (const p of list) {
      const d = ctx.aw.pieces.get(p.piece);
      if (!d) continue;
      const mun = d.ammo.find((m) => ctx.aw.munitions.get(m)?.enabled) ?? d.ammo[0] ?? "";
      batteries.push({ id: `${side}_${batteries.length + 1}`, piece: p.piece, munition: mun, side, count: Math.max(1, Math.min(6, p.count)) });
    }
  };
  add("allie", ours.flatMap((a) => armyPieces(ctx.aw, a)));
  // Canons de rempart [C] : un segment de mur tenu et gardé, sur place ou voisin, tire avec sa garnison (même règle qu'au siège).
  const wall = ctx.st ? wallGunsNear(ctx.world, ctx.st, enc.province) : 0;
  if (wall > 0 && ctx.aw.pieces.get("art_canon_rempart")?.enabled) add("allie", [{ piece: "art_canon_rempart", count: wall }]);
  for (const sd of enc.sides) if (sd.faction !== "fac_paradis") add("ennemi", sd.armies.flatMap((id) => {
    const a = findArmy(ctx.s, id);
    return a ? armyPieces(ctx.aw, a) : [];
  }));
  const spears = ours.some((a) => a.regiments.some((r) => ctx.aw.regiments.get(r.regiment)?.kind === "lances"));
  return { ...setup, ...(batteries.length > 0 ? { artillery: batteries } : {}), ...(spears ? { thunderSpears: true } : {}) };
}

/** Pièces de rempart en état de tirer près d'une province : segment tenu, une pièce servie par 400 hommes de garnison. */
export function wallGunsNear(world: World, st: StrategicState, province: string): number {
  const g = geoOf(world);
  const around = [province, ...(g.adj.get(province) ?? []).map((e) => e.to)].filter((p) => isWallProvince(g, p) && st.provinces[p]?.control === "paradis").sort();
  return Math.min(6, around.reduce((n, p) => n + Math.floor((st.provinces[p]?.garrison?.soldiers ?? 0) / 400), 0));
}

/** Pertes d'une armée : part des hommes retirée de l'état des régiments ; un régiment sous 10 % disparaît. */
function applyArmyLoss(aw: ArmiesWorld, a: ArmyState, share: number): number {
  const before = armyMen(aw, a);
  for (const r of a.regiments) r.strength = Math.max(0, r.strength * (1 - share));
  a.regiments = a.regiments.filter((r) => r.strength >= 0.1);
  return before - armyMen(aw, a);
}

function destroyArmy(ctx: ArmyCtx, a: ArmyState, key: string): void {
  ctx.s.armies = ctx.s.armies.filter((x) => x.id !== a.id);
  for (const f of ctx.s.fleets) f.embarked = f.embarked.filter((x) => x !== a.id);
  pushArmyLog(ctx.s, ctx.date, key, { army: a.name_key });
  if (a.faction === playerOf(ctx.ns)) pushLog(ctx.st, ctx.date, "alert.army_destroyed", { army: a.name_key }, true);
}

function retreatAfter(ctx: ArmyCtx, a: ArmyState, extra: number): void {
  const to = retreatProvince(ctx, a);
  applyArmyLoss(ctx.aw, a, extra);
  if (!to || a.regiments.length === 0) {
    destroyArmy(ctx, a, "army.log.surrendered");
    return;
  }
  a.province = to;
  a.route = [];
  a.progress = 0;
  a.target = null;
  a.stance = "retraite";
}

/** Le général d'une armée tombe : personnage mort (conséquences politiques), commandement intérimaire, moral. */
export function generalFalls(ctx: ArmyCtx, a: ArmyState, circumstances: string): string | null {
  const who = a.general;
  if (!who) return null;
  if (ctx.pol?.characters[who]?.alive && ctx.world.politics) {
    const r = characterDies(ctx.world, ctx.pol, ctx.st, ctx.date, who, "combat", circumstances);
    ctx.pol = r.state;
    ctx.st = r.strategic;
  }
  a.general = null;
  a.interim = true;
  a.general_key = "army.general.interim";
  a.morale = clamp(a.morale - ctx.aw.balance.morale.general_lost, 0, 100);
  pushArmyLog(ctx.s, ctx.date, "army.log.general_fell", { army: a.name_key, general: who });
  return who;
}

/**
 * Résolution d'une rencontre : « auto » (calcul rapide), « jouer » (bataille tactique rejouée avec les ordres, puis calcul
 * pondéré par son issue) ou « retraite » (le camp du joueur se replie, poursuivi).
 */
export function resolveEncounter(ctx: ArmyCtx, encId: string, mode: "auto" | "jouer" | "retraite", orders: readonly TimedOrder[]): EncounterResult {
  const enc = ctx.s.encounters.find((e) => e.id === encId);
  if (!enc || enc.status !== "attente") throw new Error("army.err.no_encounter");
  const b = ctx.aw.balance;
  const rng = new Rng(fnv1a(`${ctx.seed}:${enc.id}:resolution`));
  const noise = 1 + b.combat.noise * (rng.next() - 0.5) * 2;
  const result: EncounterResult = { mode, winner: null, losses: {}, generals: [], titansKilled: 0, power: {} };
  const armiesOf = (sd: EncounterSide): ArmyState[] => sd.armies.map((id) => findArmy(ctx.s, id)).filter((a): a is ArmyState => !!a);
  const loss = (sd: EncounterSide, share: number): void => {
    for (const a of armiesOf(sd)) result.losses[sd.faction] = (result.losses[sd.faction] ?? 0) + applyArmyLoss(ctx.aw, a, share);
  };
  const player = playerOf(ctx.ns);
  let tacticalShare: number | null = null;
  let tacticalWin = false;
  if (mode === "jouer") {
    const setup = encounterSetup(ctx, enc.id);
    if (!setup || !canPlay(ctx, enc)) throw new Error("army.err.cannot_play");
    const r = runBattle(ctx.world, setup, orders);
    tacticalShare = r.dead.length / Math.max(1, setup.soldiers.length);
    tacticalWin = r.state.ended?.reason === "victoire";
    result.titansKilled = r.state.titans.filter((t) => !t.alive && !t.ally).length;
    const silenced = (r.state.batteries ?? []).filter((x) => x.side === "ennemi").reduce((n, x) => n + (x.count - x.alive), 0);
    // Pièces ennemies réduites au silence dans la bataille : retirées de leurs régiments.
    if (silenced > 0) for (const sd of enc.sides) if (sd.faction !== "fac_paradis") for (const a of armiesOf(sd)) {
      const total = armyPieces(ctx.aw, a).reduce((x, p) => x + p.count, 0);
      if (total > 0) for (const rr of a.regiments) if (ctx.aw.regiments.get(rr.regiment)?.pieces) rr.strength = Math.max(0.1, rr.strength * (1 - Math.min(0.9, silenced / total)));
    }
    pushArmyLog(ctx.s, ctx.date, "army.log.battle_played", { province: enc.province, dead: r.dead.length, total: setup.soldiers.length });
  }
  if (enc.kind === "titans") {
    const sd = enc.sides[0] as EncounterSide;
    const pw = sidePower(ctx, enc, sd, "attaque", []);
    result.power[sd.faction] = pw;
    const titanPower = Math.max(1, enc.titans * 10);
    const ratio = mode === "jouer" ? (tacticalWin ? 2 : 0.6) : (pw.value * noise) / titanPower;
    if (mode === "retraite") {
      for (const a of armiesOf(sd)) retreatAfter(ctx, a, b.combat.retreat_losses);
      result.winner = null;
    } else {
      const share = tacticalShare !== null ? Math.min(0.5, tacticalShare * 0.5) : Math.min(0.5, b.combat.base_losses * Math.sqrt(1 / Math.max(0.05, ratio)) * (enc.titans / 4));
      loss(sd, share);
      result.titansKilled = mode === "jouer" ? result.titansKilled : ratio >= 1 ? enc.titans : Math.floor(enc.titans * ratio);
      result.winner = ratio >= 1 ? sd.faction : null;
      for (const a of armiesOf(sd)) a.morale = clamp(a.morale + (ratio >= 1 ? b.morale.victory / 2 : -b.morale.defeat / 2), 0, 100);
      if (ratio < 1) for (const a of armiesOf(sd)) retreatAfter(ctx, a, 0);
      if (result.titansKilled > 0) ctx.st.titanMods = { ...(ctx.st.titanMods ?? {}), [enc.province]: (ctx.st.titanMods?.[enc.province] ?? 0) - 0.01 * result.titansKilled };
    }
  } else {
    const [s0, s1] = enc.sides as [EncounterSide, EncounterSide];
    const defSide = enc.defender === s1.faction ? s1 : s0;
    const attSide = defSide === s0 ? s1 : s0;
    const piecesOf = (sd: EncounterSide): { piece: string; count: number }[] => armiesOf(sd).flatMap((a) => armyPieces(ctx.aw, a));
    const support = enc.kind === "debarquement" ? ctx.s.fleets.filter((f) => f.faction === attSide.faction && ctx.aw.seas.get(f.sea)?.coasts.includes(enc.province)).flatMap((f) => fleetGuns(ctx.aw, f)) : [];
    const att = sidePower(ctx, enc, attSide, "attaque", piecesOf(defSide), support);
    const def = sidePower(ctx, enc, defSide, enc.defender ? "defense" : "attaque", piecesOf(attSide));
    result.power[attSide.faction] = att;
    result.power[defSide.faction] = def;
    let a = Math.max(0.1, att.value);
    let d = Math.max(0.1, def.value);
    if (tacticalShare !== null) {
      // Bataille jouée : l'issue du duel d'artillerie et des Titans pèse sur le calcul (camp de Paradis).
      const k = tacticalWin ? 1.25 : 0.8;
      if (attSide.faction === "fac_paradis") a *= k;
      else d *= k;
    }
    const retreating = mode === "retraite" ? (attSide.faction === player ? attSide : defSide) : null;
    if (retreating) {
      for (const x of armiesOf(retreating)) retreatAfter(ctx, x, b.combat.retreat_losses * 2);
      const other = retreating === attSide ? defSide : attSide;
      for (const x of armiesOf(other)) x.morale = clamp(x.morale + b.morale.victory / 2, 0, 100);
      result.winner = other.faction;
    } else {
      const la = Math.min(0.6, b.combat.base_losses * Math.sqrt(d / a) / noise);
      const ld = Math.min(0.6, b.combat.base_losses * Math.sqrt(a / d) * noise);
      loss(attSide, tacticalShare !== null && attSide.faction === "fac_paradis" ? (la + tacticalShare * 0.3) / 1.3 : la);
      loss(defSide, tacticalShare !== null && defSide.faction === "fac_paradis" ? (ld + tacticalShare * 0.3) / 1.3 : ld);
      const attWins = a * noise > d;
      const winner = attWins ? attSide : defSide;
      const loser = attWins ? defSide : attSide;
      result.winner = winner.faction;
      for (const x of armiesOf(winner)) x.morale = clamp(x.morale + b.morale.victory, 0, 100);
      for (const x of armiesOf(loser)) {
        x.morale = clamp(x.morale - b.morale.defeat, 0, 100);
        if (rng.next() < b.combat.general_death_chance * 2) {
          const g = generalFalls(ctx, x, "army.general_fell_battle");
          if (g) result.generals.push(g);
        }
        retreatAfter(ctx, x, b.combat.retreat_losses);
      }
      for (const x of armiesOf(winner)) if (rng.next() < b.combat.general_death_chance) {
        const g = generalFalls(ctx, x, "army.general_fell_battle");
        if (g) result.generals.push(g);
      }
    }
  }
  for (const sd of enc.sides) for (const id of sd.armies) {
    const x = findArmy(ctx.s, id);
    if (x && x.engaged === enc.id) {
      x.engaged = null;
      x.landed = null;
      if (x.route[0] === x.province) x.route.shift();
    }
  }
  enc.status = "resolue";
  enc.result = result;
  pushArmyLog(ctx.s, ctx.date, "army.log.encounter", { province: enc.province, winner: result.winner ?? "", mode });
  if (enc.sides.some((x) => x.faction === player)) pushLog(ctx.st, ctx.date, result.winner === player ? "alert.army_victory" : "alert.army_defeat", { province: enc.province }, false);
  return result;
}

// ——— Journée ———

interface Move {
  a: ArmyState;
  from: string;
  to: string;
  km: number;
}

/** Jour des armées : mer, marche et interceptions, contacts, Titans, ravitaillement, sièges, occupation. */
export function dailyArmies(ctx: ArmyCtx): void {
  const b = ctx.aw.balance;
  const g = geoOf(ctx.world);
  const day = dayOf(ctx);
  const rng = new Rng(ctx.seed).fork(`armees:${day}`);
  ctx.s.drawn = {};
  dailyFleets(ctx);
  // Marche : progression du jour, puis interceptions sur une même route en sens contraire.
  const moves: Move[] = [];
  for (const a of [...ctx.s.armies].sort((x, y) => x.id.localeCompare(y.id))) {
    if (a.engaged || a.fleet || !a.province) continue;
    if (a.target) steerToTarget(ctx, a);
    while (a.route[0] === a.province) a.route.shift();
    const next = a.route[0];
    if (!next) {
      a.fatigue = clamp(a.fatigue - b.move.rest_recovery, 0, 100);
      if (a.stance !== "halte") a.stance = "halte";
      continue;
    }
    const km = edgeKm(g, a.province, next) ?? 1;
    // Marche normale : fatigue plafonnée, sans effet sur la vitesse ; la marche forcée la dépasse et ralentit.
    const fat = Math.max(b.move.fatigue_speed_floor, 1 - Math.max(0, a.fatigue - b.move.march_fatigue_cap) / 100);
    const speed = armyBaseSpeed(ctx.aw, a) * (b.move.terrain_speed[terrainOf(ctx.world, next)] ?? 1) * fat * (a.forced ? b.move.forced_mult : 1);
    a.progress += speed;
    a.fatigue = a.forced ? clamp(a.fatigue + b.move.forced_fatigue_per_day, 0, 100) : Math.max(a.fatigue - b.move.rest_recovery / 2, Math.min(b.move.march_fatigue_cap, a.fatigue + b.move.fatigue_per_day));
    if (a.forced) applyArmyLoss(ctx.aw, a, b.move.forced_attrition * (1 + a.fatigue / 100));
    moves.push({ a, from: a.province, to: next, km });
  }
  const crossed = new Set<string>();
  for (let i = 0; i < moves.length; i++) for (let j = i + 1; j < moves.length; j++) {
    const m = moves[i] as Move;
    const n = moves[j] as Move;
    if (crossed.has(m.a.id) || crossed.has(n.a.id)) continue;
    if (m.from !== n.to || m.to !== n.from || !hostile(ctx.ns, m.a.faction, n.a.faction)) continue;
    if (m.a.progress + n.a.progress < m.km) continue;
    const meet = m.a.progress / (m.a.progress + n.a.progress);
    const where = meet < 0.5 ? m.from : m.to;
    for (const x of [m.a, n.a]) {
      x.province = where;
      x.progress = 0;
      crossed.add(x.id);
    }
    pushArmyLog(ctx.s, ctx.date, "army.log.intercepted", { province: where });
    openEncounter(ctx, where, "armees", sidesOf([m.a, n.a]), 0, null);
  }
  for (const m of moves) {
    const a = m.a;
    if (crossed.has(a.id) || a.engaged) continue;
    while (a.route.length > 0 && a.province) {
      const next = a.route[0] as string;
      const km = edgeKm(g, a.province, next) ?? 1;
      if (a.progress < km) break;
      a.progress -= km;
      a.province = next;
      a.route.shift();
      // Une province tenue par l'ennemi arrête la marche (contact).
      if (ctx.s.armies.some((x) => x.province === next && x.id !== a.id && hostile(ctx.ns, x.faction, a.faction))) {
        a.progress = 0;
        break;
      }
    }
    if (a.route.length === 0) {
      a.progress = 0;
      if (a.stance === "retraite" || a.stance === "marche") a.stance = "halte";
      if (a.faction === playerOf(ctx.ns)) pushArmyLog(ctx.s, ctx.date, "army.log.arrived", { army: a.name_key, province: a.province ?? "" });
    }
  }
  // Contacts : deux camps ennemis dans une même province.
  const byProvince = new Map<string, ArmyState[]>();
  for (const a of ctx.s.armies) if (a.province && !a.engaged && !a.fleet) byProvince.set(a.province, [...(byProvince.get(a.province) ?? []), a]);
  for (const [p, list] of [...byProvince].sort(([x], [y]) => x.localeCompare(y))) {
    const factions = [...new Set(list.map((a) => a.faction))].sort();
    if (factions.length < 2) continue;
    const [f0, f1] = factions as [string, string];
    if (!hostile(ctx.ns, f0, f1)) continue;
    const engaged = list.filter((a) => a.faction === f0 || a.faction === f1);
    // Défenseur : le camp qui n'a pas marché aujourd'hui (s'il y en a un seul).
    const movedToday = new Set(moves.map((m) => m.a.id));
    const still = [f0, f1].filter((f) => engaged.filter((a) => a.faction === f).every((a) => !movedToday.has(a.id)));
    const landing = engaged.some((a) => a.landed === day);
    openEncounter(ctx, p, landing ? "debarquement" : "armees", sidesOf(engaged), 0, still.length === 1 ? (still[0] as string) : landing ? (engaged.find((a) => a.landed !== day)?.faction ?? null) : null);
  }
  // Titans hors des murs : usure et rencontres (provinces aux Titans).
  for (const a of [...ctx.s.armies].sort((x, y) => x.id.localeCompare(y.id))) {
    if (!a.province || a.engaged || a.fleet) continue;
    const dens = ctx.st.provinces[a.province]?.control === "paradis" ? 0 : titanDensity(ctx.world, a.province, ctx.st);
    if (dens <= 0) continue;
    const odmShare = a.regiments.filter((r) => ["odm", "lances"].includes(ctx.aw.regiments.get(r.regiment)?.kind ?? "")).reduce((n, r) => n + r.count, 0) / Math.max(1, a.regiments.reduce((n, r) => n + r.count, 0));
    applyArmyLoss(ctx.aw, a, b.titans.attrition_per_density * dens * (1 - b.titans.odm_protection * odmShare));
    if (rng.next() < dens * b.titans.encounter_per_density) {
      const n = Math.max(1, Math.round(dens * b.titans.group_per_density * (0.5 + rng.next())));
      openEncounter(ctx, a.province, "titans", [{ faction: a.faction, armies: [a.id] }], n, null);
    }
  }
  dailySupply(ctx);
  dailySieges(ctx);
  dailyOccupation(ctx);
  // Rencontres du joueur laissées sans réponse : résolues d'office après quelques jours.
  for (const e of ctx.s.encounters) if (e.status === "attente" && day - e.day >= b.encounter.pending_days_max) resolveEncounter(ctx, e.id, "auto", []);
  for (const a of ctx.s.armies) if (a.regiments.length === 0) destroyArmy(ctx, a, "army.log.dissolved");
  // Déroute : sous le seuil de moral, l'armée se replie d'elle-même.
  for (const a of ctx.s.armies) if (!a.engaged && !a.fleet && a.morale < b.morale.rout_below && a.stance !== "retraite") {
    const to = retreatProvince(ctx, a);
    if (to && !holds(ctx, a.faction, a.province ?? "")) {
      a.route = [to];
      a.stance = "retraite";
      a.target = null;
    }
  }
  if (ctx.date.day % DAYS_PER_MONTH === 1) monthlyUpkeep(ctx);
}

function sidesOf(armies: readonly ArmyState[]): EncounterSide[] {
  const factions = [...new Set(armies.map((a) => a.faction))].sort();
  return factions.map((f) => ({ faction: f, armies: armies.filter((a) => a.faction === f).map((a) => a.id).sort() }));
}

/** Flottes : route maritime, batailles navales, blocus, bombardement côtier ; le joueur est averti d'une flotte ennemie en vue. */
function dailyFleets(ctx: ArmyCtx): void {
  const b = ctx.aw.balance;
  const rng = new Rng(ctx.seed).fork(`mer:${dayOf(ctx)}`);
  for (const f of [...ctx.s.fleets].sort((x, y) => x.id.localeCompare(y.id))) {
    const next = f.route[0];
    if (!next) continue;
    const speed = Math.min(...f.ships.map((s) => ctx.aw.ships.get(s.ship)?.speed_km_day ?? 300)) * b.move.sea_speed_mult;
    f.progress += speed;
    const km = seaKm(ctx.aw, f.sea, next);
    if (f.progress >= km) {
      f.progress = 0;
      f.sea = next;
      f.route.shift();
      const sea = ctx.aw.seas.get(next);
      if (sea && !sea.offmap && hostile(ctx.ns, f.faction, playerOf(ctx.ns))) pushLog(ctx.st, ctx.date, "alert.fleet_sighted", { sea: sea.name_key }, true);
    }
  }
  // Batailles navales : deux flottes ennemies dans une même zone (escorte : les transports sont protégés par les navires de ligne).
  const seas = [...new Set(ctx.s.fleets.map((f) => f.sea))].sort();
  for (const sea of seas) {
    const here = ctx.s.fleets.filter((f) => f.sea === sea);
    for (let i = 0; i < here.length; i++) for (let j = i + 1; j < here.length; j++) {
      const x = here[i] as FleetState;
      const y = here[j] as FleetState;
      if (!hostile(ctx.ns, x.faction, y.faction)) continue;
      const px = Math.max(0.1, fleetPower(ctx.aw, x));
      const py = Math.max(0.1, fleetPower(ctx.aw, y));
      const nz = 0.85 + 0.3 * rng.next();
      for (const [f, own, other] of [[x, px, py], [y, py, px]] as const) {
        const share = Math.min(0.6, b.naval.battle_losses * Math.sqrt(other / own) * nz);
        const warships = f.ships.filter((s) => ctx.aw.ships.get(s.ship)?.kind !== "transport").reduce((n, s) => n + s.count, 0);
        const transports = f.ships.filter((s) => ctx.aw.ships.get(s.ship)?.kind === "transport").reduce((n, s) => n + s.count, 0);
        const escorted = warships >= transports * b.naval.escort_ratio;
        for (const s of f.ships) s.strength = Math.max(0, s.strength - share * (ctx.aw.ships.get(s.ship)?.kind === "transport" && escorted ? 0.3 : 1));
        f.ships = f.ships.filter((s) => s.strength >= 0.1);
        for (const id of f.embarked) {
          const a = findArmy(ctx.s, id);
          if (a) applyArmyLoss(ctx.aw, a, escorted ? share * 0.1 : share * 0.5);
        }
      }
      pushArmyLog(ctx.s, ctx.date, "army.log.naval_battle", { sea });
    }
  }
  ctx.s.fleets = ctx.s.fleets.filter((f) => {
    if (f.ships.length > 0) return true;
    for (const id of f.embarked) ctx.s.armies = ctx.s.armies.filter((a) => a.id !== id);
    pushArmyLog(ctx.s, ctx.date, "army.log.fleet_sunk", { fleet: f.name_key });
    return false;
  });
  // Bombardement côtier : une flotte en guerre tire sur les armées ennemies des côtes de sa zone (artillerie navale).
  for (const f of ctx.s.fleets) {
    const sea = ctx.aw.seas.get(f.sea);
    if (!sea || sea.offmap || f.route.length > 0) continue;
    const guns = fleetGuns(ctx.aw, f);
    const power = guns.reduce((n, gx) => n + gx.count * (ctx.aw.pieces.get(gx.piece)?.vs_soldier ?? 0), 0);
    if (power <= 0) continue;
    for (const a of ctx.s.armies) {
      if (!a.province || !sea.coasts.includes(a.province) || !hostile(ctx.ns, a.faction, f.faction)) continue;
      applyArmyLoss(ctx.aw, a, Math.min(0.05, power * 0.0015));
      a.morale = clamp(a.morale - Math.min(5, power * 0.1), 0, 100);
      pushArmyLog(ctx.s, ctx.date, "army.log.shore_bombardment", { army: a.name_key, fleet: f.name_key });
    }
  }
}

/** Côtes bloquées : zones tenues par une flotte ennemie de Paradis en mission « blocus ». */
export function blockadedCoasts(ctx: Pick<ArmyCtx, "aw" | "s" | "ns">): Set<string> {
  const out = new Set<string>();
  for (const f of ctx.s.fleets) {
    if (f.mission !== "blocus" || !hostile(ctx.ns, f.faction, "fac_paradis")) continue;
    for (const c of ctx.aw.seas.get(f.sea)?.coasts ?? []) out.add(c);
  }
  return out;
}

/** Ravitaillement : en territoire tenu, vivres et gaz puisés dans les stocks ; sinon les réserves baissent (famine, usure, moral). */
function dailySupply(ctx: ArmyCtx): void {
  const b = ctx.aw.balance;
  const blockade = blockadedCoasts(ctx);
  for (const a of ctx.s.armies) {
    if (a.fleet) {
      a.supply = Math.min(b.supply.max_days, a.supply + b.supply.naval_supply / 3);
      continue;
    }
    if (!a.province) continue;
    let food = 0;
    let gas = 0;
    for (const r of a.regiments) {
      const d = ctx.aw.regiments.get(r.regiment);
      if (!d) continue;
      food += d.food_per_day * r.count * r.strength;
      gas += d.gas_per_day * r.count * r.strength;
    }
    const naval = ctx.s.fleets.some((f) => f.faction === a.faction && !hostile(ctx.ns, f.faction, a.faction) && ctx.aw.seas.get(f.sea)?.coasts.includes(a.province ?? ""));
    const friendly = holds(ctx, a.faction, a.province);
    if (friendly && a.faction === "fac_paradis") {
      const refill = Math.min(b.supply.resupply_per_day, b.supply.max_days - a.supply) * (blockade.has(a.province) ? b.naval.blockade_supply_mult : 1);
      const needFood = food * (1 + Math.max(0, refill));
      const needGas = gas * (1 + Math.max(0, refill));
      const okFood = (ctx.st.stocks["food"] ?? 0) >= needFood;
      const okGas = gas <= 0 || (ctx.st.stocks["gas"] ?? 0) >= needGas;
      if (okFood && okGas) {
        drawStock(ctx, "food", needFood);
        if (gas > 0) drawStock(ctx, "gas", needGas);
        a.supply = Math.min(b.supply.max_days, a.supply + Math.max(0, refill));
      } else a.supply = Math.max(0, a.supply - 1);
    } else if (friendly || naval) a.supply = Math.min(b.supply.max_days, a.supply + (naval ? b.supply.naval_supply : b.supply.resupply_per_day / 2));
    else a.supply = Math.max(0, a.supply - 1);
    if (a.supply <= 0) {
      applyArmyLoss(ctx.aw, a, b.supply.starvation_attrition);
      a.morale = clamp(a.morale - b.supply.starvation_morale, 0, 100);
    } else if (!a.engaged) a.morale = clamp(a.morale + Math.sign(b.morale.base - a.morale) * Math.min(b.morale.drift, Math.abs(b.morale.base - a.morale)), 0, 100);
  }
}

/**
 * Sièges : une armée ennemie avec de l'artillerie, voisine d'un segment de mur tenu, le bombarde (structure, garnison) ;
 * les canons de rempart de la garnison et l'artillerie de Paradis présente répondent (contre-batterie) ; poudre consommée.
 */
function dailySieges(ctx: ArmyCtx): void {
  const b = ctx.aw.balance;
  const g = geoOf(ctx.world);
  const day = dayOf(ctx);
  const active = new Set<string>();
  for (const a of [...ctx.s.armies].sort((x, y) => x.id.localeCompare(y.id))) {
    if (!a.province || a.engaged || a.fleet || a.route.length > 0 || !hostile(ctx.ns, a.faction, "fac_paradis")) continue;
    const pieces = armyPieces(ctx.aw, a);
    if (pieces.length === 0) continue;
    const segment = (g.adj.get(a.province) ?? []).map((e) => e.to).filter((p) => isWallProvince(g, p) && ctx.st.provinces[p]?.control === "paradis" && ctx.st.provinces[p]?.wall_structure !== null).sort()[0];
    if (!segment) continue;
    active.add(segment);
    let siege = ctx.s.sieges.find((x) => x.segment === segment);
    if (!siege) {
      siege = { segment, faction: a.faction, army: a.id, since: day, silenced: 0, breached: false };
      ctx.s.sieges.push(siege);
      pushLog(ctx.st, ctx.date, "alert.siege", { segment, army: a.name_key }, true);
    }
    const ps = ctx.st.provinces[segment];
    if (!ps || ps.wall_structure === null) continue;
    const dmg = pieces.reduce((n, p) => n + p.count * (ctx.aw.pieces.get(p.piece)?.wall_damage ?? 0), 0) * b.siege.wall_per_piece_day;
    ps.wall_structure = Math.max(0, ps.wall_structure - dmg);
    const count = pieces.reduce((n, p) => n + p.count, 0);
    if (ps.garrison) ps.garrison.soldiers = Math.max(0, ps.garrison.soldiers - Math.round(count * b.siege.garrison_losses_per_piece_day));
    const defenders = ctx.s.armies.filter((x) => x.faction === "fac_paradis" && (x.province === segment || x.province === a.province));
    const wallGuns = Math.floor((ps.garrison?.soldiers ?? 0) / 400);
    const ownGuns = wallGuns + defenders.reduce((n, x) => n + armyPieces(ctx.aw, x).reduce((m, p) => m + p.count, 0), 0);
    if (ownGuns > 0) {
      const hit = Math.min(0.08, b.combat.counter_battery * ownGuns * 0.004);
      for (const r of a.regiments) if (ctx.aw.regiments.get(r.regiment)?.pieces) r.strength = Math.max(0.1, r.strength * (1 - hit));
      siege.silenced += Math.round(count * hit * 10) / 10;
      drawStock(ctx, "powder", Math.min(ctx.st.stocks["powder"] ?? 0, ownGuns * (ctx.aw.pieces.get("art_canon_rempart")?.powder_per_day ?? 0)));
    }
    a.morale = clamp(a.morale - (ownGuns > 0 ? 1 : 0), 0, 100);
    const n = ctx.ns?.nations[a.faction];
    if (n) n.industry = Math.max(0, n.industry - pieces.reduce((x, p) => x + p.count * (ctx.aw.pieces.get(p.piece)?.powder_per_day ?? 0), 0) * 0.1);
    if (!siege.breached && ps.wall_structure < b.siege.capture_below_structure) {
      siege.breached = true;
      pushLog(ctx.st, ctx.date, "alert.wall_breach", { segment }, true);
    }
  }
  ctx.s.sieges = ctx.s.sieges.filter((x) => active.has(x.segment));
}

/** Prélèvement des armées dans les stocks nationaux, consigné pour le « pourquoi ? » (hors plan économique du jour). */
function drawStock(ctx: ArmyCtx, r: "food" | "gas" | "powder" | "gold", v: number): void {
  if (v === 0) return;
  ctx.st.stocks[r] = (ctx.st.stocks[r] ?? 0) - v;
  const drawn = (ctx.s.drawn ??= {});
  drawn[r] = (drawn[r] ?? 0) + v;
}

function drop<T>(rec: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(rec).filter(([k]) => k !== key));
}

/** Occupation : une armée ennemie seule dans une province de Paradis pendant trois jours la tient ; Paradis la reprend en y entrant. */
function dailyOccupation(ctx: ArmyCtx): void {
  const present = new Map<string, Set<string>>();
  for (const a of ctx.s.armies) if (a.province && !a.fleet) present.set(a.province, (present.get(a.province) ?? new Set()).add(a.faction));
  for (const [p, fs] of [...present].sort(([x], [y]) => x.localeCompare(y))) {
    const enemy = [...fs].find((f) => hostile(ctx.ns, f, "fac_paradis"));
    if (enemy && !fs.has("fac_paradis") && ctx.st.provinces[p]?.control === "paradis" && ctx.s.occupied[p] === undefined) {
      ctx.s.pressure[p] = (ctx.s.pressure[p] ?? 0) + 1;
      if ((ctx.s.pressure[p] ?? 0) >= 3) {
        ctx.s.occupied[p] = enemy;
        ctx.s.pressure = drop(ctx.s.pressure, p);
        if (ctx.pol) ctx.pol.legitimacy = Math.max(0, ctx.pol.legitimacy - 1);
        pushLog(ctx.st, ctx.date, "alert.province_occupied", { province: p }, true);
      }
    } else if (!enemy) {
      ctx.s.pressure = drop(ctx.s.pressure, p);
      if (fs.has("fac_paradis") && ctx.s.occupied[p] !== undefined) {
        ctx.s.occupied = drop(ctx.s.occupied, p);
        pushLog(ctx.st, ctx.date, "alert.province_liberated", { province: p }, false);
      }
    }
  }
}

/** Entretien mensuel : or de Paradis, industrie des nations. */
function monthlyUpkeep(ctx: ArmyCtx): void {
  for (const a of ctx.s.armies) {
    const cost = a.regiments.reduce((n, r) => n + (ctx.aw.regiments.get(r.regiment)?.upkeep ?? 0) * r.count, 0) + armyPieces(ctx.aw, a).reduce((n, p) => n + (ctx.aw.pieces.get(p.piece)?.upkeep ?? 0) * p.count, 0);
    if (a.faction === "fac_paradis") drawStock(ctx, "gold", cost);
    else {
      const n = ctx.ns?.nations[a.faction];
      if (n) n.industry = Math.max(0, n.industry - cost * 0.1);
    }
  }
  for (const f of ctx.s.fleets) {
    const n = ctx.ns?.nations[f.faction];
    if (n) n.industry = Math.max(0, n.industry - f.ships.reduce((x, s) => x + (ctx.aw.ships.get(s.ship)?.upkeep ?? 0) * s.count, 0) * 0.1);
  }
}

/** Coût mensuel d'une armée (affichage). */
export function armyUpkeep(aw: ArmiesWorld, a: ArmyState): number {
  return a.regiments.reduce((n, r) => n + (aw.regiments.get(r.regiment)?.upkeep ?? 0) * r.count, 0) + armyPieces(aw, a).reduce((n, p) => n + (aw.pieces.get(p.piece)?.upkeep ?? 0) * p.count, 0);
}

