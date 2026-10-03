import { describe, expect, it } from "vitest";
import fr from "../../src/i18n/fr.json";
import { loadDataDir } from "../../src/data/loadNode";

const { data, issues } = loadDataDir("data");

describe("graine de données P0 (T0.14)", () => {
  it("valide", () => {
    expect(issues).toEqual([]);
  });
  it("contenu minimal du fichier 14 §3.3", () => {
    for (const code of ["I01", "M05", "R01", "S01", "S06"]) expect(data.provinces.map((p) => p.atlas_code)).toContain(code);
    expect(data.provinces.find((p) => p.atlas_code === "S06")?.destroyed_year).toBe(850);
    expect(data.characters).toHaveLength(6);
    expect(data.techs.find((t) => t.code === "T-ANT-08")?.unlock_event).toBe("evt_850_police_tech_seized");
    expect(data.techs.find((t) => t.code === "T-FOR-03")?.unlock_event).toBe("evt_850_trost_plug");
    const codes = data.events.map((e) => e.code).filter(Boolean);
    for (let n = 9; n <= 42; n++) expect(codes).toContain(`E${String(n).padStart(2, "0")}`);
  });
  it("errata appliqués", () => {
    const ch = (id: string) => data.characters.find((c) => c.id === id);
    expect(ch("char_erwin_smith")?.death_event).toBe("evt_850_erwin_charge");
    expect(ch("char_mike_zacharias")?.death_event).toBe("evt_850_wall_rose_invasion");
    expect(ch("char_kenny_ackerman")?.death_event).toBe("evt_850_rod_reiss_titan");
    const rifle = data.events.find((e) => e.id === "evt_850_marley_antititan_rifle");
    expect(rifle?.canon).toBe("?");
    expect(rifle?.window.after).toBe("evt_850_armored_colossal_fight");
    expect(data.events.find((e) => e.code === "E31")?.location).toBe("?");
  });
  it("toutes les clés de texte des données existent dans fr.json", () => {
    const keys = [
      ...data.provinces.flatMap((p) => [p.name_key, p.desc_key ?? p.name_key, ...(p.poi ?? []).map((x) => x.name_key)]),
      ...data.events.map((e) => e.text_key),
      ...data.buildings.map((b) => b.name_key),
      ...data.scenarios.map((s) => s.name_key),
    ];
    expect(keys.filter((k) => !(k in fr))).toEqual([]);
  });
});
