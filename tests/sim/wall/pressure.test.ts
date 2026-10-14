import { describe, expect, it } from "vitest";
import {
  breachDistrict,
  proposeDecision,
  stepEvacuationHour,
  conservationGap,
  levelOf,
  perceivedPressure,
  pressureOf,
  ringPressure,
  stepDay,
  stepMonth,
  wallFromProvinces,
} from "../../../src/sim/wall";
import type { ProvinceState } from "../../../src/sim/strategic/economy";
import type { WallState } from "../../../src/sim/wall";
import { applyDecision } from "../../../src/sim/wall";
import { at, district, wb, world3 } from "./helpers";

const run = (s: WallState, days: number): WallState => {
  let x = s;
  for (let i = 0; i < days; i++) x = stepDay(x, wb);
  return x;
};

describe("P1 pression", () => {
  it("pression = population / capacité ; niveaux ordonnés par seuils", () => {
    expect(pressureOf({ population: 90, foodCapacity: 100 })).toBeCloseTo(0.9);
    expect(pressureOf({ population: 5, foodCapacity: 0 })).toBe(
      Number.POSITIVE_INFINITY,
    );
    const l = (p: number) => levelOf(p, wb);
    expect([l(0.5), l(0.9), l(1.1), l(1.5)]).toEqual([
      "calme",
      "tendu",
      "critique",
      "rupture",
    ]);
  });
  it("monotone : plus de population ou moins de capacité => pression et niveau jamais plus bas", () => {
    let prev = -1;
    for (let pop = 0; pop <= 200000; pop += 10000) {
      const p = pressureOf({ population: pop, foodCapacity: 100000 });
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
    const order = ["calme", "tendu", "critique", "rupture"];
    const lv = (cap: number) =>
      order.indexOf(
        levelOf(pressureOf({ population: 100000, foodCapacity: cap }), wb),
      );
    for (let cap = 200000; cap > 50000; cap -= 10000)
      expect(lv(cap - 10000)).toBeGreaterThanOrEqual(lv(cap));
  });
  it("déterminisme : même état => même état au jour N, entrée non mutée", () => {
    const s = world3();
    const snap = JSON.stringify(s);
    expect(JSON.stringify(run(s, 60))).toBe(JSON.stringify(run(s, 60)));
    expect(JSON.stringify(s)).toBe(snap);
  });
  it("conservation : population = départ + naissances - décès - exportés, sur un an", () => {
    const s = run(world3({ ma: [140000, 90000] }), 365);
    expect(Math.abs(conservationGap(s))).toBeLessThan(1e-3);
  });
  it("les réfugiés quittent un district tendu vers un voisin moins pressé, sans fuite de population", () => {
    const s0 = world3({ ma: [140000, 90000] });
    const s = run(s0, 30);
    expect(at(s, "ma").population).toBeLessThan(at(s0, "ma").population);
    expect(at(s, "ro").population).toBeGreaterThan(at(s0, "ro").population - 1);
    expect(Math.abs(conservationGap(s))).toBeLessThan(1e-3);
  });
  it("porte d'accueil fermée : aucun flux de réfugiés", () => {
    const s0 = world3({ ma: [140000, 90000] });
    s0.gates.rose = false;
    const s = run(s0, 10);
    expect(at(s, "ro").population).toBeGreaterThan(0);
    expect(at(s, "ro").population).toBeLessThan(
      at(s0, "ro").population * (1 + wb.pressure.birth_per_day * 10) + 1,
    );
  });
  it("l'ordre public baisse sous pression critique, les épidémies tuent plus qu'en régime calme", () => {
    const calm = at(run(world3({ ma: [50000, 90000] }), 120), "ma");
    const hot = run(world3({ ma: [140000, 90000] }), 1);
    const crit = (() => {
      const s0 = world3({ ma: [140000, 90000] });
      s0.gates.rose = false; // pas d'échappatoire
      return at(run(s0, 120), "ma");
    })();
    expect(crit.order).toBeLessThan(calm.order);
    expect(hot.ledger.deaths / 140000).toBeGreaterThan(
      wb.pressure.death_per_day,
    );
  });
  it("mois au-dessus du seuil : compteur croissant, remis à 0 si la pression retombe", () => {
    let s = world3({ ma: [140000, 90000] });
    s.gates.rose = false;
    for (let i = 0; i < 4; i++) s = stepMonth(s, wb);
    expect(s.monthsOver.maria).toBe(4);
    at(s, "ma").population = 10000;
    expect(stepMonth(s, wb).monthsOver.maria).toBe(0);
  });
  it("brouillard : un district non visité ne donne pas sa pression exacte", () => {
    const d = at(world3(), "ma");
    expect(perceivedPressure(d, false, wb).exact).toBeNull();
    expect(perceivedPressure(d, true, wb).exact).toBeCloseTo(pressureOf(d));
    const b = perceivedPressure(d, false, wb).band;
    expect(pressureOf(d)).toBeGreaterThanOrEqual(b[0]);
    expect(pressureOf(d)).toBeLessThan(b[1]);
  });
  it("scénario sans intervention : Maria tombe, la pression de Rose franchit le seuil critique avant 12 mois et la décision est proposée", () => {
    let s = world3({
      ma: [300000, 300000],
      ro: [450000, 700000],
      si: [300000, 600000],
    });
    s.gates.sina = false; // l'anneau intérieur ferme sa porte : rien ne soulage Rose
    s = breachDistrict(s, "ma", "ro", 12000, wb);
    for (let h = 0; h < 96; h++) s = stepEvacuationHour(s, wb);
    let month = 0;
    let decided = false;
    for (; month < 12; month++) {
      s = run(s, 30);
      s = stepMonth(s, wb);
      decided ||= proposeDecision(s, wb)?.ring === "rose";
      if (ringPressure(s, "rose") >= wb.pressure.critique && decided) break;
    }
    expect(month).toBeLessThan(12);
    expect(decided).toBe(true);
  });
  it("pont économie : population lue sur les provinces, provinces non modifiées", () => {
    const prov: Record<string, ProvinceState> = {
      a: {
        control: "paradis",
        population: 1000,
        morale: 50,
        stability: 60,
        garrison: null,
        buildings: [],
        wall_structure: null,
      },
    };
    const snap = JSON.stringify(prov);
    const w = wallFromProvinces(prov, {
      a: { ring: "maria", capacity: 800, neighbors: [] },
    });
    expect(at(w, "a").population).toBe(1000);
    expect(w.ledger.start).toBe(1000);
    expect(JSON.stringify(prov)).toBe(snap);
  });
});

describe("P1 correctifs revue (C6b)", () => {
  it("max_pressure_after garanti avec plusieurs sources vers une même cible", () => {
    const base = world3();
    const s0: WallState = {
      ...base,
      districts: {
        a: district("a", "maria", 200000, 100000, ["t"]),
        b: district("b", "maria", 200000, 100000, ["t"]),
        c: district("c", "maria", 200000, 100000, ["t"]),
        t: district("t", "rose", 90000, 100000, ["a", "b", "c"]),
      },
    };
    s0.ledger.start = 690000;
    const before = pressureOf(at(s0, "t"));
    const s = stepDay(s0, wb);
    expect(pressureOf(at(s, "t"))).toBeLessThanOrEqual(
      Math.max(before, wb.refugees.max_pressure_after) + 1e-9,
    );
    expect(at(s, "t").population).toBeGreaterThan(at(s0, "t").population);
    expect(Math.abs(conservationGap(s))).toBeLessThan(1e-3);
    expect(JSON.stringify(stepDay(s0, wb))).toBe(JSON.stringify(s));
  });
  it("rationner : rations plafonnées les jours suivants, capacité étirée, puis retour à la normale", () => {
    let s = world3({ ro: [500000, 700000] });
    s = applyDecision(s, "rose", "rationner", 0, 0.5, wb).state;
    const r0 = at(s, "ro").rations;
    expect(r0).toBeLessThanOrEqual(wb.decongest.ration.ration_mult + 1e-9);
    s = run(s, 1);
    expect(at(s, "ro").rations).toBeLessThanOrEqual(
      wb.decongest.ration.ration_mult + 1e-9,
    );
    expect(at(s, "ro").rations).toBeLessThan(1);
    s = run(s, wb.decongest.ration.duration_days);
    expect(at(s, "ro").rationPolicy).toBeUndefined();
    s = run(s, 30);
    expect(at(s, "ro").rations).toBe(1);
  });
  it("pressure_relief_capacity_mult est appliqué : moins de décès en épidémie avec rationnement", () => {
    const hotW = (): WallState => world3({ ro: [740000, 700000] });
    const plain = run(hotW(), 20);
    const rat = run(
      applyDecision(hotW(), "rose", "rationner", 0, 0.5, wb).state,
      20,
    );
    expect(rat.ledger.deaths).toBeLessThan(plain.ledger.deaths);
  });
});
