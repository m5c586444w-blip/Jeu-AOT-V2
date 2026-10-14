import { describe, expect, it } from "vitest";
import {
  abandonDistrict,
  applyDecision,
  breachDistrict,
  conservationGap,
  drainEffects,
  isBreached,
  proposeDecision,
  pressureOf,
  ringPressure,
  setGate,
  stepEvacuationHour,
  stepMonth,
  stepReconquest,
} from "../../../src/sim/wall";
import type { WallState } from "../../../src/sim/wall";
import { at, wb, world3 } from "./helpers";

const evac = (s: WallState, hours: number): WallState => {
  let x = s;
  for (let i = 0; i < hours; i++) x = stepEvacuationHour(x, wb);
  return x;
};
const breached = (): WallState =>
  breachDistrict(world3(), "ma", "ro", 12000, wb);

describe("P1 brèche et évacuation", () => {
  it("seuil de brèche sur l'état du segment", () => {
    expect(isBreached(10, wb)).toBe(true);
    expect(isBreached(80, wb)).toBe(false);
    expect(isBreached(null, wb)).toBe(false);
  });
  it("la brèche place le district en état brèche et ouvre une évacuation, population conservée", () => {
    const s = breached();
    expect(at(s, "ma").status).toBe("breach");
    expect(at(s, "ma").population).toBe(0);
    expect(s.evacuations).toHaveLength(1);
    expect(Math.abs(conservationGap(s))).toBeLessThan(1e-6);
  });
  it("conservation pendant toute l'évacuation : arrivés + morts = population initiale", () => {
    let s = breached();
    const before = at(s, "ro").population;
    for (let h = 0; h < 72; h++) {
      s = stepEvacuationHour(s, wb);
      expect(Math.abs(conservationGap(s))).toBeLessThan(1e-3);
    }
    expect(s.evacuations[0]?.done).toBe(true);
    expect(at(s, "ro").population - before + s.ledger.deaths).toBeCloseTo(
      100000,
      0,
    );
  });
  it("chaque heure de retard coûte des vies : départ retardé => plus de morts", () => {
    const fast = evac(breached(), 72).ledger.deaths;
    const late = (() => {
      let s = setGate(breached(), "rose", false, wb);
      s = evac(s, 10);
      s = setGate(s, "rose", true, wb);
      return evac(s, 62).ledger.deaths;
    })();
    expect(late).toBeGreaterThan(fast);
  });
  it("morts monotones en la durée de fermeture de la porte", () => {
    let prev = -1;
    for (const closedHours of [0, 5, 10, 20]) {
      let s = setGate(breached(), "rose", false, wb);
      s = evac(s, closedHours);
      s = setGate(s, "rose", true, wb);
      const d = evac(s, 100 - closedHours).ledger.deaths;
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
  });
  it("fermer une porte coûte de la légitimité, ouvrir coûte de l'ordre ; effets drainés une fois", () => {
    const s = setGate(world3(), "rose", false, wb);
    const dr = drainEffects(s);
    expect(dr.legitimacy).toBe(wb.breach.closed_gate_legitimacy);
    expect(drainEffects(dr.state).legitimacy).toBe(0);
    const o = setGate(s, "rose", true, wb);
    expect(at(o, "ro").order).toBeLessThan(at(world3(), "ro").order);
  });
  it("l'abandon perd le reste, inscrit aux décès (conservation)", () => {
    const s = abandonDistrict(breached(), "ma");
    expect(at(s, "ma").status).toBe("abandoned");
    expect(
      Math.abs(conservationGap(abandonDistrict(world3(), "ma"))),
    ).toBeLessThan(1e-6);
    expect(Math.abs(conservationGap(s))).toBeLessThan(1e-6);
  });
  it("reconquête progressive : nettoyage, puis repeuplement qui relance la pression du donneur", () => {
    let s = abandonDistrict(world3(), "ma");
    let days = 0;
    while (at(s, "ma").status === "abandoned" && days < 200) {
      s = stepReconquest(s, "ma", "ro", wb);
      days++;
    }
    expect(days).toBeGreaterThan(10);
    expect(days).toBeLessThanOrEqual(
      Math.ceil(1 / wb.reconquest.cleanup_per_day) + 1,
    );
    expect(at(s, "ma").status).toBe("reconquered");
    const ro0 = pressureOf(at(s, "ro"));
    for (let i = 0; i < 30; i++) s = stepReconquest(s, "ma", "ro", wb);
    expect(at(s, "ma").population).toBeGreaterThan(0);
    expect(pressureOf(at(s, "ro"))).toBeLessThan(ro0);
    expect(Math.abs(conservationGap(s))).toBeLessThan(1e-3);
  });
});

describe("P1 désengorgement", () => {
  const hot = (): WallState => {
    let s = world3({ ro: [900000, 700000] });
    for (let i = 0; i < wb.decongest.months_over; i++) s = stepMonth(s, wb);
    return s;
  };
  it("décision proposée après N mois au-dessus du seuil, pas avant", () => {
    let s = world3({ ro: [900000, 700000] });
    for (let i = 0; i < wb.decongest.months_over - 1; i++) s = stepMonth(s, wb);
    expect(proposeDecision(s, wb)).toBeNull();
    s = stepMonth(s, wb);
    const d = proposeDecision(s, wb);
    expect(d?.ring).toBe("rose");
    expect(d?.options).toHaveLength(3);
  });
  it("rationner : légitimité et ordre baissent, population inchangée", () => {
    const r = applyDecision(hot(), "rose", "rationner", 0, 0.5, wb);
    expect(r.legitimacy).toBeLessThan(0);
    expect(at(r.state, "ro").order).toBeLessThan(at(hot(), "ro").order);
    expect(at(r.state, "ro").population).toBe(900000);
  });
  it("désengorger : pression ramenée à la cible, légitimité très négative, population exportée au registre", () => {
    const r = applyDecision(hot(), "rose", "desengorger", 0, 0.5, wb);
    expect(ringPressure(r.state, "rose")).toBeLessThanOrEqual(
      wb.decongest.send_out.target_pressure + 1e-9,
    );
    expect(r.legitimacy).toBeLessThan(
      applyDecision(hot(), "rose", "rationner", 0, 0.5, wb).legitimacy,
    );
    expect(r.state.ledger.exported).toBeGreaterThan(0);
    expect(Math.abs(conservationGap(r.state))).toBeLessThan(1e-3);
    expect(r.state.monthsOver.rose).toBe(0);
    expect(r.lostOutside).toBeGreaterThan(0);
    expect(r.lostOutside).toBeCloseTo(
      r.state.ledger.exported * wb.decongest.send_out.loss_share,
      6,
    );
    expect(r.lostOutside).toBeLessThanOrEqual(r.state.ledger.exported);
  });
  it("nouvelles terres : goldCost renvoyé (lancée et échec), 0 si refusée ; l'échec remet monthsOver à 0", () => {
    const g = wb.decongest.new_land.gold_cost;
    expect(
      applyDecision(hot(), "rose", "nouvelles_terres", 1e9, 0.99, wb).goldCost,
    ).toBe(g);
    const fail = applyDecision(hot(), "rose", "nouvelles_terres", 1e9, 0, wb);
    expect(fail.goldCost).toBe(g);
    expect(fail.state.monthsOver.rose).toBe(0);
    const no = applyDecision(hot(), "rose", "nouvelles_terres", 0, 0.9, wb);
    expect(no.goldCost).toBe(0);
    expect(applyDecision(hot(), "rose", "rationner", 0, 0.5, wb).goldCost).toBe(
      0,
    );
  });
  it("nouvelles terres : refusées sans or ; échec selon l'aléa injecté ; succès => capacité accrue après les mois", () => {
    expect(
      applyDecision(hot(), "rose", "nouvelles_terres", 0, 0.9, wb).note,
    ).toContain("refusee");
    const fail = applyDecision(hot(), "rose", "nouvelles_terres", 1e9, 0, wb);
    expect(fail.note).toContain("echec");
    expect(Math.abs(conservationGap(fail.state))).toBeLessThan(1e-3);
    let s = applyDecision(
      hot(),
      "rose",
      "nouvelles_terres",
      1e9,
      0.99,
      wb,
    ).state;
    const cap0 = at(s, "ro").foodCapacity;
    for (let i = 0; i < wb.decongest.new_land.months; i++) s = stepMonth(s, wb);
    expect(at(s, "ro").foodCapacity).toBeGreaterThan(cap0);
  });
  it("déterminisme des décisions (mêmes arguments => même résultat)", () => {
    const a = applyDecision(hot(), "rose", "desengorger", 0, 0.3, wb);
    const b = applyDecision(hot(), "rose", "desengorger", 0, 0.3, wb);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
