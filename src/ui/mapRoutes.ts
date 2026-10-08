import type { MapData } from "../data/map";
import type { MapArmies, MapRoutes } from "../render/strategicMap";
import { visibleProvinces } from "../sim/armies/armies";
import { armiesWorld, armyMen, playerOf } from "../sim/armies/state";
import type { GameState } from "../sim/core/state";
import { edgeKm } from "../sim/military/routes";
import type { Point } from "../sim/strategic/geometry";
import type { World } from "../sim/strategic/world";

/** Position sur la carte d'un objet en marche : province actuelle + fraction de l'arête vers la suivante. */
function along(map: MapData, world: World, path: readonly string[], progressKm: number): Point | null {
  const a = map.provinces[path[0] ?? ""]?.anchor;
  if (!a) return null;
  const b = map.provinces[path[1] ?? ""]?.anchor;
  const geo = world.military?.geo;
  if (!b || !geo) return [a[0], a[1]];
  const km = edgeKm(geo, path[0] as string, path[1] as string) ?? 1;
  const k = Math.max(0, Math.min(1, progressKm / km));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}

/** Itinéraires, fanions et dépôts à tracer (P3), plus l'itinéraire en préparation du planificateur. */
export function buildMapRoutes(map: MapData, world: World, state: GameState, draft: readonly string[] | null): MapRoutes {
  const out: MapRoutes = { routes: [], markers: [], depots: [] };
  const pts = (ids: readonly string[]): Point[] => ids.map((id) => map.provinces[id]?.anchor).filter((p): p is Point => !!p).map((p) => [p[0], p[1]]);
  if (draft && draft.length > 1) out.routes.push({ points: pts(draft), style: "plan" });
  out.routes.push(...armyRoutes(map, world, state));
  const mil = state.military;
  if (!mil || !world.military) return out;
  for (const d of mil.depots) {
    const at = map.provinces[d.province]?.anchor;
    if (at) out.depots.push({ at: [at[0], at[1]], radius: world.military.log.radius_km.depot });
  }
  for (const e of mil.expeditions) {
    const pos = along(map, world, e.path, e.progressKm);
    if (e.phase === "retour") out.routes.push({ points: pts(e.path), style: "retour" });
    else {
      out.routes.push({ points: pts(e.trail), style: "aller" });
      out.routes.push({ points: pts(e.path), style: "plan" });
    }
    if (pos) out.markers.push({ at: pos, kind: "expedition" });
  }
  for (const c of mil.convoys) {
    out.routes.push({ points: pts(c.path), style: "convoi" });
    const pos = along(map, world, c.path, c.progressKm);
    if (pos) out.markers.push({ at: pos, kind: "convoi" });
  }
  return out;
}

const SIDE: Record<string, string> = { fac_paradis: "paradis", fac_marley: "marley", fac_allies: "allies", fac_hizuru: "hizuru" };

/**
 * Étendards d'armées, flottes et rencontres (PA.8) : armées du joueur toujours visibles ; armées et flottes étrangères
 * seulement dans les provinces vues (brouillard) ou dans une mer de l'île. Plusieurs armées dans une province
 * s'écartent (case), à côté du pion de garnison s'il y en a un.
 */
export function buildMapArmies(map: MapData, world: World, state: GameState, selected: string | null): MapArmies {
  const out: MapArmies = { armies: [], fleets: [], clashes: [] };
  const s = state.armies;
  if (!s || !world.armies || !state.strategic) return out;
  const aw = armiesWorld(world);
  const me = playerOf(state.nations);
  const seen = visibleProvinces({ world, aw, s, st: state.strategic }, me);
  const slots = new Map<string, number>();
  const [bx0, by0, bx1, by1] = map.bounds;
  for (const a of s.armies) {
    if (!a.province || a.fleet) continue;
    if (a.faction !== me && !seen.has(a.province)) continue;
    const pos = a.route.length ? along(map, world, [a.province, ...a.route], a.progress) : null;
    const base = map.provinces[a.province]?.anchor;
    if (!base) continue;
    const garrison = (state.strategic.provinces[a.province]?.garrison?.soldiers ?? 0) > 0 ? 1 : 0;
    const slot = pos ? 0 : (slots.get(a.province) ?? garrison);
    if (!pos) slots.set(a.province, slot + 1);
    const at: Point = pos ?? [base[0], base[1]];
    out.armies.push({ id: a.id, at, slot, side: SIDE[a.faction] ?? "autre", insignia: a.insignia, morale: a.morale / 100, supply: a.supply / aw.balance.supply.max_days, selected: a.id === selected, marching: a.route.length > 0, men: formatCount(armyMen(aw, a)) });
  }
  for (const f of s.fleets) {
    const sea = aw.seas.get(f.sea);
    if (!sea || (f.faction !== me && sea.offmap)) continue;
    const at: Point = [Math.max(bx0 + 30, Math.min(bx1 - 30, sea.x)), Math.max(by0 + 30, Math.min(by1 - 30, sea.y))];
    out.fleets.push({ id: f.id, at, side: SIDE[f.faction] ?? "autre", selected: f.id === selected });
  }
  for (const e of s.encounters) {
    if (e.status !== "attente") continue;
    const at = map.provinces[e.province]?.anchor;
    if (at) out.clashes.push([at[0], at[1] - 40]);
  }
  return out;
}

/** Trajets des armées du joueur en marche (trait plein, comme une expédition à l'aller). */
export function armyRoutes(map: MapData, world: World, state: GameState): MapRoutes["routes"] {
  const s = state.armies;
  if (!s) return [];
  const me = playerOf(state.nations);
  const out: MapRoutes["routes"] = [];
  for (const a of s.armies) {
    if (a.faction !== me || !a.province || a.route.length === 0) continue;
    const pos = along(map, world, [a.province, ...a.route], a.progress);
    const pts: Point[] = [];
    if (pos) pts.push(pos);
    for (const id of a.route) {
      const p = map.provinces[id]?.anchor;
      if (p) pts.push([p[0], p[1]]);
    }
    out.push({ points: pts, style: a.stance === "retraite" ? "armee_retraite" : "armee" });
  }
  return out;
}

function formatCount(n: number): string {
  const v = Math.round(n);
  return v >= 10000 ? `${Math.round(v / 1000)} k` : v >= 1000 ? `${(v / 1000).toFixed(1).replace(".", ",")} k` : String(v);
}
