import type { WallBalance } from "../../data/balance";
import { cloneWall } from "./pressure";
import type { Ring, WallState } from "./types";

/**
 * Seuil de brèche d'un segment : `structure` (0–100, `ProvinceState.wall_structure` ; même sens que `siege.breached`
 * côté armées, `armies.ts:~1225`) sous `breach.structure_below`.
 */
export const isBreached = (structure: number | null, b: WallBalance): boolean =>
  structure !== null && structure < b.breach.structure_below;

/**
 * Brèche d'un district (porte ou tronçon brisé) : état « brèche », les civils exposés passent en évacuation vers le
 * district d'accueil donné. Sans accueil possible, ils restent exposés (`to` = null : attendent sur place).
 */
export function breachDistrict(
  prev: WallState,
  id: string,
  to: string | null,
  distanceM: number,
  b: WallBalance,
): WallState {
  const s = cloneWall(prev);
  const d = s.districts[id];
  if (!d || d.status === "breach" || d.status === "abandoned") return s;
  d.status = "breach";
  d.cleanup = 0;
  // Toute la population du district est exposée tant qu'elle n'a pas franchi une porte d'accueil.
  s.evacuations.push({
    id: `evac_${s.nextId++}`,
    from: id,
    to: to ?? "",
    waiting: d.population,
    batches: [],
    distanceM,
    hoursElapsed: 0,
    done: false,
  });
  d.population = 0;
  d.order = Math.min(d.order, b.breach.order_cap_on_breach);
  return s;
}

/** Décision politique : ouvrir ou fermer les portes de l'anneau d'accueil. Fermer coûte de la légitimité, ouvrir de l'ordre. */
export function setGate(
  prev: WallState,
  ring: Ring,
  open: boolean,
  b: WallBalance,
): WallState {
  const s = cloneWall(prev);
  if (s.gates[ring] === open) return s;
  s.gates[ring] = open;
  if (!open) s.effects.legitimacy += b.breach.closed_gate_legitimacy;
  else
    for (const d of Object.values(s.districts))
      if (d.ring === ring && d.status !== "abandoned")
        d.order = Math.max(0, d.order + b.breach.open_gate_order);
  return s;
}

/**
 * Une heure d'évacuation : les civils restants perdent `hourly_loss_share` ; ceux qui peuvent partir (porte d'accueil
 * ouverte, débit limité) se mettent en marche ; les lots arrivés rejoignent le district d'accueil. Conservation
 * stricte : pertes = décès au registre.
 */
export function stepEvacuationHour(prev: WallState, b: WallBalance): WallState {
  const s = cloneWall(prev);
  for (const e of s.evacuations) {
    if (e.done) continue;
    e.hoursElapsed += 1;
    const dest = s.districts[e.to];
    const lost = e.waiting * b.breach.hourly_loss_share;
    e.waiting -= lost;
    s.ledger.deaths += lost;
    const gateOpen =
      !!dest &&
      s.gates[dest.ring] &&
      dest.status !== "abandoned" &&
      dest.status !== "breach";
    if (gateOpen && e.waiting > 0) {
      const go = Math.min(e.waiting, b.breach.gate_throughput_per_hour);
      e.waiting -= go;
      e.batches.push({
        n: go,
        hoursLeft: Math.max(
          1,
          Math.ceil(e.distanceM / b.breach.walk_m_per_hour),
        ),
      });
    }
    for (const bt of e.batches) bt.hoursLeft -= 1;
    const arrived = e.batches.filter((x) => x.hoursLeft <= 0);
    e.batches = e.batches.filter((x) => x.hoursLeft > 0);
    if (dest) for (const a of arrived) dest.population += a.n;
    if (e.waiting < 0.5 && e.batches.length === 0) {
      s.ledger.deaths += e.waiting;
      e.waiting = 0;
      e.done = true;
    }
  }
  return s;
}

/** Abandon d'un district : la population qui reste (ou attend encore) est perdue et inscrite aux décès. */
export function abandonDistrict(prev: WallState, id: string): WallState {
  const s = cloneWall(prev);
  const d = s.districts[id];
  if (!d) return s;
  s.ledger.deaths += d.population;
  d.population = 0;
  d.status = "abandoned";
  d.cleanup = 0;
  for (const e of s.evacuations) {
    if (e.from === id && !e.done) {
      s.ledger.deaths += e.waiting;
      e.waiting = 0;
    }
  }
  return s;
}

/**
 * Un jour de reconquête : le nettoyage progresse (abaisse la densité de Titans, P2) ; à 100 % le district redevient
 * « reconquis » et se repeuple à partir d'un donneur (pression des voisins relancée).
 */
export function stepReconquest(
  prev: WallState,
  id: string,
  donor: string | null,
  b: WallBalance,
): WallState {
  const s = cloneWall(prev);
  const d = s.districts[id];
  if (
    !d ||
    (d.status !== "abandoned" &&
      d.status !== "breach" &&
      d.status !== "reconquered")
  )
    return s;
  if (d.status !== "reconquered") {
    d.cleanup = Math.min(1, d.cleanup + b.reconquest.cleanup_per_day);
    if (d.cleanup >= b.reconquest.repopulate_min_cleanup)
      d.status = "reconquered";
    return s;
  }
  const from = donor ? s.districts[donor] : undefined;
  if (from && (from.status === "intact" || from.status === "reconquered")) {
    const n = Math.min(
      from.population * b.reconquest.repopulate_share_per_day,
      Math.max(
        0,
        d.foodCapacity * b.reconquest.repopulate_capacity_mult - d.population,
      ),
    );
    from.population -= n;
    d.population += n;
  }
  return s;
}
