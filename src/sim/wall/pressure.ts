import type { WallBalance } from "../../data/balance";
import type { District, PressureLevel, Ring, WallState } from "./types";

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));
export const RINGS: readonly Ring[] = ["maria", "rose", "sina"];

export const cloneWall = (s: WallState): WallState => structuredClone(s);

/** pression = population / capacité alimentaire (spec 26 §2). Capacité nulle : infinie si population > 0. */
export function pressureOf(
  d: Pick<District, "population" | "foodCapacity">,
): number {
  if (d.foodCapacity <= 0)
    return d.population > 0 ? Number.POSITIVE_INFINITY : 0;
  return d.population / d.foodCapacity;
}

export function levelOf(p: number, b: WallBalance): PressureLevel {
  const t = b.pressure;
  return p >= t.rupture
    ? "rupture"
    : p >= t.critique
      ? "critique"
      : p >= t.tendu
        ? "tendu"
        : "calme";
}

/** Districts habités (ni abandonnés ni en brèche) : ceux qui portent encore une population stable. */
const live = (d: District): boolean =>
  d.status === "intact" || d.status === "reconquered";

/** Pression d'un anneau : population / capacité sommées sur ses districts non abandonnés. */
export function ringPressure(s: WallState, ring: Ring): number {
  let pop = 0;
  let cap = 0;
  for (const d of Object.values(s.districts))
    if (d.ring === ring && d.status !== "abandoned") {
      pop += d.population;
      cap += d.foodCapacity;
    }
  return cap <= 0 ? (pop > 0 ? Number.POSITIVE_INFINITY : 0) : pop / cap;
}

export function totalPopulation(s: WallState): number {
  let n = 0;
  for (const d of Object.values(s.districts)) n += d.population;
  for (const e of s.evacuations)
    n += e.waiting + e.batches.reduce((m, x) => m + x.n, 0);
  return n;
}

/** Invariant de conservation : écart entre la population réelle et celle du registre (doit rester ≈ 0). */
export function conservationGap(s: WallState): number {
  const l = s.ledger;
  return totalPopulation(s) - (l.start + l.births - l.deaths - l.exported);
}

/**
 * Pression perçue (spec 26 §2 test c) : un district non visité n'affiche qu'une bande de niveau, jamais la valeur exacte.
 */
export function perceivedPressure(
  d: District,
  visited: boolean,
  b: WallBalance,
): { exact: number | null; level: PressureLevel; band: [number, number] } {
  const p = pressureOf(d);
  const w = b.fog.band_width;
  const lo = Math.floor(p / w) * w;
  return {
    exact: visited ? p : null,
    level: levelOf(p, b),
    band: [lo, lo + w],
  };
}

/**
 * Un jour : naissances, décès, épidémies selon le niveau, ordre public, flux de réfugiés vers les voisins moins pressés
 * (population conservée : chaque réfugié sort d'un district et entre dans un autre).
 */
export function stepDay(prev: WallState, b: WallBalance): WallState {
  const s = cloneWall(prev);
  const ids = Object.keys(s.districts).sort();
  for (const id of ids) {
    const d = s.districts[id];
    if (!d || !live(d)) continue;
    const pol = d.rationPolicy;
    const p = pressureOf({
      population: d.population,
      foodCapacity: d.foodCapacity * (pol ? pol.capacityMult : 1),
    });
    const lvl = levelOf(p, b);
    const births = d.population * b.pressure.birth_per_day;
    const epi =
      lvl === "critique"
        ? b.pressure.epidemic_per_day.critique
        : lvl === "rupture"
          ? b.pressure.epidemic_per_day.rupture
          : 0;
    const deaths = Math.min(
      d.population + births,
      d.population * (b.pressure.death_per_day + epi),
    );
    d.population += births - deaths;
    s.ledger.births += births;
    s.ledger.deaths += deaths;
    const target = b.order.target_by_level[lvl];
    d.order = clamp(
      d.order + (target - d.order) * b.order.approach_per_day,
      0,
      100,
    );
    let rations = clamp(
      p > b.pressure.ration_pressure_threshold
        ? Math.max(b.pressure.ration_floor * d.rations, 1 / p)
        : Math.min(1, d.rations + b.pressure.ration_recovery_per_day),
      b.pressure.ration_floor * b.pressure.ration_absolute_floor_mult,
      1,
    );
    if (pol) {
      rations = Math.min(rations, pol.mult);
      pol.daysLeft -= 1;
      if (pol.daysLeft <= 0) delete d.rationPolicy;
    }
    d.rations = rations;
  }
  // Flux de réfugiés : calculés sur la pression d'avant flux, appliqués ensemble (indépendant de l'ordre de parcours).
  const flows: Array<[string, string, number]> = [];
  const rooms = new Map<string, number>();
  for (const id of ids) {
    const d = s.districts[id];
    if (!d || !live(d)) continue;
    const p = pressureOf(d);
    if (p < b.pressure.tendu) continue;
    const targets = d.neighbors
      .map((n) => s.districts[n])
      .filter(
        (n): n is District =>
          !!n &&
          live(n) &&
          s.gates[n.ring] &&
          pressureOf(n) < p - b.refugees.min_gap &&
          pressureOf(n) < b.refugees.max_pressure_after,
      )
      .sort(
        (x, y) => pressureOf(x) - pressureOf(y) || x.id.localeCompare(y.id),
      );
    if (targets.length === 0) continue;
    const out = d.population * b.refugees.flow_share_per_day;
    for (const t of targets) {
      // Jamais au-delà de la pression maximale d'accueil : la capacité d'accueil est consommée source après source.
      const room = Math.max(
        0,
        rooms.get(t.id) ??
          t.foodCapacity * b.refugees.max_pressure_after - t.population,
      );
      const n = Math.min(out / targets.length, room);
      rooms.set(t.id, room - n);
      flows.push([id, t.id, n]);
    }
  }
  for (const [a, c, n] of flows) {
    const from = s.districts[a];
    const to = s.districts[c];
    if (!from || !to) continue;
    const m = Math.min(n, from.population);
    from.population -= m;
    to.population += m;
  }
  return s;
}

/** Fin de mois : compte les mois au-dessus du seuil de désengorgement, par anneau. */
export function stepMonth(prev: WallState, b: WallBalance): WallState {
  const s = cloneWall(prev);
  for (const r of RINGS) {
    const over = ringPressure(s, r) > b.decongest.threshold;
    s.monthsOver[r] = over ? s.monthsOver[r] + 1 : 0;
  }
  for (const p of s.projects) p.monthsLeft = Math.max(0, p.monthsLeft - 1);
  for (const p of s.projects.filter((x) => x.monthsLeft === 0)) {
    const d = s.districts[p.district];
    if (d) d.foodCapacity += p.gain;
  }
  s.projects = s.projects.filter((x) => x.monthsLeft > 0);
  return s;
}
