import { describe, expect, it } from "vitest";
import { adviceFor, createClockState, controlOf, deployBearer, effectiveYears, isExhausted, nineViolations, projectionCost, registerBearer, rosterOf, syncBearers, yearsLeftOf } from "../../../src/sim/clock";
import type { Bearer } from "../../../src/sim/clock";
import { cb, input, nineState, slot, tweak } from "./helpers";

describe("P5 (a) invariant des Neuf", () => {
  it("état conforme : aucune violation, même avec un porteur de deux Titans et des pouvoirs perdus", () => {
    const s = nineState({ shifter_assaillant: slot("eren", "paradis", 845), shifter_fondateur: slot("eren", "paradis", 845) });
    expect(nineViolations(s, cb)).toEqual([]);
  });
  it("détecte manquant, intrus, perdu mais détenu, détenteur mort", () => {
    const s = nineState({});
    delete s.titans["shifter_marteau"];
    s.titans["shifter_dixieme"] = slot(null, "perdu", 840);
    s.titans["shifter_bestial"] = slot("zeke", "perdu", 840);
    s.titans["shifter_colossal"] = slot("bert", "marley", 840);
    const v = nineViolations(s, cb, (c) => c !== "bert");
    expect(v).toEqual(expect.arrayContaining(["manquant : shifter_marteau", "intrus : shifter_dixieme", "shifter_bestial : perdu mais détenu par zeke", "shifter_colossal : détenteur mort bert"]));
    expect(v).toHaveLength(4);
  });
  it("la liste des Neuf vient des données (changer `nine` change le verdict)", () => {
    const b = { ...cb, nine: [...cb.nine.slice(0, 8), "shifter_autre"] };
    expect(nineViolations(nineState({}), b)).toHaveLength(2);
  });
});

describe("P5 horloge utile et roster", () => {
  const b = (o: Partial<Bearer> = {}): Bearer => ({ ...(registerBearer(createClockState(), input("b"), cb).bearers["b"] as Bearer), ...o });
  it("yearsLeftOf = curse − (année − since)", () => {
    expect(yearsLeftOf(845, 850, 13)).toBe(8);
    expect(yearsLeftOf(838, 851, 13)).toBe(0);
  });
  it("coût de projection linéaire en jours ; wear_years_per_day, deploy_capital et capital_per_day sont tous lus", () => {
    expect(projectionCost(0, cb)).toEqual({ capital: cb.roster.deploy_capital, wearYears: 0 });
    const c10 = projectionCost(10, cb);
    expect(c10.wearYears).toBeCloseTo(10 * cb.roster.wear_years_per_day, 12);
    expect(c10.capital).toBeCloseTo(cb.roster.deploy_capital + 10 * cb.roster.capital_per_day, 12);
    expect(projectionCost(10, tweak("roster", { wear_years_per_day: 0.1 })).wearYears).toBeCloseTo(1, 12);
    expect(() => projectionCost(-1, cb)).toThrow(RangeError);
  });
  it("projeter use les années utiles mais jamais l'horloge canonique ; cumulatif ; inconnu sans effet", () => {
    let s = registerBearer(createClockState(), input("b"), cb);
    const sh = nineState({ shifter_cuirasse: slot("b", "marley", 843) });
    const since = sh.titans["shifter_cuirasse"]?.since;
    s = deployBearer(s, "b", 100, cb).state;
    s = deployBearer(s, "b", 100, cb).state;
    expect(s.bearers["b"]?.wearYears).toBeCloseTo(200 * cb.roster.wear_years_per_day, 9);
    expect(sh.titans["shifter_cuirasse"]?.since).toBe(since);
    expect(effectiveYears(s.bearers["b"] as Bearer, 6)).toBeCloseTo(6 - 200 * cb.roster.wear_years_per_day, 9);
    expect(deployBearer(s, "zz", 5, cb)).toEqual({ state: s, cost: { capital: 0, wearYears: 0 } });
  });
  it("épuisé quand les années utiles tombent à exhausted_below_years ; l'épuisement coûte du contrôle", () => {
    const fresh = b();
    const worn = b({ wearYears: 5 });
    expect(isExhausted(fresh, 5, cb)).toBe(false);
    expect(isExhausted(worn, 5, cb)).toBe(true);
    expect(isExhausted(worn, 5, tweak("roster", { exhausted_below_years: -1 }))).toBe(false);
    expect(controlOf(worn, null, cb, isExhausted(worn, 5, cb))).toBeLessThan(controlOf(worn, null, cb, false));
  });
  it("conseil : utiliser sous use_now_years (inclus), garder au-dessus", () => {
    expect(adviceFor(cb.roster.use_now_years, cb)).toBe("utiliser");
    expect(adviceFor(cb.roster.use_now_years + 0.01, cb)).toBe("garder");
    expect(adviceFor(5, tweak("roster", { use_now_years: 6 }))).toBe("utiliser");
  });
  it("roster de la faction : les plus pressés d'abord, usure comprise, Titans multiples = horloge la plus courte", () => {
    const sh = nineState({
      shifter_cuirasse: slot("a", "marley", 843),
      shifter_colossal: slot("b", "marley", 846),
      shifter_bestial: slot("b", "marley", 842),
      shifter_assaillant: slot("p", "paradis", 845),
    });
    let s = createClockState();
    for (const id of ["a", "b"]) s = registerBearer(s, input(id), cb);
    s = registerBearer(s, input("p", { faction: "paradis" }), cb);
    const r = rosterOf(s, sh, "marley", 850, 13, cb);
    expect(r.map((e) => e.bearer)).toEqual(["b", "a"]);
    expect(r[0]).toMatchObject({ yearsLeft: 5, titans: ["shifter_bestial", "shifter_colossal"], advice: "garder" });
    expect(r[1]).toMatchObject({ yearsLeft: 6 });
    const worn = deployBearer(s, "a", 400, cb).state;
    const r2 = rosterOf(worn, sh, "marley", 850, 13, cb);
    expect(r2[0]?.bearer).toBe("a");
    expect(r2[0]?.effectiveYears).toBeCloseTo(6 - 400 * cb.roster.wear_years_per_day, 9);
    expect(r2[0]?.advice).toBe("utiliser");
    expect(rosterOf(s, sh, "paradis", 850, 13, cb).map((e) => e.bearer)).toEqual(["p"]);
  });
});

describe("P5 accord avec l'héritage et la malédiction", () => {
  it("un suivi qui ne tient plus de Titan est retiré avec ses soupçons ; un nouveau détenteur est signalé", () => {
    let s = createClockState();
    s = registerBearer(s, input("vieux"), cb);
    s = { ...s, suspects: { vieux: { paradis: { value: 40, lastEvidenceDay: 1, closed: false } } } };
    const sh = nineState({ shifter_cuirasse: slot("jeune", "paradis", 850) });
    const r = syncBearers(s, sh);
    expect(r.removed).toEqual(["vieux"]);
    expect(r.state.bearers).toEqual({});
    expect(r.state.suspects).toEqual({});
    expect(r.unregistered).toEqual([{ holder: "jeune", titans: ["shifter_cuirasse"] }]);
    expect(syncBearers(r.state, sh).removed).toEqual([]);
    expect(s.bearers["vieux"]).toBeDefined();
  });
});
