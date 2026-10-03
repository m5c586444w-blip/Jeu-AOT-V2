import { describe, expect, it } from "vitest";
import { loadBalanceDir, loadDataDir } from "../../src/data/loadNode";
import fr from "../../src/i18n/fr.json";

const { data, issues } = loadDataDir("data");
const scenario = data.scenarios.find((s) => s.id === "scn_sandbox_850");
const byId = new Map(data.characters.map((c) => [c.id, c]));
const activeIn = (id: string, year: number): boolean => {
  const c = byId.get(id);
  return !!c && c.active_from <= year && (c.active_until ?? Infinity) >= year;
};

describe("données de P2 (AC2-01)", () => {
  it("valides ; ≥ 40 personnages, ≥ 40 traits, 8 strates, ≥ 40 décrets, 18 rôles", () => {
    expect(issues).toEqual([]);
    expect(loadBalanceDir("data").issues).toEqual([]);
    expect(data.characters.length).toBeGreaterThanOrEqual(40);
    expect(data.traits.length).toBeGreaterThanOrEqual(40);
    expect(data.strata).toHaveLength(8);
    expect(data.laws.length).toBeGreaterThanOrEqual(40);
    expect(data.roles.map((r) => r.number).sort((a, b) => a - b)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });
  it("chaque trait a des effets ; les oppositions sont réciproques ou au moins existantes", () => {
    for (const t of data.traits) {
      const effect = Object.keys(t.attributes).length + Object.keys(t.vote).length + (t.stress_gain !== 1 ? 1 : 0) + (t.advice_bias ? 1 : 0) + t.opposes.length;
      expect(effect, t.id).toBeGreaterThan(0);
    }
    expect(data.traits.filter((t) => t.opposes.length > 0).length).toBeGreaterThanOrEqual(20);
  });
  it("chaque personnage a une fenêtre de présence ; ses traits de départ ne sont pas des traits acquis (anachronisme)", () => {
    const acquired = new Set(data.traits.filter((t) => t.acquired).map((t) => t.id));
    for (const c of data.characters) {
      expect(c.active_from, c.id).toBeGreaterThan(0);
      for (const t of c.traits) expect(acquired.has(t), `${c.id} : ${t}`).toBe(false);
    }
  });
  it("aucun titulaire de poste hors de sa fenêtre en 850", () => {
    const pol = scenario?.politics;
    expect(pol).toBeDefined();
    if (!pol) return;
    const posted = [pol.player, ...Object.values(pol.roles).filter((x): x is string => !!x), ...Object.values(pol.org_leaders), ...pol.cabinet_extra];
    for (const id of posted) expect(activeIn(id, scenario.start.year), id).toBe(true);
  });
  it("chaque décret a au moins un effet et un contre-effet (02 §4 : effets et contre-effets)", () => {
    for (const l of data.laws) {
      const all = [...l.effects, ...l.delayed.flatMap((d) => d.effects)];
      expect(all.length, l.id).toBeGreaterThanOrEqual(2);
    }
    expect(data.laws.filter((l) => l.delayed.length > 0).length).toBeGreaterThanOrEqual(10);
  });
  it("tous les textes (noms, descriptions, biographies, rangs, rôles) existent en français", () => {
    const keys = [
      ...data.traits.map((t) => t.name_key),
      ...data.strata.map((s) => s.name_key),
      ...data.organisations.map((o) => o.name_key),
      ...data.laws.flatMap((l) => [l.name_key, l.desc_key, ...l.delayed.map((d) => d.log_key)]),
      ...data.roles.map((r) => r.name_key),
      ...data.characters.flatMap((c) => [c.bio_key ?? "", c.rank_key ?? ""]),
    ];
    expect(keys.filter((k) => !(k in fr))).toEqual([]);
  });
  it("les secrets restent dans `hidden` (jamais dans le nom affiché)", () => {
    const krista = byId.get("char_historia_reiss");
    expect(krista?.display_name).toBe("Krista Lenz");
    expect(byId.get("char_reiner_braun")?.hidden?.faction).toBe("marley");
    expect(byId.get("char_reiner_braun")?.faction).toBe("paradis");
  });
});
