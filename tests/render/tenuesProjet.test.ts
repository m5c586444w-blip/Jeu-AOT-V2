import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TENUES, TENUE_IDS, choisirLod, emblemeDepuisExtras, fichierDecalque, fichierTenue, tenuePourInstitution, LOD_DISTANCE_M } from "../../src/render/tactical3d/tenuesProjet";

const manifest = JSON.parse(readFileSync("docs/art/assets/manifest.json", "utf8")) as { fichiers: { fichier: string; execution?: boolean }[] };
const servi = new Set(manifest.fichiers.filter((e) => e.execution).map((e) => e.fichier));

describe("tenues du projet (chargeur C10)", () => {
  it("sept tenues, identifiants uniques, fichiers LOD0/LOD1 et décalques présents et servis (execution)", () => {
    expect(TENUE_IDS.length).toBe(7);
    expect(new Set(TENUE_IDS).size).toBe(7);
    for (const t of TENUES) {
      for (const lod of [0, 1] as const) {
        const f = `projet/${fichierTenue(t.id, lod)}`;
        expect(existsSync(`docs/art/assets/${f}`), f).toBe(true);
        expect(servi.has(f), f).toBe(true);
      }
      const d = `projet/${fichierDecalque(t.emblem)}`;
      expect(existsSync(`docs/art/assets/${d}`), d).toBe(true);
      expect(servi.has(d), d).toBe(true);
    }
  });

  it("les assets de tenue servis sont exactement ceux du chargeur (pas de LOD2 ni d'accessoire servi par erreur)", () => {
    const attendus = new Set(TENUES.flatMap((t) => [`projet/${fichierTenue(t.id, 0)}`, `projet/${fichierTenue(t.id, 1)}`, `projet/${fichierDecalque(t.emblem)}`]));
    const projet = [...servi].filter((f) => f.startsWith("projet/"));
    for (const f of projet) expect(attendus.has(f), f).toBe(true);
  });

  it("institution -> tenue, avec variantes", () => {
    expect(tenuePourInstitution("org_survey_corps")).toBe("bataillon_exploration");
    expect(tenuePourInstitution("org_garrison")).toBe("garnison");
    expect(tenuePourInstitution("org_military_police")).toBe("police_militaire");
    expect(tenuePourInstitution("org_military_police", "anti_personnel")).toBe("police_interieure");
    expect(tenuePourInstitution("fac_marley")).toBe("marley_soldat");
    expect(tenuePourInstitution("fac_marley", "officier")).toBe("marley_officier");
    expect(tenuePourInstitution("org_training_corps", "officier")).toBe("corps_entrainement");
    expect(tenuePourInstitution("org_culte")).toBeNull();
  });

  it("noms de fichier", () => {
    expect(fichierTenue("garnison", 1)).toBe("tenue_garnison_lod1.glb");
    expect(fichierDecalque("emb_fac_marley")).toBe("decalque_emb_fac_marley.glb");
  });

  it("LOD selon la distance, avec hystérésis", () => {
    expect(choisirLod(3)).toBe(0);
    expect(choisirLod(LOD_DISTANCE_M + 1)).toBe(1);
    expect(choisirLod(LOD_DISTANCE_M + 1, 0)).toBe(0); // reste en 0 dans la marge de 10 %
    expect(choisirLod(LOD_DISTANCE_M * 1.2, 0)).toBe(1);
    expect(choisirLod(LOD_DISTANCE_M - 1, 1)).toBe(1); // reste en 1 dans la marge
    expect(choisirLod(LOD_DISTANCE_M * 0.8, 1)).toBe(0);
  });

  it("lecture des extras d'emblème (valides, absents, mal formés)", () => {
    const ok = emblemeDepuisExtras({ emblem_id: "emb_x", emblem_os: "spine_02", emblem_pos: [0.075, 1.21, 0.1], emblem_largeur_m: 0.09, emblem_rot_y_deg: 180 });
    expect(ok).toEqual({ id: "emb_x", os: "spine_02", pos: [0.075, 1.21, 0.1], largeur: 0.09, rotYDeg: 180 });
    expect(emblemeDepuisExtras({})).toBeNull();
    expect(emblemeDepuisExtras({ emblem_id: "e", emblem_os: "o", emblem_pos: [1, 2], emblem_largeur_m: 0.1 })).toBeNull();
  });
});
