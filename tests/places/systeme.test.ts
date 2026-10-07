import { describe, expect, it } from "vitest";
import { PlaceSchema } from "../../src/data/placeSchema";
import { convexOverlap, rectPoly, polylineDist, area } from "../../src/render/tactical3d/places/geom";
import { batchesHash, placeBatches } from "../../src/render/tactical3d/places/instances";
import { layoutPlace, placeMetrics } from "../../src/render/tactical3d/places/layout";
import { gateElevationSvg, placePlanSvg, wallSectionSvg } from "../../src/render/tactical3d/places/svg";
import { wallFrameAt, wallSection } from "../../src/render/tactical3d/places/walls";
import { crossCheck, readWalls } from "../../src/tools/places/check";
import { testPlace } from "./fixture";

/**
 * Système de lieux (R1e.1) : schéma, murailles (`_murs.json`), mise en place déterministe des maisons et des arbres, mesures,
 * plans SVG, empreinte de rendu. Lieu d'essai : `fixture.ts`.
 */
const { walls, errors } = readWalls();

describe("R1e.1 — murailles (_murs.json)", () => {
  it("valide, hauteur 50 m [C], autres valeurs [?] ou [A] avec plage", () => {
    expect(errors).toEqual([]);
    expect(walls).not.toBeNull();
    for (const r of Object.values(walls?.anneaux ?? {})) {
      expect(r.hauteur_m).toMatchObject({ valeur: 50, canon: "C" });
      for (const k of ["epaisseur_base_m", "epaisseur_sommet_m", "chemin_de_ronde_m", "parapet_hauteur_m", "rayon_km"] as const) {
        expect(r[k].canon).toBe("?");
        expect(r[k].plage).toBeDefined();
      }
    }
  });
  it("coupe : faces à fruit, sommet = épaisseur du sommet, parapet sur le bord extérieur", () => {
    const s = wallSection(walls?.anneaux.maria as never);
    expect(s.H).toBe(50);
    expect(s.extFoot - s.intFoot).toBeCloseTo(walls?.anneaux.maria.epaisseur_base_m.valeur as number, 6);
    expect(s.extTop - s.intTop).toBeCloseTo(walls?.anneaux.maria.epaisseur_sommet_m.valeur as number, 6);
    expect(s.fruitExt).toBeGreaterThan(s.fruitInt);
    expect(s.extAt(50)).toBeCloseTo(s.extTop, 6);
  });
});

describe("R1e.1 — schéma et mise en place (lieu d'essai)", () => {
  const p = testPlace();
  it("le lieu d'essai passe le schéma et les renvois internes", () => {
    const r = PlaceSchema.safeParse(p);
    expect(r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")} : ${i.message}`)).toEqual([]);
    expect(crossCheck(p, new Set())).toEqual([]);
  });
  it("le schéma refuse une densité hors de sa classe et une valeur [?] sans plage", () => {
    expect(PlaceSchema.safeParse({ ...p, densite: { classe: "faubourg", valeur: 200, canon: "A" } }).success).toBe(false);
    expect(PlaceSchema.safeParse({ ...p, population: { province: null, part: 1, canon: "A", valeur: 10 } }).success).toBe(false);
  });
  const L = layoutPlace(p);
  it("maisons : aucune ne recouvre une autre du même îlot, aucune n'empiète sur une rue", () => {
    expect(L.houses.length).toBeGreaterThan(150);
    for (const b of L.blocks) {
      const polys = b.houses.map((h) => rectPoly([h.x, h.y], [Math.cos(h.a), Math.sin(h.a)], h.w / 2, h.d / 2));
      for (let i = 0; i < polys.length; i++) for (let j = i + 1; j < polys.length; j++) expect(convexOverlap(polys[i] as never, polys[j] as never, 0.05)).toBe(false);
    }
    for (const h of L.houses) for (const r of p.rues) expect(polylineDist([h.x, h.y], r.trace)).toBeGreaterThan(r.largeur_m / 2);
  });
  it("gabarits suivis sans tirage : étages, toits et teintes pris dans les suites de l'auteur, variés", () => {
    const g = p.gabarits["serre"];
    const serre = L.houses.filter((h) => h.id.startsWith("b1") || h.id.startsWith("b3"));
    expect(serre.every((h) => g?.etages.includes(h.floors) && g.teintes.includes(h.tint))).toBe(true);
    expect(new Set(serre.map((h) => h.tint)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(serre.map((h) => h.roof)).size).toBeGreaterThanOrEqual(3);
    // Les largeurs de façade varient (pas d'îlots de maisons identiques).
    expect(new Set(L.houses.map((h) => Math.round(h.w))).size).toBeGreaterThanOrEqual(5);
  });
  it("arbres : cours, alignements, parc, isolé ; aucun dans une maison", () => {
    const src = new Set(L.trees.map((t) => t.src));
    for (const s of ["cour", "jardin", "rue", "parc", "isole"]) expect(src.has(s as never)).toBe(true);
    for (const t of L.trees)
      for (const h of L.houses) {
        const u: [number, number] = [Math.cos(h.a), Math.sin(h.a)];
        const r = [t.x - h.x, t.y - h.y];
        const [rx, ry] = r as [number, number];
        const inside = Math.abs(rx * u[0] + ry * u[1]) < h.w / 2 - 0.2 && Math.abs(u[0] * ry - u[1] * rx) < h.d / 2 - 0.2;
        expect(inside).toBe(false);
      }
  });
  it("mesures : surface bâtie = îlots + rues (définition R1e §2), arbres par hectare", () => {
    const m = placeMetrics(L, { principal: 2000 });
    const z = m.zones[0];
    expect(z?.cible_ha).toBeCloseTo(10, 6);
    const ilots = p.ilots.reduce((s, b) => s + area(b.polygone), 0) / 10000;
    expect(z?.ilots_ha).toBeCloseTo(ilots, 6);
    expect(z?.batie_ha).toBeGreaterThan(ilots);
    expect(m.parcs[0]?.par_ha).toBeGreaterThanOrEqual(20);
  });
  it("états : la ruine touche la moitié sud (tirage fixe par maison), pas le nord", () => {
    const after = layoutPlace(p, "apres");
    const south = after.houses.filter((h) => h.y > 0);
    const ruined = south.filter((h) => h.ruin > 0).length / south.length;
    expect(ruined).toBeGreaterThan(0.35);
    expect(ruined).toBeLessThan(0.65);
    expect(after.houses.filter((h) => h.y < 0 && h.ruin > 0)).toEqual([]);
  });
});

describe("R1e.1 — plans SVG et empreinte de rendu", () => {
  const p = testPlace();
  const L = layoutPlace(p);
  it("plan coté : rues nommées, rayon du mur, porte cotée, cartouche", () => {
    const svg = placePlanSvg(p, L, walls as never, placeMetrics(L, { principal: 2000 }));
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("Rue 3 [A]");
    expect(svg).toContain("R = 230 m [A]");
    expect(svg).toContain("Porte sud [A]");
    expect(svg).toContain("12 m [A]");
    expect(svg).toContain("plan d'auteur");
  });
  it("coupe : hauteur 50 m [C], épaisseurs lues de _murs.json avec leur statut", () => {
    const svg = wallSectionSvg(walls?.anneaux.maria as never, "Mur Maria");
    expect(svg).toContain("50 m [C]");
    expect(svg).toContain(`base ${walls?.anneaux.maria.epaisseur_base_m.valeur} m [?]`);
    expect(svg).toContain(`sommet ${walls?.anneaux.maria.epaisseur_sommet_m.valeur} m [?]`);
    expect(svg).toContain("chemin de ronde");
  });
  it("élévation de porte : passage et mur cotés", () => {
    const svg = gateElevationSvg(p.portes[0] as never, walls?.anneaux.maria as never, "exterieure");
    expect(svg).toContain("passage 12 m [A]");
    expect(svg).toContain("mur 50 m [C]");
  });
  it("empreinte de rendu : même plan → même empreinte ; un gabarit changé la change", () => {
    const h1 = batchesHash(placeBatches(layoutPlace(p)));
    const h2 = batchesHash(placeBatches(layoutPlace(testPlace())));
    expect(h1).toBe(h2);
    const q = testPlace();
    (q.gabarits["serre"] as { teintes: string[] }).teintes[0] = "#a0a0a0";
    expect(batchesHash(placeBatches(layoutPlace(q)))).not.toBe(h1);
  });
  it("repère du mur : la porte sud est au sud, normale vers l'extérieur", () => {
    const t = p.enceinte?.traces[0] as never;
    const f = wallFrameAt(t, p.portes[0]?.s_m as number);
    expect(f.p[1]).toBeCloseTo(230, 6);
    expect(f.out[1]).toBeCloseTo(1, 6);
  });
});
