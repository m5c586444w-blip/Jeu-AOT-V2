import { describe, expect, it } from "vitest";
import { Explainer } from "../../src/sim/core/explain";
import { WHY_LEVELS, whyModel } from "../../src/ui/why";

// U4 : infobulle de calcul à trois niveaux au plus — (1) titre et valeur, (2) sections et sous-totaux, (3) facteurs —
// bonus et malus colorés (sens inversé pour une dépense) ; U10 : le raccourci figure en pied.
describe("infobulles de calcul (U4, U10)", () => {
  const prod = new Explainer().base("why.base", 100).add("why.season", 20).mul("why.rationing", 0.8).done();
  const cons = new Explainer().base("why.base", 50).add("why.season", 10).done();

  it("trois niveaux : titre et valeur, sections avec sous-total, lignes de facteurs", () => {
    const m = whyModel({ title: "Nourriture", value: "+16", sections: [{ label: "Production", explained: prod }, { label: "Consommation", explained: cons, cost: true }, { text: "Note" }], key: "V" });
    expect(WHY_LEVELS).toBe(3);
    expect(m.title).toBe("Nourriture");
    expect(m.value).toBe("+16");
    expect(m.sections.map((s) => s.subtotal)).toEqual(["96", "60", undefined]);
    expect(m.sections[0]?.rows).toHaveLength(3);
    // Aucun niveau au-delà du troisième : une ligne de facteur n'a ni sous-section ni sous-lignes.
    for (const s of m.sections) for (const r of s.rows) expect(Object.keys(r).sort()).toEqual(expect.arrayContaining(["label", "value"]));
    for (const s of m.sections) for (const r of s.rows) expect(Object.keys(r).every((k) => ["label", "value", "sign"].includes(k))).toBe(true);
    expect(m.key).toBe("V");
  });

  it("bonus en plus, malus en moins ; base neutre ; sens inversé pour une dépense", () => {
    const m = whyModel({ title: "x", sections: [{ explained: prod }, { explained: cons, cost: true }] });
    expect(m.sections[0]?.rows.map((r) => r.sign)).toEqual([undefined, "plus", "moins"]);
    expect(m.sections[1]?.rows.map((r) => r.sign)).toEqual([undefined, "moins"]);
    expect(m.sections[0]?.rows.map((r) => r.value)).toEqual(["100", "+20", "×0,8"]);
  });

  it("sous-total signé et unité", () => {
    const m = whyModel({ title: "x", sections: [{ label: "Net", explained: new Explainer().base("why.base", -12).done(), signed: true, unit: " / j" }] });
    expect(m.sections[0]?.subtotal).toBe("−12 / j");
  });
});
