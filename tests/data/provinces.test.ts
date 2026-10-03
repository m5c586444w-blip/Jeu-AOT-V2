import { describe, expect, it } from "vitest";
import { loadBalanceDir, loadDataDir } from "../../src/data/loadNode";

const { data, issues } = loadDataDir("data");
const byCode = new Map(data.provinces.map((p) => [p.atlas_code, p]));

describe("provinces de Paradis (AC1-01)", () => {
  it("74 provinces valides (06 §1) : 10 outre-murs, 22 segments, 42 provinces", () => {
    expect(issues).toEqual([]);
    expect(data.provinces).toHaveLength(74);
    const count = (k: string) => data.provinces.filter((p) => p.kind === k).length;
    expect([count("outre"), count("segment"), count("province")]).toEqual([10, 22, 42]);
  });
  it("codes de l'atlas complets et uniques", () => {
    const expected = [
      ...Array.from({ length: 10 }, (_, i) => `O${String(i + 1).padStart(2, "0")}`),
      ...Array.from({ length: 8 }, (_, i) => `M0${i + 1}`),
      ...Array.from({ length: 20 }, (_, i) => `R${String(i + 1).padStart(2, "0")}`),
      ...Array.from({ length: 8 }, (_, i) => `W0${i + 1}`),
      ...Array.from({ length: 14 }, (_, i) => `S${String(i + 1).padStart(2, "0")}`),
      ...Array.from({ length: 6 }, (_, i) => `N0${i + 1}`),
      ...Array.from({ length: 8 }, (_, i) => `I0${i + 1}`),
    ];
    expect([...byCode.keys()].sort()).toEqual(expected.sort());
  });
  it("districts rattachés au bon mur (11 §2)", () => {
    for (const c of ["R01"]) expect(byCode.get(c)?.wall).toBe("maria");
    for (const c of ["S01", "S02", "S03", "S04", "S05", "S10", "S13", "S06"]) expect(byCode.get(c)?.wall).toBe("rose");
    for (const c of ["I01", "I03", "I04", "I05", "I08", "I06"]) expect(byCode.get(c)?.wall).toBe("sina");
  });
  it("Utgard détruit en 850 ; Raiberg absent ; W07 annoté « Krolva » (errata)", () => {
    expect(byCode.get("S06")?.destroyed_year).toBe(850);
    expect(JSON.stringify(data.provinces).toLowerCase()).not.toContain("raiberg\"");
    expect(byCode.get("W07")?.notes_canon).toContain("Krolva");
  });
  it("équilibrage et scénario valides", () => {
    expect(loadBalanceDir("data").issues).toEqual([]);
    expect(data.scenarios.map((s) => s.id)).toContain("scn_sandbox_845");
  });
});
