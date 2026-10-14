import type { TideBalance } from "../../data/balance";
import type { Rng } from "../core/rng";
import { sizeOf } from "./footprint";
import type { Casualties, EngageReport, Geometry, Pile } from "./types";

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const keys = (o: Record<string, number>): string[] => Object.keys(o).sort();

interface Volley {
  casualties: number;
  /** Pression de suppression reçue par la cible, avant couvert. */
  pressure: number;
  rounds: number;
  ammoSpent: Record<string, number>;
  gasSpent: number;
}

/** Part de la pile qui combat en vol (armes `airborne`). */
function airborneShare(p: Pile, b: TideBalance): number {
  const total = sizeOf(p);
  if (total <= 0) return 0;
  let a = 0;
  for (const w of keys(p.troops)) if (b.weapons[w]?.airborne) a += p.troops[w] as number;
  return a / total;
}

/**
 * Vulnérabilité d'une pile au feu : le couvert protège les soldats au sol ; un soldat en vol (ODM) est une cible visible
 * (`airborne_exposure`) que seule une densité d'ancrages permet d'esquiver (`airborne_evasion` × ancrages). Spec 26 §3 bis.
 */
export function vulnerability(p: Pile, b: TideBalance): number {
  const s = airborneShare(p, b);
  const ground = 1 - b.combat.cover_k * clamp01(p.cover);
  const air = b.combat.airborne_exposure * (1 - b.combat.airborne_evasion * clamp01(p.anchors));
  return (1 - s) * ground + s * air;
}

function volley(x: Pile, y: Pile, geo: Geometry, side: "a" | "b", dtMin: number, noise: number, b: TideBalance): Volley {
  const c = b.combat;
  const d = b.detection;
  const v: Volley = { casualties: 0, pressure: 0, rounds: 0, ammoSpent: {}, gasSpent: 0 };
  const flank = side === "a" ? geo.flankA : geo.flankB;
  const sight = (c.fire_vis_floor + (1 - c.fire_vis_floor) * clamp01(geo.visibility)) * (geo.night ? c.fire_night_mult : 1);
  const seen = side === "a" ? geo.seen.a : geo.seen.b;
  const mult =
    (c.morale_fire_floor + (1 - c.morale_fire_floor) * clamp01(x.morale)) *
    (1 - c.suppress_fire_k * clamp01(x.suppression)) *
    (x.routed ? c.rout_fire_mult : 1) *
    (seen ? 1 : d.unseen_fire_mult) *
    (1 + c.flank_fire_k * flank) *
    (geo.ambusher === side ? d.ambush_mult : 1) *
    noise;
  const vuln = vulnerability(y, b);
  const targetSize = sizeOf(y);
  let gasLeft = x.gas;
  for (const w of keys(x.troops)) {
    const n = x.troops[w] as number;
    const spec = b.weapons[w];
    if (!spec || n <= 0 || geo.distanceM > spec.range_m) continue;
    let shots = n * spec.shots_per_min * dtMin;
    if (spec.ammo_per_shot > 0) {
      const need = shots * spec.ammo_per_shot;
      const frac = need > 0 ? Math.min(1, (x.ammo[w] ?? 0) / need) : 1;
      shots *= frac;
      v.ammoSpent[w] = shots * spec.ammo_per_shot;
    }
    if (spec.gas_per_min > 0) {
      const needG = n * spec.gas_per_min * dtMin;
      const fracG = needG > 0 ? Math.min(1, gasLeft / needG) : 1;
      shots *= fracG;
      const used = needG * fracG;
      gasLeft -= used;
      v.gasSpent += used;
    }
    if (shots <= 0) continue;
    const effective = shots * mult;
    const accuracy = spec.hit_prob * (1 - geo.distanceM / spec.range_m) * sight;
    const area = 1 + (spec.area - 1) * Math.min(1, targetSize / c.area_ref_men);
    v.casualties += effective * accuracy * spec.lethality * area * vuln;
    v.pressure += effective * spec.suppression * area;
    v.rounds += shots;
  }
  return v;
}

function apply(y: Pile, incoming: Volley, flankAgainst: number, dtS: number, b: TideBalance): { pile: Pile; cas: Casualties } {
  const c = b.combat;
  const before = sizeOf(y);
  const cas = Math.min(before, incoming.casualties);
  const wounded = cas * c.wounded_share;
  const killed = cas - wounded;
  const troops: Record<string, number> = {};
  for (const w of keys(y.troops)) troops[w] = before > 0 ? (y.troops[w] as number) * (1 - cas / before) : 0;
  const gain = before > 0 ? c.suppress_gain * (incoming.pressure / before) * (1 - c.suppress_cover_k * clamp01(y.cover)) : 0;
  const suppression = clamp01(y.suppression * Math.pow(0.5, dtS / c.suppress_half_life_s) + gain);
  const loss =
    c.morale_supp_k * gain * (1 - c.morale_cover_k * clamp01(y.cover)) * (1 + c.flank_morale_k * flankAgainst) +
    (before > 0 ? c.morale_loss_k * (cas / before) : 0);
  const morale = clamp01(y.morale - loss);
  return { pile: { ...y, troops, suppression, morale, routed: morale < c.rout_threshold, wounded: y.wounded + wounded, dead: y.dead + killed }, cas: { killed, wounded } };
}

function spend(x: Pile, v: Volley): Pile {
  const ammo = { ...x.ammo };
  for (const w of keys(v.ammoSpent)) ammo[w] = Math.max(0, (ammo[w] ?? 0) - (v.ammoSpent[w] as number));
  return { ...x, ammo, gas: Math.max(0, x.gas - v.gasSpent) };
}

/**
 * Échange de feu de `dtS` secondes entre deux piles (spec 26 §3 bis), résolu simultanément. Couvert, suppression, moral et déroute,
 * flanquement, embuscade, munitions et gaz consommés, blessés. Conservation : effectif + blessés + morts + évacués constant.
 */
export function engage(a: Pile, z: Pile, geo: Geometry, dtS: number, rng: Rng, b: TideBalance): { a: Pile; b: Pile; report: EngageReport } {
  if (!(dtS >= 0)) throw new RangeError("engage : dtS négatif");
  const dtMin = dtS / 60;
  const na = 1 + b.combat.noise_pct * (2 * rng.next() - 1);
  const nz = 1 + b.combat.noise_pct * (2 * rng.next() - 1);
  const va = volley(a, z, geo, "a", dtMin, na, b);
  const vz = volley(z, a, geo, "b", dtMin, nz, b);
  const hitZ = apply(z, va, geo.flankA, dtS, b);
  const hitA = apply(a, vz, geo.flankB, dtS, b);
  return { a: spend(hitA.pile, va), b: spend(hitZ.pile, vz), report: { a: hitA.cas, b: hitZ.cas, roundsA: va.rounds, roundsB: vz.rounds } };
}

/** Évacuation des blessés : ils quittent la pile (comptés évacués), au rythme `evac_per_min`. */
export function evacuate(p: Pile, dtS: number, b: TideBalance): Pile {
  const moved = p.wounded * Math.min(1, (b.combat.evac_per_min * dtS) / 60);
  return { ...p, wounded: p.wounded - moved, evacuated: p.evacuated + moved };
}

/** Retour au calme : la suppression retombe et le moral remonte, d'autant plus lentement que la pile est encore clouée. */
export function recover(p: Pile, dtS: number, b: TideBalance): Pile {
  const c = b.combat;
  const suppression = clamp01(p.suppression * Math.pow(0.5, dtS / c.suppress_half_life_s));
  const morale = clamp01(p.morale + c.morale_recovery_per_min * (dtS / 60) * (1 - suppression));
  return { ...p, suppression, morale, routed: morale < c.rout_threshold };
}

/** Effectif total de tous les compartiments (invariant de conservation). */
export const headcount = (p: Pile): number => sizeOf(p) + p.wounded + p.dead + p.evacuated;
