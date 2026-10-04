import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { alertText } from "../../src/ui/hud";

const world = loadWorld("data", "scn_sandbox_850");

describe("texte des alertes (AC3-11 : aucun identifiant brut)", () => {
  it("provinces et personnages traduits dans le bandeau", () => {
    const text = alertText({ key: "log.expedition_departed", params: { n: 1, soldiers: 104, target: "prov_maria_est" } }, world);
    expect(text).toContain("Maria-Est");
    expect(text).not.toMatch(/prov_|char_/);
    expect(alertText({ key: "field.officer_killed", params: { name: "char_petra", province: "prov_hameaux_est" } }, world)).not.toMatch(/prov_|char_/);
  });
});
