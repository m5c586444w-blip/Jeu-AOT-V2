import { describe, expect, it } from "vitest";
import { stressCharacter } from "../../src/sim/politics/characters";
import { applyCommand } from "../../src/sim/core/commands";
import { createInitialState } from "../../src/sim/core/state";
import { pol, run, start, strat, world850, world850NoEvents } from "./politics-helpers";

describe("mort d'un personnage (AC2-07, F-CHR-04)", () => {
  it("Erwin : dossier, deuil des proches, deuil politique, organisation, poste vacant, divergence", () => {
    const s0 = start();
    const s = run(s0, { type: "CharacterDies", character: "char_erwin_smith", cause: "combat", circumstances: "death.circumstances.test" });
    const p = pol(s);
    const erwin = p.characters["char_erwin_smith"];
    expect(erwin?.alive).toBe(false);
    const record = erwin?.death;
    expect(record?.cause).toBe("combat");
    expect(record?.consequences.map((c) => c.key)).toEqual(expect.arrayContaining(["death.csq_grief", "death.csq_legitimacy", "death.csq_org", "death.csq_vacancy", "death.csq_divergence_event"]));
    expect(p.characters["char_levi_ackerman"]?.stress).toBeGreaterThan(pol(s0).characters["char_levi_ackerman"]?.stress ?? 0);
    expect(p.mourning.some((m) => m.target === "legitimacy")).toBe(true);
    expect(p.mourning.some((m) => m.target === "org_loyalty:org_survey_corps")).toBe(true);
    expect(p.orgs["org_survey_corps"]?.leader).toBeNull();
    const nom = p.nominations.find((n) => n.post.id === "org_survey_corps");
    expect(nom?.candidates).toHaveLength(3);
    expect(strat(s).log.some((l) => l.key === "alert.divergence_death")).toBe(true);
    expect(() => run(s, { type: "CharacterDies", character: "char_erwin_smith", cause: "combat" })).toThrow(/déjà mort/);
    // La loyauté du Corps baisse dans les mois qui suivent (deuil du chef).
    const later = run(s, { type: "AdvanceDays", n: 60 });
    const control = run(s0, { type: "AdvanceDays", n: 60 });
    expect(pol(later).orgs["org_survey_corps"]?.loyalty).toBeLessThan(pol(control).orgs["org_survey_corps"]?.loyalty ?? 0);
    expect(pol(later).legitimacy).toBeLessThan(pol(control).legitimacy);
  });
  it("nomination : le candidat prend le poste, les autres gardent une rancœur (F-POL-04)", () => {
    const s = run(start(), { type: "CharacterDies", character: "char_dot_pixis", cause: "maladie" });
    const nom = pol(s).nominations.find((n) => n.post.kind === "role" && n.post.id === "role_stratege");
    if (!nom) throw new Error("pas de nomination");
    const [chosen, ...others] = nom.candidates;
    if (!chosen) throw new Error();
    const after = run(s, { type: "Nominate", nomination: nom.id, candidate: chosen });
    expect(pol(after).roles["role_stratege"]).toBe(chosen);
    for (const o of others) expect(pol(after).characters[o]?.loyalty).toBeLessThan(pol(s).characters[o]?.loyalty ?? 0);
  });
});

describe("stress et traumatisme (AC2-09, F-CHR-02)", () => {
  it("seuils : épuisement, blessure psychique, puis démission du titulaire", () => {
    let s = start();
    const p = structuredClone(pol(s));
    stressCharacter(world850, p, "char_elise_brandt", 70);
    s = { ...s, politics: p };
    s = run(s, { type: "AdvanceDays", n: 1 });
    expect(pol(s).characters["char_elise_brandt"]?.acquired).toContain("trait_epuise");
    const p2 = structuredClone(pol(s));
    stressCharacter(world850, p2, "char_elise_brandt", 40);
    s = run({ ...s, politics: p2 }, { type: "AdvanceDays", n: 1 });
    expect(pol(s).characters["char_elise_brandt"]?.acquired).toContain("trait_blessure_psychique");
    expect(pol(s).roles["role_intendant"]).toBeNull();
    expect(strat(s).log.some((l) => l.key === "alert.resigned")).toBe(true);
  });
});

describe("fenêtres de présence (AC2-02, F-LOR-09)", () => {
  it("un personnage vivant après sa sortie canon déclenche un seul avertissement", () => {
    // Sans chronologie : Erwin n'est pas tué par E42 (P5) et survit à sa sortie canon.
    const s = applyCommand(createInitialState(42, world850NoEvents), { type: "AdvanceDays", n: 400 }, undefined, world850NoEvents);
    const alerts = strat(s).log.filter((l) => l.key === "alert.divergence_alive" && l.params["name"] === "Erwin Smith");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.date.year).toBe(851);
  });
  it("en Canon fidèle (P5), Erwin meurt à E42 : aucun avertissement de divergence", () => {
    const s = run(start(), { type: "AdvanceDays", n: 400 });
    expect(strat(s).log.some((l) => l.key === "alert.divergence_alive" && l.params["name"] === "Erwin Smith")).toBe(false);
    expect(pol(s).characters["char_erwin_smith"]?.alive).toBe(false);
  });
});
