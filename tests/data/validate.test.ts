import { describe, expect, it } from "vitest";
import { loadDataDir } from "../../src/data/loadNode";
import { formatIssue, validateCollectionFile, emptyData } from "../../src/data/validate";

describe("validation des données (AC-12)", () => {
  it("les données invalides échouent avec chemin de fichier et chemin JSON", () => {
    const { issues } = loadDataDir("tests/fixtures/data_invalid");
    const lines = issues.map(formatIssue);
    expect(lines.some((l) => /^tests\/fixtures\/data_invalid\/techs\/broken\.json : \$\[1\]\.min_year — /.test(l))).toBe(true);
    expect(lines.some((l) => /^tests\/fixtures\/data_invalid\/provinces\/broken\.json : \$\[0\]\.canon — /.test(l))).toBe(true);
  });
  it("des données valides passent", () => {
    const data = emptyData();
    const issues = validateCollectionFile("techs", "x.json", [{ id: "tech_a", tree: "odm", cost: null, min_year: 845, canon: "A" }], data);
    expect(issues).toEqual([]);
    expect(data.techs[0]?.prereqs).toEqual([]);
  });
  it("identifiant dupliqué et racine non tableau", () => {
    const data = emptyData();
    const entry = { id: "tech_a", tree: "odm", cost: null, min_year: 845, canon: "A" };
    expect(validateCollectionFile("techs", "x.json", [entry, entry], data).map(formatIssue)).toEqual([
      "x.json : $[1].id — identifiant « tech_a » déjà défini dans x.json",
    ]);
    expect(validateCollectionFile("techs", "y.json", {}, emptyData())[0]?.jsonPath).toBe("$");
  });
  it("champ inconnu refusé (faute de frappe)", () => {
    const issues = validateCollectionFile("techs", "z.json", [{ id: "tech_a", tree: "odm", cost: null, min_year: 845, canon: "A", unlock_evnt: "evt_x" }], emptyData());
    expect(issues).toHaveLength(1);
  });
});
