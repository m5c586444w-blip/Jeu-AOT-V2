import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ENVIRONMENT_IDS, LOT1_IDS, MaterialsFileSchema, StylesFileSchema, WallsFileSchema } from "../../../src/data/artSchemas";
import { DISTINCT_THRESHOLD, LOTS, PROFILES, deltaE76, facadeColor, hexLab, lotPairs, paletteDistance, profile, roofColor, totalVariation } from "../../../src/render/tactical3d/styles";

/**
 * Profils de style (R1b.1) : un par environnement de la partie B, validés, chacun avec son statut canon ; distance entre
 * profils au-dessus du seuil pour chaque paire d'un même lot (`docs/phases/R1b.md` § 4).
 * `R1B_LOG=1` écrit le tableau des distances dans `docs/reports/R1b-distances-profils.log`.
 */
const raw = (f: string): unknown => JSON.parse(readFileSync(`data/art/${f}`, "utf8"));

describe("profils de style en données (R1b.1)", () => {
  it("28 profils valides, un par environnement de la partie B (E01–E08, E10–E29), chacun avec canon C, A ou ?", () => {
    const parsed = StylesFileSchema.safeParse(raw("styles.json"));
    expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 5))).toBe(true);
    expect(PROFILES.map((p) => p.id).sort()).toEqual([...ENVIRONMENT_IDS]);
    for (const p of PROFILES) {
      expect(["C", "A", "?"]).toContain(p.canon);
      expect(["C", "A", "?"]).toContain(p.mur_visible.canon);
      expect(p.notes_canon.length).toBeGreaterThan(10);
      for (const v of p.variantes) expect(["C", "A", "?"]).toContain(v.canon);
    }
    expect([...LOTS[1]].sort()).toEqual([...LOT1_IDS].sort());
    expect(LOTS[2]).toHaveLength(19);
    // Les adaptations des abords de Shiganshina portent le tampon « Interprété » (partie B).
    expect(PROFILES.filter((p) => p.interprete).map((p) => p.id)).toEqual(["E26", "E27", "E28", "E29"]);
    expect(MaterialsFileSchema.safeParse(raw("materiaux.json")).success).toBe(true);
    expect(WallsFileSchema.safeParse(raw("murs.json")).success).toBe(true);
  });

  it("le schéma refuse un profil incohérent (parts ≠ 1, teinte invalide, mur visible sans distance, profil manquant)", () => {
    const base = raw("styles.json") as Record<string, unknown>[];
    const bad = (patch: (p: Record<string, unknown>) => void): boolean => {
      const copy = structuredClone(base);
      patch(copy[0] as Record<string, unknown>);
      return StylesFileSchema.safeParse(copy).success;
    };
    expect(bad(() => undefined)).toBe(true);
    expect(bad((p) => (p["toits"] = { tuiles_rouges: 0.5, ardoise: 0.2 }))).toBe(false);
    expect(bad((p) => ((p["palette"] as Record<string, string>)["toit"] = "rouge"))).toBe(false);
    expect(bad((p) => ((p["mur_visible"] as Record<string, unknown>)["distance_m"] = null))).toBe(false);
    expect(StylesFileSchema.safeParse(base.slice(1)).success).toBe(false);
    // Les murs : épaisseur et teinte sont des paramètres « ? », à valider par l'utilisateur.
    const walls = raw("murs.json") as Record<string, { canon: string; valeur: unknown }>;
    expect(walls["hauteur_m"]).toMatchObject({ valeur: 50, canon: "C" });
    expect(walls["epaisseur_m"]?.canon).toBe("?");
    expect(walls["teinte"]?.canon).toBe("?");
  });

  it("mesures de contrôle : ΔE, variation totale, palette (indépendante de l'ordre)", () => {
    expect(deltaE76(hexLab("#FFFFFF"), hexLab("#000000"))).toBeCloseTo(100, 0);
    expect(deltaE76(hexLab("#808080"), hexLab("#808080"))).toBe(0);
    expect(totalVariation({ a: 1 }, { b: 1 })).toBe(1);
    expect(totalVariation({ a: 0.5, b: 0.5 }, { a: 0.5, b: 0.5 })).toBe(0);
    const p = profile("E01").palette;
    const shuffled = { facade: p.sol, bois: p.toit, pierre: p.facade, toit: p.pierre, toit_2: p.bois, sol: p.toit_2 };
    expect(paletteDistance(p, shuffled)).toBeCloseTo(0, 9);
    // Rôles : la couverture la plus fréquente prend la teinte `toit`, la deuxième `toit_2`.
    expect(roofColor(profile("E01"), "tuiles_rouges")).toBe(profile("E01").palette.toit);
    expect(roofColor(profile("E06"), "ardoise")).toBe(profile("E06").palette.toit);
    expect(facadeColor(profile("E06"), "pierre_taillee")).toBe(profile("E06").palette.pierre);
  });

  it("distinction : chaque paire d'un même lot est au-dessus du seuil (norme des écarts normalisés ≥ 1)", () => {
    const lines: string[] = [];
    for (const lot of [1, 2] as const) {
      const pairs = lotPairs(lot);
      expect(pairs).toHaveLength((LOTS[lot].length * (LOTS[lot].length - 1)) / 2);
      lines.push(`Lot ${lot} : ${pairs.length} paires (de la plus proche à la plus lointaine)`, "paire | D | palette ΔE | toits | matériaux | densité");
      for (const { a, b, d } of pairs) {
        lines.push(`${a}–${b} | ${d.total.toFixed(2)} | ${d.palette.toFixed(1)} | ${d.toits.toFixed(2)} | ${d.materiaux.toFixed(2)} | ${d.densite.toFixed(2)}`);
        expect(d.total, `${a}–${b}`).toBeGreaterThanOrEqual(DISTINCT_THRESHOLD);
      }
      lines.push(`Minimum du lot ${lot} : ${(pairs[0]?.d.total ?? 0).toFixed(2)} (${pairs[0]?.a}–${pairs[0]?.b})`, "");
    }
    if (process.env["R1B_LOG"] === "1") writeFileSync("docs/reports/R1b-distances-profils.log", `${lines.join("\n")}\n`);
  });
});
