import { describe, expect, it } from "vitest";
import { canAfford, cutWindow, drawFromStock, expectedBattleCost, lancesAvailable, resolveCut, settleBattle, soldierValue, usableStock } from "../../../src/sim/gas";
import type { CutInput } from "../../../src/sim/gas";
import { gb } from "./helpers";

const base: CutInput = { speed: 14, angle: 0.3, skill: 60, bladeWear: 0.2, stress: 0.2 };

describe("P3 fenêtre de coupe", () => {
  it("monotone : vitesse et compétence aident ; angle, usure et stress nuisent", () => {
    const p = (o: Partial<CutInput>) => cutWindow({ ...base, ...o }, gb).probability;
    expect(p({ speed: 20 })).toBeGreaterThanOrEqual(p({ speed: 10 }));
    expect(p({ skill: 90 })).toBeGreaterThanOrEqual(p({ skill: 30 }));
    expect(p({ angle: 1.2 })).toBeLessThanOrEqual(p({ angle: 0.1 }));
    expect(p({ bladeWear: 0.9 })).toBeLessThanOrEqual(p({ bladeWear: 0.1 }));
    expect(p({ stress: 0.9 })).toBeLessThanOrEqual(p({ stress: 0.1 }));
  });
  it("bornée, fenêtre ≈ 0,2 s, cône croissant avec la probabilité, tirage déterministe", () => {
    const w = cutWindow(base, gb);
    expect(w.probability).toBeGreaterThanOrEqual(gb.cut.min_p);
    expect(w.probability).toBeLessThanOrEqual(gb.cut.max_p);
    expect(w.durationS).toBeCloseTo(0.2, 5);
    expect(cutWindow({ ...base, skill: 100 }, gb).coneHalfAngle).toBeGreaterThanOrEqual(cutWindow({ ...base, skill: 0 }, gb).coneHalfAngle);
    expect(resolveCut(w, 0)).toBe("nuque");
    expect(resolveCut(w, 0.999999)).toBe("raté");
    expect(cutWindow(base, gb)).toEqual(cutWindow(base, gb));
  });
});

describe("P3 coût stratégique", () => {
  const inp = { soldiers: 50, densityPerHa: 4, expectedCuts: 10 };
  it("le coût croît avec l'effectif et décroît avec la densité d'ancrage (plaine > forêt)", () => {
    const c = (o: Partial<typeof inp>) => expectedBattleCost({ ...inp, ...o }, gb);
    expect(c({ soldiers: 80 }).gas).toBeGreaterThan(c({ soldiers: 40 }).gas);
    expect(c({ densityPerHa: 0 }).gas).toBeGreaterThanOrEqual(c({ densityPerHa: 3 }).gas);
    expect(c({ densityPerHa: 3 }).gas).toBeGreaterThanOrEqual(c({ densityPerHa: 12 }).gas);
    expect(c({ expectedCuts: 30 }).steel).toBeGreaterThan(c({ expectedCuts: 5 }).steel);
  });
  it("ponction monotone : jamais négative, plus le coût est grand moins il reste, manque signalé", () => {
    const stock = { gas: 3000, steel: 100 };
    let prev = stock.gas + 1;
    for (const g of [0, 500, 1000, 2000, 3000, 5000]) {
      const r = drawFromStock(stock, { gas: g, steel: 10 });
      expect(r.stock.gas).toBeGreaterThanOrEqual(0);
      expect(r.stock.gas).toBeLessThanOrEqual(prev);
      expect(r.drawn.gas + r.shortfall.gas).toBeCloseTo(g, 9);
      prev = r.stock.gas;
    }
    expect(drawFromStock(stock, { gas: 5000, steel: 0 }).shortfall.gas).toBe(2000);
    expect(stock).toEqual({ gas: 3000, steel: 100 });
  });
  it("une victoire qui vide le dépôt rend la suivante inabordable", () => {
    const cost = expectedBattleCost({ soldiers: 60, densityPerHa: 1, expectedCuts: 20 }, gb);
    let stock = { gas: cost.gas * 1.5, steel: cost.steel * 1.5 };
    expect(canAfford(stock, cost)).toBe(true);
    stock = drawFromStock(stock, cost).stock;
    expect(canAfford(stock, cost)).toBe(false);
  });
  it("conservation : engagé = consommé + restitué (au rendement près) ; rien n'est créé", () => {
    const engaged = { gas: 1000, steel: 40 };
    const consumed = { gas: 700, steel: 25 };
    const start = { gas: 2000, steel: 100 };
    const afterDraw = drawFromStock(start, engaged).stock;
    const end = settleBattle(afterDraw, engaged, consumed, gb);
    expect(end.gas).toBeLessThanOrEqual(start.gas - consumed.gas + 1e-9);
    expect(end.gas).toBeCloseTo(afterDraw.gas + 300 * gb.cost.refill_efficiency, 9);
    expect(end.steel).toBe(start.steel - consumed.steel);
    // Sur-consommation déclarée : rien à restituer, pas de gaz créé.
    expect(settleBattle(afterDraw, engaged, { gas: 1500, steel: 50 }, gb)).toEqual(afterDraw);
  });
  it("réserve minimale de dépôt intouchable", () => {
    expect(usableStock({ gas: 300, steel: 5 }, 300, gb).gas).toBeCloseTo(300 * (1 - gb.reserve.depot_min_pct / 100), 9);
    expect(usableStock({ gas: 10, steel: 5 }, 300, gb).gas).toBe(0);
  });
});

describe("P3 lances de foudre", () => {
  it("disponibles à partir de l'année de bascule ; redistribuent la valeur (écart élite/recrue réduit)", () => {
    expect(lancesAvailable(849, gb)).toBe(false);
    expect(lancesAvailable(850, gb)).toBe(true);
    const gap = (l: boolean) => soldierValue(95, l, gb) - soldierValue(10, l, gb);
    expect(gap(true)).toBeLessThan(gap(false));
    expect(soldierValue(10, true, gb)).toBeGreaterThan(soldierValue(10, false, gb));
  });
});
