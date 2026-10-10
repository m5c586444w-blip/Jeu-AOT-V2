import { toAbsoluteDay } from "../core/time";
import { shortestRoute } from "../military/routes";
import type { ArmyCtx } from "./armies";
import { applyOrder, findArmy, geoOf, orderProblem, visibleProvinces } from "./armies";
import { armyMen, armyPieces, hostile, playerOf } from "./state";
import type { ArmyAiDecision, ArmyState, FleetState } from "./state";
import type { GeoGraph } from "../strategic/world";

/**
 * IA des armées (PA.7) : règles simples, chaque décision consignée avec ses raisons (journal de raisonnement, mode auteur).
 * Marley : approcher la côte la moins défendue, débarquer si le rapport de force le permet, marcher sur un mur et l'assiéger
 * avec son artillerie, attaquer une armée plus faible. Paradis (quand il n'est pas joué) : intercepter une menace à sa
 * portée, sinon tenir derrière un mur avec ses canons.
 */

function push(ctx: ArmyCtx, d: Omit<ArmyAiDecision, "day">): void {
  ctx.s.ai.push({ day: toAbsoluteDay(ctx.date), ...d });
  const cap = ctx.aw.balance.ai.decision_cap;
  if (ctx.s.ai.length > cap) ctx.s.ai.splice(0, ctx.s.ai.length - cap);
}

/** Force d'une armée pour l'IA : hommes × attaque et défense, moral, artillerie. */
export function armyStrength(ctx: Pick<ArmyCtx, "aw">, a: ArmyState): number {
  let v = 0;
  for (const r of a.regiments) {
    const d = ctx.aw.regiments.get(r.regiment);
    if (d) v += (d.men * r.count * r.strength * (d.attack + d.defense)) / 200;
  }
  const art = armyPieces(ctx.aw, a).reduce((n, p) => n + p.count * (ctx.aw.pieces.get(p.piece)?.blast_m ?? 0), 0);
  return v * (0.5 + a.morale / 100) * (1 + ctx.aw.balance.combat.artillery_weight * Math.min(1, art / 100));
}

/** Défense de Paradis autour d'une province (armées et garnisons, rayon 1). */
function paradisDefense(ctx: ArmyCtx, p: string): number {
  const g = geoOf(ctx.world);
  const around = new Set([p, ...(g.adj.get(p) ?? []).map((e) => e.to)]);
  let v = 0;
  for (const a of ctx.s.armies) if (a.faction === "fac_paradis" && a.province && around.has(a.province)) v += armyStrength(ctx, a);
  for (const q of around) v += (ctx.st.provinces[q]?.garrison?.soldiers ?? 0) / 40;
  return v;
}

function order(ctx: ArmyCtx, faction: string, o: Parameters<typeof applyOrder>[1]): boolean {
  if (orderProblem(ctx, faction, o)) return false;
  applyOrder(ctx, o);
  return true;
}

/**
 * Longueurs de route mémorisées par graphe (P10.3) : le graphe de routage est construit au chargement du monde et jamais
 * modifié, la longueur d'un trajet ne change donc pas d'un jour à l'autre ; chaque paire n'est calculée qu'une fois. Même
 * résultat qu'un calcul à chaque appel (empreintes inchangées) ; le tick de 854 repasse sous le budget de 8 ms.
 */
const ROUTE_LENGTHS = new WeakMap<GeoGraph, Map<string, number>>();

function routeLength(ctx: ArmyCtx, from: string, to: string): number {
  const g = geoOf(ctx.world);
  let known = ROUTE_LENGTHS.get(g);
  if (!known) {
    known = new Map();
    ROUTE_LENGTHS.set(g, known);
  }
  const k = `${from}>${to}`;
  let v = known.get(k);
  if (v === undefined) {
    v = shortestRoute(g, from, to)?.length ?? 999;
    known.set(k, v);
  }
  return v;
}

/** Province d'où assiéger le segment de mur de Paradis le plus proche (voisine du segment, hors mur). */
function siegeSpot(ctx: ArmyCtx, a: ArmyState): string | null {
  const g = geoOf(ctx.world);
  let best: { p: string; d: number } | null = null;
  for (const [seg, node] of [...g.nodes].sort(([x], [y]) => x.localeCompare(y))) {
    if (!node.zone.startsWith("mur_") || ctx.st.provinces[seg]?.control !== "paradis") continue;
    for (const e of g.adj.get(seg) ?? []) {
      if ((g.nodes.get(e.to)?.zone ?? "").startsWith("mur_") || !a.province) continue;
      const d = e.to === a.province ? 0 : routeLength(ctx, a.province, e.to);
      if (!best || d < best.d || (d === best.d && e.to < best.p)) best = { p: e.to, d };
    }
  }
  return best?.p ?? null;
}

export function dailyArmyAi(ctx: ArmyCtx): void {
  const player = playerOf(ctx.ns);
  // Flottes chargées : approche de la côte la plus faible, puis débarquement.
  for (const f of [...ctx.s.fleets].sort((x, y) => x.id.localeCompare(y.id))) {
    if (f.faction === player || f.route.length > 0 || f.embarked.length === 0 || !hostile(ctx.ns, f.faction, "fac_paradis")) continue;
    fleetAi(ctx, f);
  }
  for (const a of [...ctx.s.armies].sort((x, y) => x.id.localeCompare(y.id))) {
    if (a.faction === player || a.engaged || a.fleet || !a.province || a.route.length > 0 || a.target) continue;
    if (a.faction === "fac_paradis") paradisAi(ctx, a);
    else if (hostile(ctx.ns, a.faction, "fac_paradis")) invaderAi(ctx, a);
  }
}

function fleetAi(ctx: ArmyCtx, f: FleetState): void {
  const b = ctx.aw.balance.ai;
  const own = f.embarked.reduce((n, id) => {
    const a = findArmy(ctx.s, id);
    return n + (a ? armyStrength(ctx, a) : 0);
  }, 0);
  let best: { sea: string; coast: string; def: number } | null = null;
  for (const sea of [...ctx.aw.seas.values()].sort((x, y) => x.id.localeCompare(y.id))) {
    if (sea.offmap) continue;
    for (const c of [...sea.coasts].sort()) {
      const def = paradisDefense(ctx, c);
      if (!best || def < best.def) best = { sea: sea.id, coast: c, def };
    }
  }
  if (!best) return;
  const ratio = own / Math.max(1, best.def);
  if (f.sea !== best.sea) {
    if (order(ctx, f.faction, { type: "FleetMove", fleet: f.id, to: best.sea })) push(ctx, { faction: f.faction, army: f.id, action: `approche:${best.sea}`, reasons: [{ key: "ai.landing_defense", value: Math.round(best.def) }, { key: "ai.ratio", value: Math.round(ratio * 100) / 100 }] });
    return;
  }
  if (ratio < b.landing_min_ratio) {
    push(ctx, { faction: f.faction, army: f.id, action: "attendre", reasons: [{ key: "ai.ratio", value: Math.round(ratio * 100) / 100 }, { key: "ai.landing_min", value: b.landing_min_ratio }] });
    return;
  }
  for (const id of [...f.embarked]) if (order(ctx, f.faction, { type: "FleetLand", fleet: f.id, army: id, province: best.coast })) push(ctx, { faction: f.faction, army: id, action: `debarquer:${best.coast}`, reasons: [{ key: "ai.ratio", value: Math.round(ratio * 100) / 100 }, { key: "ai.landing_defense", value: Math.round(best.def) }] });
}

function invaderAi(ctx: ArmyCtx, a: ArmyState): void {
  const b = ctx.aw.balance;
  if (a.morale < b.morale.rout_below + 10 || a.supply < 2) {
    push(ctx, { faction: a.faction, army: a.id, action: "tenir", reasons: [{ key: "ai.morale", value: Math.round(a.morale) }, { key: "ai.supply", value: Math.round(a.supply) }] });
    return;
  }
  const seen = visibleProvinces(ctx, a.faction);
  const mine = armyStrength(ctx, a);
  const prey = ctx.s.armies
    .filter((x) => x.faction === "fac_paradis" && x.province && seen.has(x.province) && !x.fleet)
    .map((x) => ({ x, d: routeLength(ctx, a.province as string, x.province as string), r: mine / Math.max(1, armyStrength(ctx, x)) }))
    .filter((y) => y.d <= 4 && y.r >= b.ai.attack_ratio)
    .sort((p, q) => p.d - q.d || p.x.id.localeCompare(q.x.id))[0];
  if (prey && order(ctx, a.faction, { type: "ArmyIntercept", army: a.id, target: prey.x.id })) {
    push(ctx, { faction: a.faction, army: a.id, action: `intercepter:${prey.x.id}`, reasons: [{ key: "ai.ratio", value: Math.round(prey.r * 100) / 100 }, { key: "ai.distance", value: prey.d }] });
    return;
  }
  const pieces = armyPieces(ctx.aw, a).reduce((n, p) => n + p.count, 0);
  const spot = siegeSpot(ctx, a);
  if (spot && spot !== a.province && order(ctx, a.faction, { type: "ArmyMove", army: a.id, to: spot })) {
    push(ctx, { faction: a.faction, army: a.id, action: `assieger:${spot}`, reasons: [{ key: "ai.artillery", value: pieces }, { key: "ai.distance", value: routeLength(ctx, a.province as string, spot) }] });
  } else if (spot === a.province) push(ctx, { faction: a.faction, army: a.id, action: "bombarder", reasons: [{ key: "ai.artillery", value: pieces }] });
}

function paradisAi(ctx: ArmyCtx, a: ArmyState): void {
  const b = ctx.aw.balance.ai;
  const seen = visibleProvinces(ctx, "fac_paradis");
  const mine = armyStrength(ctx, a);
  const threat = ctx.s.armies
    .filter((x) => x.province && !x.fleet && hostile(ctx.ns, x.faction, "fac_paradis") && seen.has(x.province))
    .map((x) => ({ x, d: routeLength(ctx, a.province as string, x.province as string), r: mine / Math.max(1, armyStrength(ctx, x)) }))
    .sort((p, q) => p.d - q.d || p.x.id.localeCompare(q.x.id))[0];
  if (!threat) return;
  if (threat.r >= b.threat_ratio && order(ctx, "fac_paradis", { type: "ArmyIntercept", army: a.id, target: threat.x.id })) {
    push(ctx, { faction: "fac_paradis", army: a.id, action: `intercepter:${threat.x.id}`, reasons: [{ key: "ai.ratio", value: Math.round(threat.r * 100) / 100 }, { key: "ai.distance", value: threat.d }] });
    return;
  }
  // Trop faible : tenir le segment de mur le plus proche de la menace (défense ×, canons de rempart).
  const g = geoOf(ctx.world);
  const wall = [...g.nodes.keys()].filter((p) => (g.nodes.get(p)?.zone ?? "").startsWith("mur_") && ctx.st.provinces[p]?.control === "paradis").map((p) => ({ p, d: routeLength(ctx, threat.x.province as string, p) + routeLength(ctx, a.province as string, p) / 2 })).sort((x, y) => x.d - y.d || x.p.localeCompare(y.p))[0];
  if (wall && wall.p !== a.province && order(ctx, "fac_paradis", { type: "ArmyMove", army: a.id, to: wall.p })) push(ctx, { faction: "fac_paradis", army: a.id, action: `tenir_mur:${wall.p}`, reasons: [{ key: "ai.ratio", value: Math.round(threat.r * 100) / 100 }, { key: "ai.artillery", value: armyPieces(ctx.aw, a).reduce((n, p) => n + p.count, 0) }] });
  void armyMen;
}
