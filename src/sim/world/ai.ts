import type { GameDate } from "../core/time";
import { toAbsoluteDay } from "../core/time";
import type { PoliticalState } from "../politics/state";
import type { ShiftersState } from "../shifters/shifters";
import type { World } from "../strategic/world";
import { accepts, declareWar, makePeace, proposeTreaty } from "./diplomacy";
import { atWar, buildProblem, hasTreaty, moveForces, moveProblem, nationIncome, nationsWorld, nationUpkeep, orderBuild, ownerOf, pushAi } from "./nations";
import type { StrategicState } from "../strategic/economy";
import type { NationsState } from "./nations";
import { projectProblem, projectTitan, sidePower, SIDE_TO_FACTION } from "./war";

/**
 * IA des nations (02 §14) : modèle d'utilité simple et règles. Personnalités (prudent, agressif…) et attracteurs canon
 * (Marley veut le Fondateur ; Hizuru cherche des garanties) orientent sans scénariser. Chaque décision est consignée
 * avec ses raisons (journal de raisonnement, visible en débogage).
 */

export interface AiCtx {
  world: World;
  date: GameDate;
  ns: NationsState;
  sh: ShiftersState | null;
  pol: PoliticalState | null;
  st: StrategicState | null;
}

function weights(ctx: AiCtx, faction: string): { attack: number; build: number; diplomacy: number; caution: number } {
  const nw = nationsWorld(ctx.world);
  const p = nw.factions.get(faction)?.personality ?? "pragmatique";
  return nw.balance.ai.personality[p] ?? { attack: 1, build: 1, diplomacy: 1, caution: 1 };
}

function landPower(ctx: AiCtx, province: string, faction: string, role: "attack" | "defense"): number {
  const nw = nationsWorld(ctx.world);
  let p = 0;
  for (const [id, s] of Object.entries(ctx.ns.forces[province] ?? {})) {
    const f = nw.formations.get(id);
    if (f && f.faction === faction && f.domain === "terre") p += s.count * s.strength * f[role];
  }
  return p;
}

/** Décisions mensuelles d'une nation non jouée : guerre, paix, traités, levées, Titans. */
export function monthlyAi(ctx: AiCtx): void {
  const nw = nationsWorld(ctx.world);
  const day = toAbsoluteDay(ctx.date);
  for (const f of [...nw.factions.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    if (f.id === ctx.ns.player) continue;
    const n = ctx.ns.nations[f.id];
    if (!n) continue;
    const w = weights(ctx, f.id);
    // Paix : lassitude et rapport de force.
    for (const war of ctx.ns.wars.filter((x) => x.split("|").includes(f.id))) {
      const other = war.split("|").find((x) => x !== f.id) ?? "";
      const u = (50 - n.warSupport) * w.caution + (n.stability < 30 ? 20 : 0);
      if (u > 15) {
        const res = makePeace(ctx.world, ctx.ns, f.id, other, ctx.date);
        pushAi(ctx.ns, { day, faction: f.id, action: `paix:${other}:${res.ok ? "oui" : "non"}`, utility: u, reasons: [{ key: "ai.weariness", value: 50 - n.warSupport }, { key: "ai.caution", value: w.caution }] });
      }
    }
    // Guerre : attracteur canon (Marley et le Fondateur), soutien populaire, guerres en cours.
    if (f.attractors.includes("fondateur") && !atWar(ctx.ns, f.id, "fac_paradis")) {
      const busy = ctx.ns.wars.filter((x) => x.split("|").includes(f.id)).length;
      const u = nw.balance.ai.attractor_bonus * w.attack + (n.warSupport - 50) / 2 - busy * 30;
      pushAi(ctx.ns, { day, faction: f.id, action: u > 20 ? "guerre:fac_paradis" : "attendre:fac_paradis", utility: u, reasons: [{ key: "ai.attractor_fondateur", value: nw.balance.ai.attractor_bonus * w.attack }, { key: "ai.war_support", value: (n.warSupport - 50) / 2 }, { key: "ai.other_wars", value: -busy * 30 }] });
      if (u > 20) declareWar(ctx.world, ctx.ns, f.id, "fac_paradis", ctx.date);
    }
    // Traités : commerce avec qui y trouve intérêt ; Hizuru cherche des garanties.
    for (const o of nw.factions.keys()) {
      if (o === f.id || atWar(ctx.ns, f.id, o) || hasTreaty(ctx.ns, "commerce", f.id, o)) continue;
      const r = ctx.ns.relations[f.id]?.[o];
      if (!r || r.interest < 30) continue;
      const u = r.interest * w.diplomacy - 20;
      if (u > 10 && accepts(ctx.world, ctx.ns, f.id, o, "commerce").ok) {
        proposeTreaty(ctx.world, ctx.ns, f.id, o, "commerce", ctx.date);
        pushAi(ctx.ns, { day, faction: f.id, action: `commerce:${o}`, utility: u, reasons: [{ key: "ai.interest", value: r.interest }, { key: "ai.diplomacy", value: w.diplomacy }] });
      }
    }
    // Levées : garder une réserve ; renforcer la province frontière la plus menacée, ou le port d'embarquement d'une invasion.
    const reserve = nw.balance.ai.min_reserve_industry;
    const plan = invasionPlan(ctx, f.id);
    if (plan) stageInvasion(ctx, f.id, plan, w, day);
    const front = plan ? null : frontProvince(ctx, f.id);
    const inf = [...nw.formations.values()].filter((x) => x.faction === f.id && x.enabled && x.domain === "terre" && x.attack + x.defense > 0).sort((a, b) => (b.attack + b.defense) / (b.cost.industry + 1) - (a.attack + a.defense) / (a.cost.industry + 1) || a.id.localeCompare(b.id))[0];
    // On ne lève que ce que le revenu peut entretenir (sinon pénurie et usure de toutes les formations).
    const margin = nationIncome(ctx.world, ctx.ns, f.id, ctx.st).industry.value * 0.8 - nationUpkeep(ctx.world, ctx.ns, f.id).value;
    if (front && inf && n.industry - inf.cost.industry * 2 > reserve * w.caution && margin > inf.upkeep) {
      const count = Math.max(1, Math.min(4, Math.floor((n.industry - reserve) / Math.max(1, inf.cost.industry) / 2), Math.floor(margin / Math.max(1, inf.upkeep))));
      if (!buildProblem(ctx.world, ctx.ns, f.id, inf.id, front, count)) {
        orderBuild(ctx.world, ctx.ns, f.id, inf.id, front, count, ctx.date);
        pushAi(ctx.ns, { day, faction: f.id, action: `lever:${inf.id}:${count}:${front}`, utility: count * w.build, reasons: [{ key: "ai.industry", value: Math.round(n.industry) }, { key: "ai.build", value: w.build }] });
      }
    }
  }
}

/** Province tenue la plus exposée (voisine d'un ennemi en guerre), sinon la mieux défendue. */
function frontProvince(ctx: AiCtx, faction: string): string | null {
  const nw = nationsWorld(ctx.world);
  let best: { id: string; score: number } | null = null;
  for (const p of nw.order) {
    if (ctx.ns.control[p.id] !== faction) continue;
    const threat = p.adjacent.reduce((a, x) => {
      const o = ctx.ns.control[x];
      return a + (o && o !== faction && atWar(ctx.ns, o, faction) ? 10 + landPower(ctx, x, o, "attack") : 0);
    }, 0);
    const score = threat * 10 + landPower(ctx, p.id, faction, "defense") * 0.01 + (p.type === "urbain" ? 0.1 : 0);
    if (!best || score > best.score || (score === best.score && p.id < best.id)) best = { id: p.id, score };
  }
  return best?.id ?? null;
}

/** Mouvements hebdomadaires : attaquer une province ennemie voisine quand le rapport de force le permet ; projeter un Titan. */
export function weeklyAi(ctx: AiCtx): void {
  const nw = nationsWorld(ctx.world);
  const day = toAbsoluteDay(ctx.date);
  for (const f of [...nw.factions.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    if (f.id === ctx.ns.player) continue;
    const w = weights(ctx, f.id);
    for (const p of nw.order) {
      if (ctx.ns.control[p.id] !== f.id) continue;
      const mine = landPower(ctx, p.id, f.id, "attack");
      if (mine <= 0) continue;
      for (const target of [...p.adjacent].sort()) {
        const owner = ctx.ns.control[target];
        if (!owner || owner === f.id || !atWar(ctx.ns, owner, f.id)) continue;
        const def = landPower(ctx, target, owner, "defense") * (1 + (nw.provinces.get(target)?.fort ?? 0)) + 1;
        const ratio = (mine * 0.7) / def;
        const u = ratio * w.attack - w.caution;
        if (u <= 0.3) continue;
        // Avance des formations de terre (on garde un tiers en place).
        for (const [id, s] of Object.entries(ctx.ns.forces[p.id] ?? {})) {
          const fd = nw.formations.get(id);
          if (!fd || fd.faction !== f.id || fd.domain !== "terre") continue;
          const k = Math.floor((s.count * 2) / 3);
          if (k >= 1 && !moveProblem(ctx.world, ctx.ns, f.id, id, p.id, target, k)) moveForces(ctx.world, ctx.ns, id, p.id, target, k);
        }
        pushAi(ctx.ns, { day, faction: f.id, action: `attaquer:${target}`, utility: u, reasons: [{ key: "ai.ratio", value: Math.round(ratio * 100) / 100 }, { key: "ai.attack", value: w.attack }, { key: "ai.caution", value: -w.caution }] });
        break;
      }
    }
    // Invasion amphibie : embarquer, naviguer, débarquer (P9.2).
    amphibious(ctx, f.id, w.caution, day);
    // Titans : projeter un porteur libre là où l'on se bat (Marley : armes stratégiques, 02 §11).
    for (const [shifter, slot] of Object.entries(ctx.sh?.titans ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
      if (SIDE_TO_FACTION[slot.faction] !== f.id) continue;
      const contested = [...new Set(ctx.ns.fronts.filter((x) => x.day > day - 8 && (x.attacker === f.id || x.defender === f.id)).map((x) => x.province))].sort()[0];
      if (!contested) continue;
      if (projectProblem(ctx.world, ctx.ns, ctx.sh, ctx.pol, f.id, shifter, contested, ctx.date)) continue;
      projectTitan(ctx.world, ctx.ns, ctx.pol, f.id, shifter, contested, ctx.date);
      pushAi(ctx.ns, { day, faction: f.id, action: `titan:${shifter}:${contested}`, utility: w.attack, reasons: [{ key: "ai.front", value: 1 }] });
      break;
    }
  }
}

// ——— Invasion amphibie (P9.2 ; 02 §14 : « Marley : invasion amphibie, projection de Titans ») ———

/** Plan d'une invasion : île ennemie visée, port d'embarquement et route de mer (zones à traverser, dans l'ordre). */
export interface InvasionPlan {
  target: string;
  port: string;
  seas: string[];
}

const isSea = (ctx: AiCtx, id: string): boolean => nationsWorld(ctx.world).provinces.get(id)?.faction === "mer";

/** Route de mer la plus courte d'une province (port ou zone) vers une zone voisine de la cible ; null sans route. */
function seaPath(ctx: AiCtx, from: string, target: string): string[] | null {
  const nw = nationsWorld(ctx.world);
  const goal = new Set((nw.provinces.get(target)?.adjacent ?? []).filter((a) => isSea(ctx, a)));
  if (goal.size === 0) return null;
  const prev = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (id !== from && goal.has(id)) {
      const path: string[] = [];
      for (let c: string | null = id; c !== null && c !== from; c = prev.get(c) ?? null) path.unshift(c);
      return path;
    }
    for (const a of [...(nw.provinces.get(id)?.adjacent ?? [])].sort()) {
      if (prev.has(a) || !isSea(ctx, a)) continue;
      prev.set(a, id);
      queue.push(a);
    }
  }
  return null;
}

/**
 * Une nation attirée par le Fondateur (attracteur « fondateur »), en guerre avec son détenteur, vise l'île de celui-ci quand
 * aucune province à elle n'y touche par la terre : port d'embarquement = son port côtier le plus proche par la mer.
 */
export function invasionPlan(ctx: AiCtx, faction: string): InvasionPlan | null {
  const nw = nationsWorld(ctx.world);
  if (!nw.balance.ai.invasion || !nw.factions.get(faction)?.attractors.includes("fondateur")) return null;
  // La nation qui tient le Fondateur (couche des porteurs).
  const holder = SIDE_TO_FACTION[ctx.sh?.titans["shifter_fondateur"]?.faction ?? ""];
  if (!holder || holder === faction || !atWar(ctx.ns, holder, faction)) return null;
  for (const t of nw.order) {
    const owner = ctx.ns.control[t.id];
    if (owner !== holder || !t.coastal) continue;
    if (t.adjacent.some((a) => ctx.ns.control[a] === faction)) continue;
    let best: InvasionPlan | null = null;
    for (const p of nw.order) {
      if (ctx.ns.control[p.id] !== faction || !p.coastal) continue;
      const seas = seaPath(ctx, p.id, t.id);
      if (seas && (!best || seas.length < best.seas.length)) best = { target: t.id, port: p.id, seas };
    }
    if (best) return best;
  }
  return null;
}

/** Puissance d'attaque de terre qu'une nation peut embarquer depuis une province (garnison laissée), et celle de ses Titans libres. */
function landingPower(ctx: AiCtx, faction: string, province: string, keep: number): { troops: number; titans: number } {
  const nw = nationsWorld(ctx.world);
  let troops = 0;
  for (const [id, st] of Object.entries(ctx.ns.forces[province] ?? {})) {
    const f = nw.formations.get(id);
    if (f && f.faction === faction && f.domain === "terre" && f.attack > 0) troops += Math.floor(st.count * (1 - keep)) * st.strength * f.attack;
  }
  const day = toAbsoluteDay(ctx.date);
  let titans = 0;
  for (const [shifter, slot] of Object.entries(ctx.sh?.titans ?? {})) {
    if (SIDE_TO_FACTION[slot.faction] !== faction || !slot.holder || !ctx.pol?.characters[slot.holder]?.alive || slot.retired) continue;
    const cur = ctx.ns.projections.find((x) => x.shifter === shifter);
    if (cur && (cur.restUntil === null || cur.restUntil + 7 * nw.balance.titans.rest_weeks > day)) continue;
    titans += nw.balance.titans.power[shifter] ?? 0;
  }
  return { troops, titans };
}

/** Levées mensuelles au port d'embarquement : troupes d'assaut, et des transports s'il n'y en a pas. */
function stageInvasion(ctx: AiCtx, faction: string, plan: InvasionPlan, w: { build: number }, day: number): void {
  const nw = nationsWorld(ctx.world);
  const inv = nw.balance.ai.invasion;
  const n = ctx.ns.nations[faction];
  if (!inv || !n) return;
  const margin = nationIncome(ctx.world, ctx.ns, faction, ctx.st).industry.value * 0.8 - nationUpkeep(ctx.world, ctx.ns, faction).value;
  const own = (kind: string): boolean => Object.entries(ctx.ns.forces[plan.port] ?? {}).some(([id, x]) => x.count > 0 && nw.formations.get(id)?.kind === kind && nw.formations.get(id)?.faction === faction);
  const pick = (pred: (x: { domain: string; kind: string; attack: number; cost: { industry: number } }) => boolean): string | null =>
    [...nw.formations.values()].filter((x) => x.faction === faction && x.enabled && pred(x)).sort((a, b) => b.attack / (b.cost.industry + 1) - a.attack / (a.cost.industry + 1) || a.id.localeCompare(b.id))[0]?.id ?? null;
  const transport = own("transports") ? null : pick((x) => x.kind === "transports");
  const troops = pick((x) => x.domain === "terre" && x.attack > 0);
  for (const [formation, count] of [[transport, 1], [troops, inv.levee_max]] as const) {
    if (!formation) continue;
    const fd = nw.formations.get(formation);
    if (!fd || n.industry - fd.cost.industry * count < nw.balance.ai.min_reserve_industry || margin < fd.upkeep * count) continue;
    if (buildProblem(ctx.world, ctx.ns, faction, formation, plan.port, count)) continue;
    orderBuild(ctx.world, ctx.ns, faction, formation, plan.port, count, ctx.date);
    pushAi(ctx.ns, { day, faction, action: `lever:${formation}:${count}:${plan.port}`, utility: count * w.build, reasons: [{ key: "ai.invasion_staging", value: 1 }, { key: "ai.industry", value: Math.round(n.industry) }] });
  }
}

/** Déplace toutes les formations d'un domaine d'une nation d'une province à une autre (part `share` des troupes de terre). */
function moveAll(ctx: AiCtx, faction: string, from: string, to: string, domain: "terre" | "mer", share: number): number {
  const nw = nationsWorld(ctx.world);
  let moved = 0;
  for (const [id, st] of Object.entries(ctx.ns.forces[from] ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    const fd = nw.formations.get(id);
    if (!fd || fd.faction !== faction || fd.domain !== domain || (domain === "terre" && fd.attack <= 0)) continue;
    const k = domain === "terre" ? Math.floor(st.count * share) : st.count;
    if (k >= 1 && !moveProblem(ctx.world, ctx.ns, faction, id, from, to, k)) {
      moveForces(ctx.world, ctx.ns, id, from, to, k);
      moved += k;
    }
  }
  return moved;
}

/**
 * Semaine d'une invasion : les troupes déjà en mer avancent d'une zone (puis débarquent) ; sinon, au port, on embarque quand la
 * puissance d'assaut (Titans libres compris) dépasse la défense de l'île × seuil de prise × marge. Chaque pas est consigné.
 */
function amphibious(ctx: AiCtx, faction: string, caution: number, day: number): void {
  const nw = nationsWorld(ctx.world);
  const inv = nw.balance.ai.invasion;
  const plan = inv ? invasionPlan(ctx, faction) : null;
  if (!inv || !plan) return;
  const afloat = nw.order.filter((p) => p.faction === "mer" && Object.entries(ctx.ns.forces[p.id] ?? {}).some(([id, x]) => x.count > 0 && ownerOf(ctx.world, id) === faction && nw.formations.get(id)?.domain === "terre"));
  for (const sea of afloat) {
    if ((nw.provinces.get(plan.target)?.adjacent ?? []).includes(sea.id)) {
      const n = moveAll(ctx, faction, sea.id, plan.target, "terre", 1);
      pushAi(ctx.ns, { day, faction, action: `debarquer:${plan.target}:${n}`, utility: n, reasons: [{ key: "ai.invasion_landing", value: n }] });
      continue;
    }
    const next = seaPath(ctx, sea.id, plan.target)?.[0];
    if (!next) continue;
    moveAll(ctx, faction, sea.id, next, "terre", 1);
    moveAll(ctx, faction, sea.id, next, "mer", 1);
    pushAi(ctx.ns, { day, faction, action: `naviguer:${next}`, utility: 1, reasons: [{ key: "ai.invasion_route", value: 1 }] });
  }
  if (afloat.length > 0) return;
  const first = plan.seas[0];
  if (!first) return;
  const { troops, titans } = landingPower(ctx, faction, plan.port, inv.garnison);
  const def = sidePower({ world: ctx.world, ns: ctx.ns, sh: ctx.sh, pol: ctx.pol, st: ctx.st, date: ctx.date, seed: 0 }, plan.target, ctx.ns.control[plan.target] ?? "", "defense", faction).value;
  const need = def * nw.balance.war.capture_ratio * inv.marge * caution;
  const transports = Object.entries(ctx.ns.forces[plan.port] ?? {}).some(([id, x]) => x.count > 0 && nw.formations.get(id)?.kind === "transports" && nw.formations.get(id)?.faction === faction);
  // Les troupes doivent porter au moins la moitié de l'effort : les Titans ne tiennent pas une île seuls.
  const ready = transports && troops >= need / 2 && troops + titans >= need;
  if (ready || day % 30 < 7) pushAi(ctx.ns, { day, faction, action: ready ? `embarquer:${plan.port}:${plan.target}` : `preparer:${plan.target}`, utility: Math.round(((troops + titans) / Math.max(1, need)) * 100) / 100, reasons: [{ key: "ai.invasion_troops", value: Math.round(troops) }, { key: "ai.invasion_titans", value: Math.round(titans) }, { key: "ai.invasion_need", value: -Math.round(need) }] });
  if (!ready) return;
  moveAll(ctx, faction, plan.port, first, "terre", 1 - inv.garnison);
  moveAll(ctx, faction, plan.port, first, "mer", 1);
}
