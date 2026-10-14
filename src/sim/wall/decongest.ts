import type { WallBalance } from "../../data/balance";
import { cloneWall, pressureOf, ringPressure } from "./pressure";
import type {
  Decision,
  DecisionKind,
  DecisionResult,
  Ring,
  WallState,
} from "./types";

/**
 * Désengorgement systémique (non scripté, spec 26 §2, inspiré de E06) : quand la pression d'un anneau dépasse le seuil
 * pendant `months_over` mois, une décision à trois branches est proposée. Retourne la plus pressée, ou null.
 */
export function proposeDecision(s: WallState, b: WallBalance): Decision | null {
  let best: Decision | null = null;
  for (const ring of ["maria", "rose", "sina"] as const) {
    if (s.monthsOver[ring] < b.decongest.months_over) continue;
    const p = ringPressure(s, ring);
    if (!best || p > best.pressure)
      best = {
        ring,
        options: ["rationner", "desengorger", "nouvelles_terres"],
        pressure: p,
      };
  }
  return best;
}

const ringDistricts = (s: WallState, ring: Ring) =>
  Object.values(s.districts)
    .filter(
      (d) =>
        d.ring === ring &&
        (d.status === "intact" || d.status === "reconquered"),
    )
    .sort((a, c) => a.id.localeCompare(c.id));

/**
 * Applique la branche choisie. `roll` ∈ [0,1) est l'aléa injecté (échec des nouvelles terres) ; `gold` est l'or disponible
 * (les nouvelles terres sont refusées sans lui : la note le dit). Refuser toute branche = ne pas appeler (divergence forte).
 */
export function applyDecision(
  prev: WallState,
  ring: Ring,
  kind: DecisionKind,
  gold: number,
  roll: number,
  b: WallBalance,
): DecisionResult {
  const s = cloneWall(prev);
  const ds = ringDistricts(s, ring);
  const c = b.decongest;
  if (kind === "rationner") {
    for (const d of ds) {
      d.rations *= c.ration.ration_mult;
      d.order = Math.max(0, d.order + c.ration.order);
    }
    s.effects.legitimacy += c.ration.legitimacy;
    s.monthsOver[ring] = 0;
    return { state: s, legitimacy: c.ration.legitimacy, note: "rationner" };
  }
  if (kind === "desengorger") {
    // On ramène la pression de l'anneau à la cible ; les envoyés sortent du registre, une part meurt hors des murs.
    const cap = ds.reduce((n, d) => n + d.foodCapacity, 0);
    const pop = ds.reduce((n, d) => n + d.population, 0);
    const surplus = Math.max(0, pop - cap * c.send_out.target_pressure);
    for (const d of ds) {
      const out = pop > 0 ? surplus * (d.population / pop) : 0;
      d.population -= out;
      d.order = Math.max(0, d.order + c.send_out.order);
    }
    s.ledger.exported += surplus;
    s.effects.legitimacy += c.send_out.legitimacy;
    s.monthsOver[ring] = 0;
    return {
      state: s,
      legitimacy: c.send_out.legitimacy,
      note: `desengorger:${Math.round(surplus)}:pertes_prevues:${Math.round(surplus * c.send_out.loss_share)}`,
    };
  }
  const n = c.new_land;
  if (gold < n.gold_cost || ds.length === 0)
    return { state: s, legitimacy: 0, note: "nouvelles_terres:refusee" };
  const target = ds.reduce((a, d) => (pressureOf(d) > pressureOf(a) ? d : a));
  if (roll < n.failure_p) {
    // Échec : expédition décimée, la population du district porteur subit la perte.
    const loss = target.population * n.failure_loss_share;
    target.population -= loss;
    s.ledger.deaths += loss;
    return { state: s, legitimacy: 0, note: "nouvelles_terres:echec" };
  }
  s.projects.push({
    id: `proj_${s.nextId++}`,
    district: target.id,
    monthsLeft: n.months,
    gain: target.foodCapacity * n.capacity_gain_share,
  });
  s.monthsOver[ring] = 0;
  return { state: s, legitimacy: 0, note: "nouvelles_terres:lancee" };
}

/** Remet à zéro les effets politiques cumulés et les rend à l'appelant (légitimité à appliquer côté politique). */
export function drainEffects(s: WallState): {
  state: WallState;
  legitimacy: number;
} {
  const o = cloneWall(s);
  const legitimacy = o.effects.legitimacy;
  o.effects.legitimacy = 0;
  return { state: o, legitimacy };
}
