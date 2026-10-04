import { describe, expect, it } from "vitest";
import { loadDataDir } from "../../src/data/loadNode";
import { loadWorld } from "../../src/data/worldNode";
import fr from "../../src/i18n/fr.json";

const { data, issues } = loadDataDir("data");

describe("données tactiques (AC4-01)", () => {
  it("valides : 8 types de Titans purs (4 anormaux), 4 cartes ; textes en français", () => {
    expect(issues).toEqual([]);
    expect(data.titan_types).toHaveLength(8);
    expect(data.titan_types.filter((t) => t.class === "titan_anormal")).toHaveLength(4);
    expect(data.tactical_maps.map((m) => m.terrain).sort()).toEqual(["foret", "mur", "plaine", "ville"]);
    for (const k of [...data.titan_types, ...data.tactical_maps].map((x) => x.name_key)) expect(k in fr, k).toBe(true);
    expect(data.titan_types.reduce((s, t) => s + t.weight, 0)).toBeCloseTo(1, 9);
  });

  it("aucune variante de comportement présentée comme canon ; les faits canon cités restent sourcés", () => {
    for (const t of data.titan_types) expect(t.canon, t.id).toBe("A");
    const forest = data.tactical_maps.find((m) => m.terrain === "foret");
    expect(forest?.notes_canon).toContain("80 m");
    const wall = data.tactical_maps.find((m) => m.terrain === "mur")?.bricks.find((b) => b.kind === "mur");
    expect(wall?.kind === "mur" ? wall.height_m : null).toEqual([50, 50]);
  });

  it("équilibrage : portée des crochets marquée « ? » (40–60 m, 03 §3.2) ; réservoir 100 u ; 20 Hz", () => {
    const t = loadWorld("data", "scn_sandbox_850").tactical?.balance;
    expect(t?.odm.hook_range_canon).toBe("?");
    expect(t?.odm.hook_range_m).toBeGreaterThanOrEqual(40);
    expect(t?.odm.hook_range_m).toBeLessThanOrEqual(60);
    expect(t?.odm.tank).toBe(100);
    expect(t?.tick_hz).toBe(20);
  });
});
