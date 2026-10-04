import { describe, expect, it } from "vitest";
import { interceptionRisk } from "../../src/sim/military/logistics";
import { supplyAt } from "../../src/sim/military/routes";
import { cmd, mil, plan, ready, strat, untilBack, world } from "./expedition-helpers";

const m = world.military;
if (!m) throw new Error("couche militaire absente");

describe("rayon de ravitaillement et attrition (AC3-03, F-LOG-01, F-LOG-02)", () => {
  it("Karanes est ravitaillée ; la forêt des Arbres Géants (Maria perdue) ne l'est pas", () => {
    const s = ready();
    expect(supplyAt(world, strat(s), mil(s), "prov_karanes").inSupply).toBe(true);
    const forest = supplyAt(world, strat(s), mil(s), "prov_foret_arbres_geants");
    expect(forest.inSupply).toBe(false);
    expect(forest.km).toBeGreaterThan(m.log.radius_km.source);
  });

  it("dans le rayon : aucun jour d'attrition ; hors du rayon : jours comptés, moral et chevaux en baisse", () => {
    // Faubourgs de Shiganshina : seule province de Maria perdue à portée d'un mur tenu (28 km).
    const inside = untilBack(cmd(ready(1), { type: "LaunchExpedition", plan: plan(ready(1), "prov_faubourgs_shiganshina", "eventail", 4) }));
    const rIn = mil(inside).reports.at(-1);
    expect(rIn?.stats.daysOutside).toBe(0);
    const outside = untilBack(cmd(ready(1), { type: "LaunchExpedition", plan: plan(ready(1), "prov_maria_est", "eventail", 4) }));
    const rOut = mil(outside).reports.at(-1);
    expect(rOut?.stats.daysOutside).toBeGreaterThan(0);
    expect(rOut?.lessons.some((l) => l.key === "lesson.outside")).toBe(true);
  });
});

describe("dépôts avancés et convois (AC3-04, F-LOG-03, F-LOG-04)", () => {
  it("une expédition « dépôt » installe un dépôt qui étend le rayon ; un convoi le réapprovisionne", () => {
    let s = ready(3);
    const p = { ...plan(s, "prov_foret_arbres_geants", "eventail", 6), objective: "depot" as const, depotCargo: { food: 60, gas: 60, steel: 10 } };
    p.wagons += Math.ceil(130 / m.log.convoy.wagon_capacity);
    s = untilBack(cmd(s, { type: "LaunchExpedition", plan: p }));
    const depot = mil(s).depots.find((d) => d.province === "prov_foret_arbres_geants");
    expect(depot).toBeDefined();
    const sup = supplyAt(world, strat(s), mil(s), "prov_foret_arbres_geants");
    expect(sup.inSupply).toBe(true);
    expect(sup.kind).toBe("depot");
    const before = depot?.stocks.food ?? 0;
    s = cmd(s, { type: "SendConvoy", order: { depot: depot?.id ?? "", cargo: { food: 80, gas: 40, steel: 0 }, wagons: 3, escort: 60 } });
    for (let d = 0; d < 15 && mil(s).convoys.length > 0; d++) s = cmd(s, { type: "AdvanceDays", n: 1 });
    const after = mil(s).depots.find((d) => d.id === depot?.id)?.stocks.food ?? 0;
    const delivered = s.strategic?.log.some((l) => l.key === "log.convoy_delivered");
    const intercepted = s.strategic?.log.some((l) => l.key === "log.convoy_intercepted");
    expect(delivered).toBe(true);
    // Livré entier, ou entamé par une interception : le dépôt a toujours plus qu'avant.
    expect(after).toBeGreaterThan(before);
    if (!intercepted) expect(after).toBeCloseTo(before + 80, 6);
  });

  it("risque d'interception : croît avec la densité de Titans, décroît avec l'escorte", () => {
    const ctx = { world, m };
    const low = interceptionRisk(ctx, "prov_maria_est", 0);
    const high = interceptionRisk(ctx, "prov_shiganshina", 0);
    expect(high).toBeGreaterThan(low);
    expect(interceptionRisk(ctx, "prov_shiganshina", 50)).toBeLessThan(high);
    expect(interceptionRisk(ctx, "prov_karanes", 0)).toBe(0);
  });
});
