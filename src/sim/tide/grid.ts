import type { TideBalance } from "../../data/balance";
import type { Season } from "../core/time";
import { activityOf, localActivity } from "./activity";
import { noiseFactor, sizeOf } from "./footprint";
import type { GridSpec, Pile, TideGrid, WallPost } from "./types";

export function createGrid(spec: GridSpec, b: TideBalance): TideGrid {
  const n = spec.w * spec.h;
  if (!Number.isInteger(spec.w) || !Number.isInteger(spec.h) || spec.w < 1 || spec.h < 1) throw new RangeError("createGrid : dimensions invalides");
  const blocked = new Array<boolean>(n).fill(false);
  for (const i of spec.blocked ?? []) {
    if (!Number.isInteger(i) || i < 0 || i >= n) throw new RangeError(`createGrid : cellule bloquée hors grille (${i})`);
    blocked[i] = true;
  }
  const arr = (v: number | readonly number[] | undefined, dflt: number, name: string): number[] => {
    if (v === undefined) return new Array<number>(n).fill(dflt);
    if (typeof v === "number") return new Array<number>(n).fill(v);
    if (v.length !== n) throw new RangeError(`createGrid : ${name} de mauvaise longueur`);
    return [...v];
  };
  const density = arr(spec.density, 0, "density");
  const capacity = arr(spec.capacity, 0, "capacity");
  for (let i = 0; i < n; i++) {
    if (density[i] === undefined || (density[i] as number) < 0 || (capacity[i] as number) < 0) throw new RangeError("createGrid : valeur négative");
    if (blocked[i]) density[i] = 0;
    else density[i] = Math.min(density[i] as number, b.grid.max_density);
  }
  return { w: spec.w, h: spec.h, cellM: b.grid.cell_m, originX: spec.originX ?? 0, originY: spec.originY ?? 0, density, spike: new Array<number>(n).fill(0), blocked, capacity };
}

/** Indice de la cellule contenant (x, y), ou -1 hors grille. */
export function cellOf(g: TideGrid, x: number, y: number): number {
  const cx = Math.floor((x - g.originX) / g.cellM);
  const cy = Math.floor((y - g.originY) / g.cellM);
  return cx < 0 || cy < 0 || cx >= g.w || cy >= g.h ? -1 : cy * g.w + cx;
}

export const centerOf = (g: TideGrid, i: number): { x: number; y: number } => ({
  x: g.originX + ((i % g.w) + 0.5) * g.cellM,
  y: g.originY + (Math.floor(i / g.w) + 0.5) * g.cellM,
});

export const totalDensity = (g: TideGrid): number => g.density.reduce((s, v) => s + v, 0);

const NEIGHBORS: readonly (readonly [number, number])[] = [[0, -1], [-1, 0], [1, 0], [0, 1]];
function neighbors(g: TideGrid, i: number): number[] {
  const x = i % g.w;
  const y = Math.floor(i / g.w);
  const out: number[] = [];
  for (const [dx, dy] of NEIGHBORS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < g.w && ny < g.h) out.push(ny * g.w + nx);
  }
  return out;
}

/** Densité ressentie en un point : cellule + voisines pondérées (pas de saut brutal à la frontière d'une cellule). */
export function localDensity(g: TideGrid, x: number, y: number, b: TideBalance): number {
  const i = cellOf(g, x, y);
  if (i < 0) return 0;
  const ns = neighbors(g, i);
  const w = b.encounter.neighbor_weight;
  const sum = (g.density[i] as number) + w * ns.reduce((s, j) => s + (g.density[j] as number), 0);
  return sum / (1 + w * ns.length);
}

/**
 * Champ d'attention instantané : pics persistants + émission des piles (effectif × facteur de bruit, décroissante avec la distance)
 * + humains sur les murs. Les Titans purs répondent à tous les humains, quelle que soit leur faction (03 §5.1).
 */
export function attentionField(g: TideGrid, piles: readonly Pile[], posts: readonly WallPost[], b: TideBalance): number[] {
  const field = g.spike.slice();
  const r = b.attention.radius_m;
  const emit = (x: number, y: number, power: number): void => {
    if (power <= 0) return;
    const reach = Math.ceil(r / g.cellM) + 1;
    const c = cellOf(g, x, y);
    const cx = c < 0 ? Math.floor((x - g.originX) / g.cellM) : c % g.w;
    const cy = c < 0 ? Math.floor((y - g.originY) / g.cellM) : Math.floor(c / g.w);
    for (let yy = Math.max(0, cy - reach); yy <= Math.min(g.h - 1, cy + reach); yy++) {
      for (let xx = Math.max(0, cx - reach); xx <= Math.min(g.w - 1, cx + reach); xx++) {
        const i = yy * g.w + xx;
        if (g.blocked[i]) continue;
        const ctr = centerOf(g, i);
        const d = Math.hypot(ctr.x - x, ctr.y - y);
        if (d < r) field[i] = (field[i] as number) + power * (1 - d / r);
      }
    }
  };
  for (const p of piles) emit(p.x, p.y, b.attention.per_man * sizeOf(p) * noiseFactor(p, b));
  for (const w of posts) emit(w.x, w.y, b.attention.wall_per_man * w.men);
  return field;
}

export interface StepContext {
  piles: readonly Pile[];
  posts: readonly WallPost[];
  hour: number;
  season: Season;
  dtH: number;
}

export interface StepReport {
  /** Masse créée par le repeuplement (source déclarée). */
  injected: number;
  /** Activité globale utilisée. */
  activity: number;
}

/**
 * Un pas du champ : décroissance des pics, diffusion lente et attraction vers l'attention (conservatrices), puis repeuplement
 * (seule source). Garanties testées : densité ≥ 0, ≤ max_density, masse conservée hors repeuplement.
 */
export function stepGrid(g: TideGrid, ctx: StepContext, b: TideBalance): { grid: TideGrid; report: StepReport } {
  if (!(ctx.dtH >= 0)) throw new RangeError("stepGrid : dtH négatif");
  const n = g.w * g.h;
  const act = activityOf(ctx.hour, ctx.season, b);
  const att = attentionField(g, ctx.piles, ctx.posts, b);
  const decay = Math.pow(0.5, ctx.dtH / b.attention.spike_half_life_h);
  const spike = g.spike.map((s) => s * decay);
  const dyn = b.dynamics;
  // Passe 1 : flux souhaités, bornés par la masse de la cellule source.
  const flows: { from: number; to: number; amt: number }[] = [];
  for (let i = 0; i < n; i++) {
    const rho = g.density[i] as number;
    if (g.blocked[i] || rho <= 0) continue;
    const a = localActivity(act, att[i] as number, b);
    const out: { to: number; amt: number }[] = [];
    for (const j of neighbors(g, i)) {
      if (g.blocked[j]) continue;
      const diff = dyn.diffusion_per_h * a * ctx.dtH * Math.max(0, rho - (g.density[j] as number));
      const aj = att[j] as number;
      const ai = att[i] as number;
      const pull = (dyn.attraction_per_h * a * ctx.dtH * rho * Math.max(0, aj - ai)) / (aj + ai + dyn.attention_half);
      if (diff + pull > 0) out.push({ to: j, amt: diff + pull });
    }
    const sum = out.reduce((s, o) => s + o.amt, 0);
    const scale = sum > 0 ? Math.min(1, (dyn.max_out_fraction * rho) / sum) : 0;
    for (const o of out) flows.push({ from: i, to: o.to, amt: o.amt * scale });
  }
  // Passe 2 : plafond de densité à l'arrivée (réduit les flux entrants, jamais ne crée de masse).
  const inflow = new Array<number>(n).fill(0);
  for (const f of flows) inflow[f.to] = (inflow[f.to] as number) + f.amt;
  const next = g.density.slice();
  for (const f of flows) {
    const room = Math.max(0, b.grid.max_density - (g.density[f.to] as number));
    const s = (inflow[f.to] as number) > room ? room / (inflow[f.to] as number) : 1;
    const amt = f.amt * s;
    next[f.from] = (next[f.from] as number) - amt;
    next[f.to] = (next[f.to] as number) + amt;
  }
  // Repeuplement : croissance vers la capacité, pilotée par l'attention (bruit humain persistant).
  let injected = 0;
  for (let i = 0; i < n; i++) {
    if (g.blocked[i]) continue;
    const ai = att[i] as number;
    const cap = Math.min(g.capacity[i] as number, b.grid.max_density);
    const room = cap - (next[i] as number);
    if (room <= 0) continue;
    const gain = Math.min(room, b.repop.rate_per_h * ctx.dtH * (ai / (ai + b.repop.half_attention)) * room);
    next[i] = (next[i] as number) + gain;
    injected += gain;
  }
  for (let i = 0; i < n; i++) if ((next[i] as number) < 0) next[i] = 0; // erreurs d'arrondi flottant seulement
  return { grid: { ...g, density: next, spike }, report: { injected, activity: act } };
}

/** Pic d'attention (combat, canon, explosion, fusée : clés de `attention.spikes`). */
export function addSpike(g: TideGrid, kind: string, x: number, y: number, scale: number, b: TideBalance): TideGrid {
  const amount = b.attention.spikes[kind];
  if (amount === undefined) throw new RangeError(`addSpike : pic inconnu « ${kind} »`);
  const i = cellOf(g, x, y);
  if (i < 0 || scale < 0) return g;
  const spike = g.spike.slice();
  spike[i] = (spike[i] as number) + amount * scale;
  return { ...g, spike };
}

/** Nettoyage : retire jusqu'à `n` Titans de la cellule (puits déclaré). Ne retire jamais plus que ce qui existe. */
export function removeTitans(g: TideGrid, x: number, y: number, n: number): { grid: TideGrid; removed: number } {
  const i = cellOf(g, x, y);
  if (i < 0 || n <= 0) return { grid: g, removed: 0 };
  const removed = Math.min(n, g.density[i] as number);
  const density = g.density.slice();
  density[i] = (density[i] as number) - removed;
  return { grid: { ...g, density }, removed };
}

/** Brèche (Colossal, porteur) : injecte de la densité dans un anneau autour de (x, y), dans la limite du plafond. */
export function injectBreach(g: TideGrid, x: number, y: number, power: number, b: TideBalance): { grid: TideGrid; injected: number } {
  const ring: number[] = [];
  for (let i = 0; i < g.w * g.h; i++) {
    if (g.blocked[i]) continue;
    const c = centerOf(g, i);
    const d = Math.hypot(c.x - x, c.y - y);
    if (d >= b.breach.inner_m && d <= b.breach.outer_m) ring.push(i);
  }
  if (ring.length === 0 || power <= 0) return { grid: g, injected: 0 };
  const share = (b.breach.amount_per_power * power) / ring.length;
  const density = g.density.slice();
  let injected = 0;
  for (const i of ring) {
    const add = Math.min(share, b.grid.max_density - (density[i] as number));
    density[i] = (density[i] as number) + add;
    injected += add;
  }
  return { grid: { ...g, density }, injected };
}
