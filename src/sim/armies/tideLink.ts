import { seasonOf } from "../core/time";
import type { GameDate } from "../core/time";
import { titanDensity } from "../military/routes";
import type { StrategicState } from "../strategic/economy";
import type { World } from "../strategic/world";
import { tickTide, tideDensity } from "../tide/region";
import type { TideArmy, TideState } from "../tide/region";
import { geoOf } from "./armies";
import { armiesWorld } from "./state";
import type { ArmiesState } from "./state";

/** Densité statique ressentie par une armée : 0 dans une province tenue par Paradis (D-177 : même règle que l'usure de marche). */
const staticDensity = (world: World, st: StrategicState, province: string): number => (st.provinces[province]?.control === "paradis" ? 0 : titanDensity(world, province, st));

/** Lentille lue par `tickArmies` : densité effective de la région de la province, ou `null` (densité statique). */
export function tideLens(world: World, s: TideState, st: StrategicState): ((province: string) => number | null) | undefined {
  const b = world.tide;
  if (!b || !world.military) return undefined;
  const g = geoOf(world);
  return (province) => {
    const n = g.nodes.get(province);
    return n ? tideDensity(s, province, n.x, n.y, staticDensity(world, st, province), b) : null;
  };
}

/** Pas quotidien de la Marée, après le tick des armées (positions du jour) : armées exposées, rencontres du jour, saison. */
export function tickTideOfArmies(world: World, s: TideState, armies: ArmiesState, st: StrategicState, date: GameDate, day: number): TideState {
  const b = world.tide;
  if (!b || !world.military) return s;
  const g = geoOf(world);
  const aw = armiesWorld(world);
  const list: TideArmy[] = [];
  for (const a of [...armies.armies].sort((x, y) => x.id.localeCompare(y.id))) {
    if (!a.province || a.fleet) continue;
    const n = g.nodes.get(a.province);
    if (!n || staticDensity(world, st, a.province) <= 0) continue;
    const byKind: Record<string, number> = {};
    for (const r of a.regiments) {
      const reg = aw.regiments.get(r.regiment);
      if (reg) byKind[reg.kind] = (byKind[reg.kind] ?? 0) + reg.men * r.count * r.strength;
    }
    list.push({ id: a.id, province: a.province, faction: a.faction, xKm: n.x, yKm: n.y, byKind, moving: a.route.length > 0 && a.stance !== "halte" });
  }
  const clashes = new Set(armies.encounters.filter((e) => e.day === day).map((e) => e.province));
  return tickTide(s, { armies: list, baseDensity: (p) => staticDensity(world, st, p), clashes, season: seasonOf(date) }, b);
}
