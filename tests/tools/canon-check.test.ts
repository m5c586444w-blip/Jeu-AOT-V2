import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { checkCanon } from "../../src/data/canonRules";
import { loadDataDir } from "../../src/data/loadNode";
import { loadRawDir } from "../../src/data/loadRaw";

// AC-13 : test d'intégrité de la chaîne d'outils (fichier 14 §3.2) — on lance le vrai CLI.
function runCli(dir: string): { code: number | null; out: string } {
  const r = spawnSync(process.execPath, ["--import", "tsx", "src/tools/canon-check.ts", dir], { encoding: "utf8" });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

const BAD: [string, string][] = [
  ["r1_thunder_spear_no_unlock", "R1"],
  ["r2_thunder_spear_too_early", "R2"],
  ["r3_character_window_inverted", "R3"],
  ["r4_event_cycle", "R4"],
  ["r5_unit_at_destroyed_place", "R5"],
  ["r6_missing_canon_tag", "R6"],
];

describe("canon:check (AC-13)", () => {
  it("good → code 0, et valide aussi pour data:validate", () => {
    const r = runCli("tests/fixtures/good");
    expect(r.code, r.out).toBe(0);
    expect(loadDataDir("tests/fixtures/good").issues).toEqual([]);
  });

  it.each(BAD)("bad/%s → code 1 avec la règle %s (et seulement elle)", (dir, rule) => {
    const r = runCli(`tests/fixtures/bad/${dir}`);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(new RegExp(`^${rule} tests/fixtures/bad/${dir}/\\S+ \\S+ : `, "m"));
    const rules = checkCanon(loadRawDir(`tests/fixtures/bad/${dir}`).raw).map((v) => v.rule);
    expect(new Set(rules)).toEqual(new Set([rule]));
  });

  it("dossier /data → code 0", () => {
    const r = runCli("data");
    expect(r.code, r.out).toBe(0);
  });
});

describe("règles : cas limites", () => {
  const ev = (id: string, year: number, after: string | null) => ({ file: "f", id, v: { id, year_min: year, window: { after }, canon: "C" } });
  it("R4 : prédécesseur inconnu et année antérieure", () => {
    const v = checkCanon({ provinces: [], characters: [], techs: [], placements: [], events: [ev("evt_a", 851, null), ev("evt_b", 850, "evt_a"), ev("evt_c", 850, "evt_x")] });
    expect(v.map((x) => x.message)).toEqual([
      "année 850 antérieure à celle de son prédécesseur evt_a (851)",
      "prédécesseur inconnu : evt_x",
    ]);
  });
  it("R2 : unlock_event multiple → la plus ancienne année compte", () => {
    const tech = { file: "f", id: "tech_serum", v: { id: "tech_serum", min_year: 850, canon: "C", unlock_event: ["evt_a", "evt_b"] } };
    expect(checkCanon({ provinces: [], characters: [], placements: [], techs: [tech], events: [ev("evt_a", 850, null), ev("evt_b", 851, null)] })).toEqual([]);
  });
  it("R5 : l'année de destruction elle-même reste autorisée", () => {
    const prov = { file: "f", id: "prov_u", v: { id: "prov_u", destroyed_year: 850, canon: "C" } };
    const pl = { file: "f", id: "unit_x", v: { id: "unit_x", location: "prov_u", year: 850, canon: "A" } };
    expect(checkCanon({ provinces: [prov], characters: [], techs: [], events: [], placements: [pl] })).toEqual([]);
  });
});
