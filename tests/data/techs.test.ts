import { describe, expect, it } from "vitest";
import { TECH_HOOKS } from "../../src/data/effects";
import { loadWorld } from "../../src/data/worldNode";
import fr from "../../src/i18n/fr.json";

const world = loadWorld("data", "scn_sandbox_850");
const dict = fr as Record<string, string>;
const techs = [...(world.research?.techs.values() ?? [])];

describe("technologies de P5 (AC5-01, F-TEC-01, F-TEC-16)", () => {
  it("76 technologies du fichier 13 en 9 arbres, plus 12 doctrines ; chacune a min_year et un nom", () => {
    const regular = techs.filter((t) => !t.doctrine);
    expect(regular).toHaveLength(76);
    expect(new Set(regular.map((t) => t.tree)).size).toBe(9);
    expect(techs.filter((t) => t.doctrine)).toHaveLength(12);
    for (const t of techs) {
      expect(t.min_year, t.id).toBeGreaterThan(0);
      expect(dict[`tech.${t.id}`], t.id).toBeTruthy();
      expect(dict[`tech.${t.id}.sheet`], t.id).toBeTruthy();
    }
  });

  it("toute technologie C datée de 850 ou après a un unlock_event (13 §0, règle R1) ; anachronismes du fichier 13 §11", () => {
    for (const t of techs.filter((x) => x.canon === "C" && x.min_year >= 850)) expect(t.unlock_event, t.id).toBeDefined();
    const byCode = new Map(techs.map((t) => [t.code, t]));
    expect(byCode.get("T-ANT-08")?.unlock_event).toBe("evt_850_police_tech_seized");
    expect(byCode.get("T-ANT-08")?.requires_character).toBe("char_hange_zoe");
    expect(byCode.get("T-FOR-03")?.unlock_event).toBe("evt_850_trost_plug");
    expect(byCode.get("T-ODM-06")?.unlock_event).toBe("evt_850_levi_kenny_street_fight");
    expect(byCode.get("T-LOG-05")?.unlock_event).toBe("evt_851_hizuru_visit");
    expect(byCode.get("T-MED-05")?.unlock_event).toEqual(["evt_850_rod_reiss_titan", "evt_851_volunteers"]);
  });

  it("effets : crochets connus ; toute technologie sans effet ni départ annonce sa phase", () => {
    for (const t of techs) {
      for (const e of t.effects) expect(TECH_HOOKS).toContain(e.hook);
      if (t.effects.length === 0 && !t.start) expect(t.mechanic_phase, t.id).toBeDefined();
    }
    expect(techs.filter((t) => t.effects.length > 0).length).toBeGreaterThanOrEqual(12);
  });
});
