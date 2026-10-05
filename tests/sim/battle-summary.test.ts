import { describe, expect, it } from "vitest";
import { runBattle } from "../../src/sim/tactical/battle";
import { skirmishSetup } from "../../src/sim/tactical/setup";
import { battleSummary } from "../../src/ui/tactical/summary";
import { world } from "./tactical-helpers";

/**
 * R0.2e : bilan « Coupes réussies 0 / Gaz consommé 0 » avec un Titan abattu (essai de porteur, lances de foudre).
 * Le Cuirassé meurt aux lances de foudre tirées du sol : aucune coupe, aucun gaz. Le bilan doit le dire, et
 * « Coupes réussies » doit compter les coupes qui ont porté, pas les tentatives.
 */
describe("bilan de bataille (R0.2e)", () => {
  it("un porteur abattu aux lances de foudre est attribué aux lances ; le bilan l'explique", () => {
    const base = skirmishSetup(world, "tmap_foret", [], 18, 2, false);
    const r = runBattle(world, { ...base, shifters: [{ shifter: "shifter_cuirasse", side: "ennemi", name: "X", character: null, stress: 20 }], thunderSpears: true, flags: [] });
    const s = r.state.stats;
    expect(s.cuts).toBe(0);
    expect(s.killedBy?.lance).toBe(1);
    const rows = battleSummary(r.state);
    const killed = rows.find((x) => x.key === "tac.sum.napes");
    expect(killed?.value).toBe(1);
    expect(killed?.why).toContain("tac.sum.by_lance");
    expect(rows.find((x) => x.key === "tac.sum.spears")?.value).toBe(s.spears?.hits);
  });

  it("« Coupes réussies » compte les coupes qui ont porté (nuque ou membre), au plus les tentatives", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = runBattle(world, skirmishSetup(world, "tmap_plaine", [{ type: "ttype_grand_errant", count: 1 }], 12, seed, false));
      const s = r.state.stats;
      expect(s.cutsLanded, `graine ${seed}`).toBe((s.killedBy?.lame ?? 0) + s.limbs);
      expect(s.cutsLanded ?? 0).toBeLessThanOrEqual(s.cuts);
      const rows = battleSummary(r.state);
      expect(rows.find((x) => x.key === "tac.sum.cuts")?.value).toBe(s.cutsLanded);
      expect(rows.find((x) => x.key === "tac.sum.napes")?.value).toBe(Object.values(s.titansKilled).reduce((a, b) => a + b, 0));
    }
  });
});
