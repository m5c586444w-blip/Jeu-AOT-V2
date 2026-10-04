import { Explainer } from "../core/explain";
import type { Explained } from "../core/explain";
import { Rng } from "../core/rng";
import type { GameDate } from "../core/time";
import { toAbsoluteDay } from "../core/time";
import { characterDies, stressCharacter } from "../politics/characters";
import type { PoliticalState } from "../politics/state";
import type { ShiftersState } from "../shifters/shifters";
import type { StrategicState } from "../strategic/economy";
import type { World } from "../strategic/world";
import { atWar, nationsWorld, ownerOf, pushFront, pushWorldLog } from "./nations";
import type { NationsState, Projection, Stack } from "./nations";

/**
 * Guerre moderne (P7 ; 09 F-WAR-01 à 11) : chaque semaine, chaque province disputée se résout au front
 * (puissance par arme, artillerie, supériorité aérienne, terrain, fortification, Titans projetés) ; les flottes
 * se disputent les mers. Titans comme armes stratégiques (F-WAR-08) : projection, usure, coût politique.
 */

export interface WarCtx {
  world: World;
  seed: number;
  date: GameDate;
  ns: NationsState;
  sh: ShiftersState | null;
  pol: PoliticalState | null;
  st: StrategicState | null;
}

/** Faction d'un camp de porteurs (couche P6) au monde. */
export const SIDE_TO_FACTION: Record<string, string> = { paradis: "fac_paradis", marley: "fac_marley" };

function stacksOf(ctx: WarCtx, province: string, faction: string, domain: "terre" | "mer"): { id: string; s: Stack; attack: number; defense: number; kind: string }[] {
  const nw = nationsWorld(ctx.world);
  return Object.entries(ctx.ns.forces[province] ?? {}).flatMap(([id, s]) => {
    const f = nw.formations.get(id);
    return f && f.faction === faction && f.domain === domain && s.count > 0 ? [{ id, s, attack: f.attack, defense: f.defense, kind: f.kind }] : [];
  });
}

function airOf(ctx: WarCtx, province: string, faction: string): number {
  const nw = nationsWorld(ctx.world);
  let p = 0;
  for (const [id, s] of Object.entries(ctx.ns.forces[province] ?? {})) {
    const f = nw.formations.get(id);
    if (f && f.faction === faction && f.domain === "air") p += s.count * s.strength * f.attack;
  }
  return p;
}

function projectionsAt(ctx: WarCtx, province: string, faction: string): Projection[] {
  return ctx.ns.projections.filter((p) => p.province === province && p.faction === faction && p.restUntil === null);
}

/** Puissance d'un camp dans une province, expliquée. */
export function sidePower(ctx: WarCtx, province: string, faction: string, role: "attaque" | "defense", enemy: string): Explained {
  const nw = nationsWorld(ctx.world);
  const wb = nw.balance.war;
  const e = new Explainer();
  const land = stacksOf(ctx, province, faction, "terre");
  const base = land.reduce((a, x) => a + x.s.count * x.s.strength * (role === "attaque" ? x.attack : x.defense), 0);
  e.base(role === "attaque" ? "why.war_attack" : "why.war_defense", base, { n: land.reduce((a, x) => a + x.s.count, 0) });
  const art = land.filter((x) => x.kind === "artillerie").reduce((a, x) => a + x.s.count, 0);
  const total = land.reduce((a, x) => a + x.s.count, 0);
  if (art > 0 && total > 0) e.mul("why.war_artillery", 1 + wb.artillery_mult * (art / total), { n: art });
  const air = airOf(ctx, province, faction);
  const airEnemy = airOf(ctx, province, enemy);
  if (air > airEnemy && air > 0) e.mul("why.war_air", 1 + wb.air_superiority_mult);
  if (air > 0) e.mul("why.war_recon", 1 + wb.recon_bonus);
  for (const p of projectionsAt(ctx, province, faction)) {
    const pw = nw.balance.titans.power[p.shifter] ?? 10;
    e.add("why.war_titan", pw, { titan: ctx.world.shifters?.defs.get(p.shifter)?.name_key ?? p.shifter });
  }
  if (role === "defense") {
    const wp = nw.provinces.get(province);
    if (wp) {
      e.mul("why.war_terrain", wb.terrain[wp.type] ?? 1, { terrain: wp.type });
      if (wp.fort > 0) e.mul("why.war_fort", 1 + wp.fort * wb.fort_mult);
    }
  }
  return e.done();
}

/** Pertes : chaque formation perd de son état ; sous un seuil, une formation disparaît. Renvoie le nombre de formations perdues (équivalent). */
function applyLoss(ctx: WarCtx, province: string, faction: string, domain: "terre" | "mer", share: number): number {
  let lost = 0;
  for (const x of stacksOf(ctx, province, faction, domain)) {
    x.s.strength -= share;
    lost += share * x.s.count;
    while (x.s.strength <= 0.25 && x.s.count > 0) {
      x.s.count -= 1;
      x.s.strength += 0.5;
    }
    x.s.strength = Math.min(1, Math.max(0.1, x.s.strength));
  }
  const n = ctx.ns.nations[faction];
  if (n) n.lossesMonth += lost;
  const at = ctx.ns.forces[province];
  if (at) ctx.ns.forces[province] = Object.fromEntries(Object.entries(at).filter(([, s]) => s.count > 0));
  return lost;
}

/** Les forces de terre d'un défenseur battu se replient vers une province voisine tenue ; sinon, elles sont perdues. */
function retreat(ctx: WarCtx, province: string, faction: string): void {
  const nw = nationsWorld(ctx.world);
  const to = (nw.provinces.get(province)?.adjacent ?? []).filter((a) => ctx.ns.control[a] === faction).sort()[0];
  const at = ctx.ns.forces[province] ?? {};
  for (const [id, s] of Object.entries(at)) {
    const f = nw.formations.get(id);
    if (!f || f.faction !== faction || f.domain !== "terre") continue;
    if (to) {
      const dest = (ctx.ns.forces[to] ??= {});
      const cur = dest[id];
      dest[id] = cur ? { count: cur.count + s.count, strength: (cur.strength * cur.count + s.strength * s.count) / (cur.count + s.count), moves: 0 } : { ...s, moves: 0 };
    }
    s.count = 0;
  }
  ctx.ns.forces[province] = Object.fromEntries(Object.entries(at).filter(([, s]) => s.count > 0));
}

/** Semaine de guerre : provinces disputées, puis mers ; usure et pertes des Titans projetés. */
export function weeklyWar(ctx: WarCtx): void {
  const nw = nationsWorld(ctx.world);
  const wb = nw.balance.war;
  const day = toAbsoluteDay(ctx.date);
  const rng = new Rng(ctx.seed).fork(`front:${day}`);
  for (const p of nw.order) {
    if (p.faction === "mer") continue;
    const owner = ctx.ns.control[p.id];
    if (!owner) continue;
    const factions = [...new Set(Object.entries(ctx.ns.forces[p.id] ?? {}).filter(([, s]) => s.count > 0).map(([id]) => ownerOf(ctx.world, id) ?? ""))].filter((f) => f && f !== owner && atWar(ctx.ns, f, owner)).sort();
    const projected = [...new Set(ctx.ns.projections.filter((x) => x.province === p.id && x.restUntil === null).map((x) => x.faction))].filter((f) => f !== owner && atWar(ctx.ns, f, owner));
    const attackers = [...new Set([...factions, ...projected])].sort();
    for (const attacker of attackers) {
      const att = sidePower(ctx, p.id, attacker, "attaque", owner);
      const def = sidePower(ctx, p.id, owner, "defense", attacker);
      const a = Math.max(0.1, att.value);
      const d = Math.max(0.1, def.value);
      const noise = 0.85 + 0.3 * rng.next();
      const attLoss = Math.min(0.5, wb.base_losses * Math.sqrt(d / a) * noise);
      const defLoss = Math.min(0.5, wb.base_losses * Math.sqrt(a / d) / noise);
      const al = applyLoss(ctx, p.id, attacker, "terre", attLoss);
      const dl = applyLoss(ctx, p.id, owner, "terre", defLoss);
      const defenders = Object.entries(ctx.ns.forces[p.id] ?? {}).some(([id, s]) => s.count > 0 && ownerOf(ctx.world, id) === owner && nw.formations.get(id)?.domain === "terre");
      const attackersLand = Object.entries(ctx.ns.forces[p.id] ?? {}).some(([id, s]) => s.count > 0 && ownerOf(ctx.world, id) === attacker && nw.formations.get(id)?.domain === "terre");
      const captured = attackersLand && (!defenders || a / d >= wb.capture_ratio);
      pushFront(ctx.ns, { day, province: p.id, attacker, defender: owner, attackPower: att, defensePower: def, attackerLoss: Math.round(al * 10) / 10, defenderLoss: Math.round(dl * 10) / 10, captured });
      if (captured) {
        retreat(ctx, p.id, owner);
        ctx.ns.control[p.id] = attacker;
        pushWorldLog(ctx.ns, day, "world.log.captured", { province: p.name_key, attacker: nw.factions.get(attacker)?.name_key ?? attacker, defender: nw.factions.get(owner)?.name_key ?? owner });
        const wa = ctx.ns.nations[attacker];
        if (wa) wa.warSupport = Math.min(100, wa.warSupport + 2);
        break;
      }
    }
  }
  // Mers : deux flottes en guerre dans une même zone se battent (F-WAR-04).
  for (const p of nw.order) {
    if (p.faction !== "mer") continue;
    const fleets = [...new Set(Object.entries(ctx.ns.forces[p.id] ?? {}).filter(([id, s]) => s.count > 0 && nw.formations.get(id)?.domain === "mer").map(([id]) => ownerOf(ctx.world, id) ?? ""))].sort();
    for (let i = 0; i < fleets.length; i++)
      for (let j = i + 1; j < fleets.length; j++) {
        const fa = fleets[i] as string;
        const fb = fleets[j] as string;
        if (!atWar(ctx.ns, fa, fb)) continue;
        const pa = stacksOf(ctx, p.id, fa, "mer").reduce((x, y) => x + y.s.count * y.s.strength * (y.attack + y.defense), 0) + projectionsAt(ctx, p.id, fa).reduce((x, y) => x + (nw.balance.titans.power[y.shifter] ?? 0), 0);
        const pb = stacksOf(ctx, p.id, fb, "mer").reduce((x, y) => x + y.s.count * y.s.strength * (y.attack + y.defense), 0) + projectionsAt(ctx, p.id, fb).reduce((x, y) => x + (nw.balance.titans.power[y.shifter] ?? 0), 0);
        const la = Math.min(0.6, wb.base_losses * 1.5 * Math.sqrt(Math.max(0.1, pb) / Math.max(0.1, pa)));
        const lb = Math.min(0.6, wb.base_losses * 1.5 * Math.sqrt(Math.max(0.1, pa) / Math.max(0.1, pb)));
        applyLoss(ctx, p.id, fa, "mer", la);
        applyLoss(ctx, p.id, fb, "mer", lb);
        pushWorldLog(ctx.ns, day, "world.log.naval", { sea: p.name_key, a: nw.factions.get(fa)?.name_key ?? fa, b: nw.factions.get(fb)?.name_key ?? fb });
      }
  }
  weeklyTitans(ctx, rng);
  // Repos : l'état des formations hors combat remonte lentement.
  const fought = new Set(ctx.ns.fronts.filter((f) => f.day === day).map((f) => f.province));
  for (const [p, at] of Object.entries(ctx.ns.forces)) if (!fought.has(p)) for (const s of Object.values(at)) s.strength = Math.min(1, s.strength + wb.strength_regen_per_week);
}

/** Usure des porteurs projetés : stress chaque semaine, risque de mort au front (le Titan est alors perdu, P6). */
function weeklyTitans(ctx: WarCtx, rng: Rng): void {
  const tb = nationsWorld(ctx.world).balance.titans;
  const day = toAbsoluteDay(ctx.date);
  for (const p of ctx.ns.projections) {
    if (p.restUntil !== null) continue;
    const holder = ctx.sh?.titans[p.shifter]?.holder ?? null;
    if (!holder || !ctx.pol?.characters[holder]?.alive) {
      p.restUntil = day;
      continue;
    }
    stressCharacter(ctx.world, ctx.pol, holder, tb.stress_per_week);
    const contested = ctx.ns.fronts.some((f) => f.day === day && f.province === p.province);
    if (contested && rng.next() < tb.death_chance_per_week && ctx.st) {
      const r = characterDies(ctx.world, ctx.pol, ctx.st, ctx.date, holder, "combat", "world.titan_fell");
      ctx.pol = r.state;
      ctx.st = r.strategic;
      p.restUntil = day;
      pushWorldLog(ctx.ns, day, "world.log.titan_fell", { titan: ctx.world.shifters?.defs.get(p.shifter)?.name_key ?? p.shifter });
    }
  }
  ctx.ns.projections = ctx.ns.projections.filter((p) => p.restUntil === null || p.restUntil > day - 7 * tb.rest_weeks);
}

/** Raison pour laquelle un Titan ne peut pas être projeté, ou null. */
export function projectProblem(world: World, ns: NationsState, sh: ShiftersState | null, pol: PoliticalState | null, faction: string, shifter: string, province: string, date: GameDate): string | null {
  const nw = nationsWorld(world);
  const slot = sh?.titans[shifter];
  if (!slot) return "shifter.err.unknown";
  if (SIDE_TO_FACTION[slot.faction] !== faction) return "world.err.titan_not_ours";
  if (!slot.holder || !pol?.characters[slot.holder]?.alive) return "shifter.err.no_holder";
  if (slot.retired) return "world.err.titan_retired";
  const day = toAbsoluteDay(date);
  const cur = ns.projections.find((p) => p.shifter === shifter);
  if (cur && cur.restUntil === null) return "world.err.titan_engaged";
  if (cur && cur.restUntil !== null && cur.restUntil + 7 * nw.balance.titans.rest_weeks > day) return "world.err.titan_resting";
  const p = nw.provinces.get(province);
  if (!p) return "world.err.not_adjacent";
  // Projection : là où la nation tient le terrain ou a des forces, ou sur une province voisine (porteurs transportés, F-WAR-08).
  const reach = ns.control[province] === faction || Object.keys(ns.forces[province] ?? {}).some((id) => ownerOf(world, id) === faction) || p.adjacent.some((a) => ns.control[a] === faction || Object.keys(ns.forces[a] ?? {}).some((id) => ownerOf(world, id) === faction));
  if (!reach) return "world.err.titan_out_of_reach";
  return null;
}

/** Projection d'un Titan (F-WAR-08) : coût politique immédiat — peur des autres nations, soutien chez soi, légitimité à Paradis. */
export function projectTitan(world: World, ns: NationsState, pol: PoliticalState | null, faction: string, shifter: string, province: string, date: GameDate): void {
  const nw = nationsWorld(world);
  const tb = nw.balance.titans;
  const day = toAbsoluteDay(date);
  ns.projections = ns.projections.filter((p) => p.shifter !== shifter);
  ns.projections.push({ shifter, faction, province, since: day, restUntil: null });
  for (const other of nw.factions.keys()) {
    if (other === faction) continue;
    const r = ns.relations[other]?.[faction];
    if (r) r.fear = Math.min(100, r.fear + tb.fear_others);
  }
  const n = ns.nations[faction];
  if (n) n.warSupport = Math.min(100, n.warSupport + tb.war_support_self);
  if (faction === "fac_paradis" && pol) pol.legitimacy = Math.max(0, pol.legitimacy - tb.legitimacy_cost);
  pushWorldLog(ns, day, "world.log.titan_projected", { titan: world.shifters?.defs.get(shifter)?.name_key ?? shifter, province: nw.provinces.get(province)?.name_key ?? province, faction: nw.factions.get(faction)?.name_key ?? faction });
}

/** Rappel d'un Titan : repos forcé (usure) avant une nouvelle projection. */
export function recallTitan(ns: NationsState, shifter: string, date: GameDate): boolean {
  const p = ns.projections.find((x) => x.shifter === shifter && x.restUntil === null);
  if (!p) return false;
  p.restUntil = toAbsoluteDay(date);
  return true;
}
