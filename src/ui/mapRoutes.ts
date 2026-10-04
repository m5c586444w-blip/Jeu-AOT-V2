import type { MapData } from "../data/map";
import type { MapRoutes } from "../render/strategicMap";
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
