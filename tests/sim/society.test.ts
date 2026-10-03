import { describe, expect, it } from "vitest";
import { replayFactors } from "../../src/sim/core/explain";
import { economyMods } from "../../src/sim/politics/politics";
import { provinceComposition, strataMoraleEffect } from "../../src/sim/politics/society";
import { planDay } from "../../src/sim/strategic/economy";
import { pol, start, strat, world850 } from "./politics-helpers";

const pw = world850.politics;

describe("strates (AC2-03, F-POP-01, F-POP-02)", () => {
  it("8 strates ; la composition de chaque province habitée somme à 1", () => {
    expect(pw?.strata).toHaveLength(8);
    for (const p of world850.provinces) {
      if (!pw) break;
      const comp = provinceComposition(world850, pw, p);
      expect(Object.keys(comp)).toHaveLength(8);
      expect(Object.values(comp).reduce((a, b) => a + b, 0), p.id).toBeCloseTo(1, 9);
    }
  });
  it("réfugiés : 20 % dans l'anneau de Rose, 5 % dans Sina (scénario 850)", () => {
    if (!pw) throw new Error();
    const trost = world850.provinceById.get("prov_trost");
    const mitras = world850.provinceById.get("prov_mitras");
    if (!trost || !mitras) throw new Error();
    expect(provinceComposition(world850, pw, trost)["str_refugies"]).toBeCloseTo(0.2, 9);
    expect(provinceComposition(world850, pw, mitras)["str_refugies"]).toBeCloseTo(0.05 + 0.05 * 0.95, 9);
  });
  it("la satisfaction des strates entre dans la cible de moral, avec une explication cohérente", () => {
    if (!pw) throw new Error();
    const s = start();
    const p = pol(s);
    const unhappy = structuredClone(p);
    for (const st of Object.values(unhappy.strata)) st.satisfaction = 20;
    const mods = economyMods(world850, unhappy, strat(s));
    const plan = planDay(world850, strat(s), s.date, mods);
    const target = plan.moraleTarget["prov_trost"];
    const factor = target?.factors.find((f) => f.key === "why.morale_strata");
    const trost = world850.provinceById.get("prov_trost");
    if (!trost || !target) throw new Error();
    expect(factor?.value).toBeCloseTo(strataMoraleEffect(world850, pw, unhappy, trost), 9);
    expect(factor?.value).toBeLessThan(0);
    expect(replayFactors(target.factors)).toBeCloseTo(target.value, 9);
  });
});
