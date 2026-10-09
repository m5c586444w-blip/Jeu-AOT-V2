import { describe, expect, it } from "vitest";
import { createBattle } from "../../../src/sim/tactical/battle";
import { companySetup } from "../../../src/sim/tactical/setup";
import { anchorAt, buildBattleWorld, instanceFootprint, objectBox, partsNamed } from "../../../src/render/tactical3d/battle/world";
import { LOD, cannonGeometry, markerGeometry, tierOf, troopGeometry } from "../../../src/render/tactical3d/battle/units";
import { w854 } from "../../sim/legacy-cases";

/**
 * Vue 3D de la bataille (R2.4, CR2-06) : le décor est DÉRIVÉ de la carte de la simulation.
 * - chaque structure (bâtiment, rocher, arbre, arbre géant, mur) a la même emprise au sol (± 0,1 m) ;
 * - chaque ancrage de la simulation est un crochet visible, à sa position ;
 * - niveaux de détail : figure complète près de la caméra, foule au-delà, repère au loin.
 */
const MAPS = ["tmap_ville", "tmap_foret", "tmap_plaine", "tmap_mur"] as const;
const TOL = 0.1;

const battleOn = (map: string) =>
  createBattle(w854, companySetup(w854, { map, seed: 11, soldiers: 40, allied: [{ kind: "fusilier", count: 30 }], enemy: [{ kind: "fusilier", count: 60 }] }));

describe("décor 3D dérivé de la carte de la simulation", () => {
  for (const id of MAPS) {
    it(`${id} : emprises au sol identiques (± ${TOL} m) et ancrages visibles`, () => {
      const b = battleOn(id);
      const m = b.map;
      const w = buildBattleWorld(m, 11);
      type Inst = Parameters<typeof instanceFootprint>[0];
      const byName = (n: string): Inst => partsNamed(w, n)[0] as Inst;
      // Une emprise rendue par structure de la simulation.
      expect(w.footprints.length).toBe(m.structures.length);
      const counters: Record<string, number> = {};
      const walls = partsNamed(w, "mur");
      for (const s of m.structures) {
        const f = w.footprints.find((x) => x.id === s.id);
        expect(f, `structure ${s.id}`).toBeDefined();
        const k = s.kind === "arbre_geant" ? "arbre" : s.kind;
        const i = counters[k] ?? 0;
        counters[k] = i + 1;
        if (s.kind === "batiment" || s.kind === "rocher") {
          const mesh = byName(s.kind === "batiment" ? "batiments" : "rochers");
          const r = instanceFootprint(mesh, i);
          expect(Math.abs(r.x0 - s.x)).toBeLessThanOrEqual(TOL);
          expect(Math.abs(r.x1 - (s.x + s.w))).toBeLessThanOrEqual(TOL);
          expect(Math.abs(r.y0 - s.y)).toBeLessThanOrEqual(TOL);
          expect(Math.abs(r.y1 - (s.y + s.d))).toBeLessThanOrEqual(TOL);
        } else if (s.kind === "mur") {
          const wall = walls[i];
          expect(wall, `mur ${s.id}`).toBeDefined();
          const bb = objectBox(wall as NonNullable<typeof wall>);
          expect(Math.abs(bb.x0 - s.x)).toBeLessThanOrEqual(TOL);
          expect(Math.abs(bb.x1 - (s.x + s.w))).toBeLessThanOrEqual(TOL);
          expect(Math.abs(bb.y0 - s.y)).toBeLessThanOrEqual(TOL);
          expect(Math.abs(bb.y1 - (s.y + s.d))).toBeLessThanOrEqual(TOL);
          expect(Math.abs(bb.h - s.h)).toBeLessThanOrEqual(TOL);
        }
      }
      // Arbres : fût du rayon de la simulation (ordre : arbres puis arbres géants).
      const trees = [...m.structures.filter((s) => s.kind === "arbre"), ...m.structures.filter((s) => s.kind === "arbre_geant")];
      if (trees.length > 0) {
        const trunk = byName("futs");
        expect(trunk.count).toBe(trees.length);
        trees.forEach((s, i) => {
          const r = instanceFootprint(trunk, i);
          expect(Math.abs((r.x0 + r.x1) / 2 - s.x)).toBeLessThanOrEqual(TOL);
          expect(Math.abs((r.y0 + r.y1) / 2 - s.y)).toBeLessThanOrEqual(TOL);
          expect(Math.abs((r.x1 - r.x0) / 2 - s.r)).toBeLessThanOrEqual(TOL);
        });
      }
      // Ancrages : une instance par ancrage, à sa position (x → X, hauteur → Y, y → Z).
      expect(w.anchors.count).toBe(m.anchors.length);
      expect(m.anchors.length).toBeGreaterThan(0);
      for (const a of m.anchors) {
        const p = anchorAt(w, a.id);
        expect(Math.hypot(p.x - a.x, p.y - a.y, p.z - a.z)).toBeLessThan(0.01);
      }
      w.dispose();
    });
  }
});

describe("unités : géométries et niveaux de détail", () => {
  it("fantassin à taille d'homme (1,7–1,95 m) ; repère et canon non vides", () => {
    const g = troopGeometry();
    g.computeBoundingBox();
    const h = (g.boundingBox?.max.y ?? 0) - (g.boundingBox?.min.y ?? 0);
    expect(h).toBeGreaterThan(1.7);
    expect(h).toBeLessThan(1.95);
    expect(markerGeometry().getAttribute("position").count).toBeGreaterThan(0);
    expect(cannonGeometry().getAttribute("position").count).toBeGreaterThan(0);
  });

  it("figure complète près de la caméra, foule au-delà, repère au loin ; seuils croissants avec la qualité", () => {
    for (const q of ["bas", "moyen", "haut"] as const) {
      const d = LOD[q];
      expect(tierOf(d.detailM - 1, q)).toBe("detail");
      expect(tierOf(d.detailM + 1, q)).toBe("foule");
      expect(tierOf(d.markerM - 1, q)).toBe("foule");
      expect(tierOf(d.markerM + 1, q)).toBe("repere");
    }
    expect(LOD.bas.detailMax).toBeLessThan(LOD.moyen.detailMax);
    expect(LOD.moyen.detailMax).toBeLessThan(LOD.haut.detailMax);
    expect(LOD.bas.markerM).toBeLessThan(LOD.haut.markerM);
  });
});
