import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import fr from "../../src/i18n/fr.json";
import { checkCreationEntry, EmblemsFileSchema } from "../../src/data/emblemSchemas";
import { emblemColorSvg, emblemLineSvg } from "../../src/data/emblemSvg";
import { emblem, emblemDef } from "../../src/ui/icons";

const raw: unknown = JSON.parse(readFileSync("data/emblems/emblems.json", "utf8"));
const file = EmblemsFileSchema.parse(raw);
const listing = readFileSync("docs/lore/creations.md", "utf8");
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : f.endsWith(".json") && !d.includes("emblems") ? [join(d, f)] : []));
/** Organisations connues du jeu : tout identifiant `org_*` cité par les données (hors emblèmes). */
const orgIds = new Set(walk("data").flatMap((f) => readFileSync(f, "utf8").match(/org_[a-z_]+/g) ?? []));

describe("emblèmes (C2)", () => {
  it("le fichier est valide, identifiants uniques, toutes les quatre nations et la Police militaire (licorne) présentes", () => {
    const ids = file.emblems.map((e) => e.subject.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const want of ["fac_paradis", "fac_marley", "fac_hizuru", "fac_allies", "org_military_police"]) expect(ids).toContain(want);
  });

  it("chaque organisation citée existe, chaque nom est traduit", () => {
    for (const e of file.emblems) {
      if (e.subject.kind === "organisation") expect(orgIds.has(e.subject.id), e.subject.id).toBe(true);
      expect((fr as Record<string, string>)[e.name_key], e.name_key).toBeTruthy();
    }
  });

  it("tout emblème est une création déclarée : A, raison, inscrite dans creations.md ; jamais présentée comme canon", () => {
    for (const e of file.emblems) expect(checkCreationEntry(e, listing), e.id).toEqual([]);
    const mp = file.emblems.find((e) => e.subject.id === "org_military_police");
    expect(mp?.fact?.canon).toBe("C");
    expect(mp?.canon).toBe("A");
  });

  it("la règle de création rejette canon C, raison vide, entrée non listée ; ignore une entrée sans creation", () => {
    expect(checkCreationEntry({ id: "x", canon: "C", creation: true, creation_reason: "r" }, "| x | y |").length).toBe(1);
    expect(checkCreationEntry({ id: "x", canon: "A", creation: true, creation_reason: " " }, "| x | y |")).toContain("creation_reason manquant");
    expect(checkCreationEntry({ id: "x", canon: "A", creation: true, creation_reason: "raison" }, "autre")).toContain("absente de docs/lore/creations.md");
    expect(checkCreationEntry({ id: "x", canon: "C" }, "")).toEqual([]);
    // L'identifiant doit être la première colonne d'une ligne du tableau, pas une simple sous-chaîne.
    expect(checkCreationEntry({ id: "emb_a", canon: "A", creation: true, creation_reason: "raison" }, "| emb_a_longue | x |")).toContain("absente de docs/lore/creations.md");
    expect(checkCreationEntry({ id: "emb_a", canon: "A", creation: true, creation_reason: "raison" }, "| emb_a | x |")).toEqual([]);
  });

  it("le schéma rejette un tracé hors charset et un doublon", () => {
    const bad = structuredClone(raw) as { emblems: { charges: { d: string }[] }[] };
    const first = bad.emblems[0]?.charges[0];
    if (!first) throw new Error("emblème absent");
    first.d = "M0 0 <script>";
    expect(EmblemsFileSchema.safeParse(bad).success).toBe(false);
    const dup = structuredClone(raw) as { emblems: unknown[] };
    dup.emblems.push(dup.emblems[0]);
    expect(EmblemsFileSchema.safeParse(dup).success).toBe(false);
  });

  it("rendu déterministe depuis la même définition : trait (interface) et couleurs (texture), et l'interface lit les données", () => {
    for (const e of file.emblems) {
      expect(emblemLineSvg(e)).toBe(emblemLineSvg(e));
      const c = emblemColorSvg(e);
      expect(c).toContain(e.colors.field);
      expect(c).toContain(e.charges[0]?.d ?? "?");
      expect(c).not.toMatch(/<script|onload|href=/);
    }
    const def = emblemDef("fac_marley");
    expect(def).toBeDefined();
    if (!def) throw new Error("définition absente");
    expect(emblem("fac_marley")).toBe(emblemLineSvg(def));
    expect(emblem("fac_inconnue")).toBe("");
    expect(emblem("org_military_police")).toContain('data-canon="A"');
  });

  it("les charges tracées en coordonnées absolues tiennent dans la boîte du champ (cadre 48 × 48, rien ne dépasse l'écu)", () => {
    const boite = { rond: [1, 1, 47, 47], ecu: [6, 3, 42, 47], losange: [2, 1, 46, 47] } as const;
    for (const e of file.emblems) {
      const [x0, y0, x1, y1] = boite[e.field];
      for (const c of e.charges) {
        if (/[a-df-z]/.test(c.d.replace(/[ZzMm]/g, ""))) continue; // tracés relatifs : non vérifiés ici
        if (/[hHvV]/.test(c.d)) continue;
        const n = (c.d.match(/-?\d+\.?\d*/g) ?? []).map(Number);
        for (let i = 0; i + 1 < n.length; i += 2) {
          expect(n[i], `${e.id} x`).toBeGreaterThanOrEqual(x0);
          expect(n[i], `${e.id} x`).toBeLessThanOrEqual(x1);
          expect(n[i + 1], `${e.id} y`).toBeGreaterThanOrEqual(y0);
          expect(n[i + 1], `${e.id} y`).toBeLessThanOrEqual(y1);
        }
      }
    }
  });
});
