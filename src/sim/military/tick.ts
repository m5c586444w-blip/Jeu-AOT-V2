import type { GameDate } from "../core/time";
import type { PoliticalState } from "../politics/state";
import type { StrategicState } from "../strategic/economy";
import type { World } from "../strategic/world";
import { recoverWounded, stepExpedition, weatherOn } from "./expedition";
import type { MilCtx } from "./expedition";
import { depotAlerts, stepConvoy } from "./logistics";
import type { MilitaryState } from "./state";

/**
 * Jour militaire (P3) : blessés rétablis, expéditions et convois en route, alertes de dépôt.
 * Copie sur écriture : sans activité, les mêmes objets sont renvoyés (coût nul pour le tick).
 */
export function dailyMilitary(world: World, seed: number, date: GameDate, mil: MilitaryState, st: StrategicState, pol: PoliticalState | null): { mil: MilitaryState; st: StrategicState; pol: PoliticalState | null } {
  const m = world.military;
  if (!m) return { mil, st, pol };
  const busy = mil.expeditions.length > 0 || mil.convoys.some((c) => c.status === "en_route") || mil.depots.length > 0 || Object.values(mil.soldiers).some((s) => s.status === "blesse");
  if (!busy) return { mil, st, pol };
  const ctx: MilCtx = { world, m, seed, date, st: structuredClone(st), pol: pol ? structuredClone(pol) : null, mil: structuredClone(mil) };
  recoverWounded(ctx.mil, date);
  const weather = weatherOn(world, seed, date);
  for (const e of ctx.mil.expeditions.slice()) stepExpedition(ctx, e, weather);
  for (const c of ctx.mil.convoys) stepConvoy(ctx, c);
  ctx.mil.convoys = ctx.mil.convoys.filter((c) => c.status === "en_route");
  depotAlerts(ctx);
  return { mil: ctx.mil, st: ctx.st, pol: ctx.pol };
}
