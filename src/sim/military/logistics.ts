import { Rng } from "../core/rng";
import { pushLog } from "../strategic/economy";
import { clamp, uniform } from "./random";
import { edgeKm, shortestRoute, titanDensity } from "./routes";
import type { MilCtx } from "./expedition";
import type { Convoy, Supplies } from "./state";

/** Convois et dépôts avancés (F-LOG-01, F-LOG-03, F-LOG-04, F-LOG-13). */

export interface ConvoyOrder {
  depot: string;
  cargo: Supplies;
  wagons: number;
  escort: number;
}

/** Province d'où partent les convois (base des expéditions). */
function convoyBase(ctx: MilCtx): string {
  const base = ctx.world.scenario.expedition_base;
  if (!base) throw new Error("Aucune base de départ (expedition_base) dans le scénario");
  return base;
}

/** Garnison qui fournit l'escorte : la première tenue par la Garnison sur le chemin (la porte franchie, D-54). */
function escortSource(ctx: MilCtx, path: readonly string[]): string | null {
  return path.find((p) => ctx.st.provinces[p]?.garrison?.org === "garrison") ?? null;
}

export function convoyProblem(ctx: MilCtx, o: ConvoyOrder): { key: string; params: Record<string, string | number> } | null {
  const lg = ctx.m.log;
  const depot = ctx.mil.depots.find((d) => d.id === o.depot);
  if (!depot) return { key: "convoy.unknown_depot", params: { depot: o.depot } };
  if (!Number.isInteger(o.wagons) || o.wagons < 1 || !Number.isInteger(o.escort) || o.escort < 0) return { key: "plan.bad_numbers", params: {} };
  const load = o.cargo.food + o.cargo.gas + o.cargo.steel;
  if (![o.cargo.food, o.cargo.gas, o.cargo.steel].every((v) => Number.isFinite(v) && v >= 0) || load <= 0) return { key: "plan.bad_numbers", params: {} };
  if (load > o.wagons * lg.convoy.wagon_capacity) return { key: "plan.no_wagons", params: { load: Math.ceil(load), capacity: o.wagons * lg.convoy.wagon_capacity } };
  const s = ctx.st.stocks;
  if (o.cargo.food > s.food || o.cargo.gas > s.gas || o.cargo.steel > s.steel) return { key: "convoy.no_stock", params: {} };
  if (o.wagons * lg.convoy.horses_per_wagon > s.horses) return { key: "plan.no_horses", params: { need: o.wagons * lg.convoy.horses_per_wagon, have: Math.floor(s.horses) } };
  const path = shortestRoute(ctx.m.geo, convoyBase(ctx), depot.province);
  if (!path) return { key: "convoy.no_route", params: {} };
  const from = escortSource(ctx, path);
  const have = from ? (ctx.st.provinces[from]?.garrison?.soldiers ?? 0) : 0;
  if (o.escort > have) return { key: "convoy.no_escort", params: { have } };
  return null;
}

export function sendConvoy(ctx: MilCtx, o: ConvoyOrder): Convoy {
  const p = convoyProblem(ctx, o);
  if (p) throw new Error(`Convoi refusé : ${p.key}`);
  const depot = ctx.mil.depots.find((d) => d.id === o.depot);
  const path = shortestRoute(ctx.m.geo, convoyBase(ctx), depot?.province ?? "") as string[];
  const s = ctx.st.stocks;
  s.food -= o.cargo.food;
  s.gas -= o.cargo.gas;
  s.steel -= o.cargo.steel;
  s.horses -= o.wagons * ctx.m.log.convoy.horses_per_wagon;
  const from = escortSource(ctx, path);
  const fromState = from ? ctx.st.provinces[from] : undefined;
  if (fromState?.garrison && o.escort > 0) fromState.garrison = { ...fromState.garrison, soldiers: fromState.garrison.soldiers - o.escort };
  ctx.mil.seq.convoy += 1;
  const c: Convoy = { id: `conv_${ctx.mil.seq.convoy}`, number: ctx.mil.seq.convoy, path, progressKm: 0, depot: o.depot, cargo: { ...o.cargo }, wagons: o.wagons, escort: o.escort, escortFrom: from, status: "en_route", launched: { ...ctx.date }, log: [] };
  ctx.mil.convoys.push(c);
  pushLog(ctx.st, ctx.date, "log.convoy_departed", { n: c.number, province: depot?.province ?? "" }, false);
  return c;
}

/** Risque quotidien d'interception (AC3-04) : croît avec la densité de Titans, décroît avec l'escorte. */
export function interceptionRisk(ctx: Pick<MilCtx, "world" | "m">, province: string, escort: number): number {
  const c = ctx.m.log.convoy;
  return clamp(c.interception_per_day_at_density_1 * titanDensity(ctx.world, province) * Math.exp(-c.escort_k * escort), 0, 0.95);
}

function returnEscort(ctx: MilCtx, c: Convoy): void {
  const ps = c.escortFrom ? ctx.st.provinces[c.escortFrom] : undefined;
  if (ps?.garrison && c.escort > 0) ps.garrison = { ...ps.garrison, soldiers: ps.garrison.soldiers + c.escort };
  // Chariots et attelages rentrent à vide (trajet de retour abstrait [A]).
  ctx.st.stocks.horses += c.wagons * ctx.m.log.convoy.horses_per_wagon;
}

export function stepConvoy(ctx: MilCtx, c: Convoy): void {
  if (c.status !== "en_route") return;
  const lg = ctx.m.log.convoy;
  const rng = new Rng(ctx.seed).fork(`convoy:${c.id}:${ctx.date.year}:${ctx.date.day}`);
  let budget = lg.pace_km_per_day;
  while (budget > 0 && c.path.length > 1) {
    const left = (edgeKm(ctx.m.geo, c.path[0] as string, c.path[1] as string) ?? 0) - c.progressKm;
    if (budget >= left) {
      budget -= left;
      c.path.shift();
      c.progressKm = 0;
    } else {
      c.progressKm += budget;
      budget = 0;
    }
  }
  const here = c.path[0] as string;
  if (rng.next() < interceptionRisk(ctx, here, c.escort)) {
    const share = uniform(rng, lg.cargo_loss[0], lg.cargo_loss[1]);
    const lostEscort = Math.round(c.escort * lg.escort_loss_share * rng.next() * 2);
    c.cargo = { food: c.cargo.food * (1 - share), gas: c.cargo.gas * (1 - share), steel: c.cargo.steel * (1 - share) };
    c.escort = Math.max(0, c.escort - lostEscort);
    c.log.push({ day: ctx.date.day, key: "convoy.intercepted", params: { province: here, pct: Math.round(share * 100), escort: lostEscort } });
    pushLog(ctx.st, ctx.date, "log.convoy_intercepted", { n: c.number, province: here, pct: Math.round(share * 100) }, false);
    if (c.cargo.food + c.cargo.gas + c.cargo.steel < 1) {
      c.status = "perdu";
      returnEscort(ctx, c);
      return;
    }
  }
  if (c.path.length === 1) {
    const depot = ctx.mil.depots.find((d) => d.id === c.depot);
    if (depot) {
      const cap = ctx.m.log.depot.capacity;
      for (const r of ["food", "gas", "steel"] as const) depot.stocks[r] = Math.min(cap[r] ?? Infinity, depot.stocks[r] + c.cargo[r]);
    }
    c.status = "livre";
    returnEscort(ctx, c);
    pushLog(ctx.st, ctx.date, "log.convoy_delivered", { n: c.number, province: here }, false);
  }
}

/** Alerte de seuil d'un dépôt (F-LOG-13) : vivres pour moins de N jours d'une escouade type de 100 hommes. */
export function depotAlerts(ctx: MilCtx): void {
  const need = 100 * ctx.m.exp.attrition.food_per_soldier;
  for (const d of ctx.mil.depots) {
    const days = d.stocks.food / need;
    const low = days < ctx.m.log.alerts.depot_food_days;
    if (low && !d.lowAlerted) pushLog(ctx.st, ctx.date, "log.depot_low", { province: d.province, days: Math.floor(days) }, false);
    d.lowAlerted = low;
  }
}
