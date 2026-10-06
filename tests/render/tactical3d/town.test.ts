import { describe, expect, it } from "vitest";
import { ROOF_KINDS, TOWN_DEFAULTS, buildingHeight, footprint, generateTown, insideConvex, measuredStreetWidths, orientationSpreadDeg, overlaps } from "../../../src/render/tactical3d/town";

const measuredWidths = measuredStreetWidths;

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

describe("ville irrégulière par graine (R1.2)", () => {
  it("orientations des bâtiments : écart-type > 10° (à 90° près, une grille régulière donnerait 0°), sur 200 graines", () => {
    const spreads = SEEDS.map((s) => orientationSpreadDeg(generateTown(s).buildings));
    expect(Math.min(...spreads)).toBeGreaterThan(10);
    // Contrôle de la mesure : une grille régulière (maisons à 0° et 90°) donne 0°, une seule maison tournée de 20° la fait monter.
    const grid = [0, Math.PI / 2, Math.PI, -Math.PI / 2].map((angle) => ({ angle }));
    expect(orientationSpreadDeg(grid)).toBeCloseTo(0, 6);
    expect(orientationSpreadDeg([...grid, { angle: (20 * Math.PI) / 180 }])).toBeGreaterThan(5);
  });

  it("largeurs de rues mesurées non constantes, jamais sous le minimum déclaré", () => {
    for (const seed of [1, 2, 3, 42, 850]) {
      const w = measuredWidths(generateTown(seed));
      const mean = w.reduce((a, b) => a + b, 0) / w.length;
      const sd = Math.sqrt(w.reduce((a, b) => a + (b - mean) ** 2, 0) / w.length);
      expect(w.length, `graine ${seed}`).toBeGreaterThan(150);
      expect(Math.min(...w), `graine ${seed}`).toBeGreaterThanOrEqual(TOWN_DEFAULTS.streetMin - 0.01);
      expect(Math.max(...w) - Math.min(...w), `graine ${seed}`).toBeGreaterThan(6);
      expect(sd, `graine ${seed}`).toBeGreaterThan(1.5);
      expect(new Set(w.map((x) => x.toFixed(1))).size, `graine ${seed}`).toBeGreaterThan(50);
    }
    // Contrôle de la mesure : rues toutes à 8 m et îlots non tournés → largeur mesurée constante, 8 m partout.
    const fixed = measuredWidths(generateTown(850, { streetMin: 8, streetMax: 8, blockTurnDeg: 0 }));
    expect(Math.max(...fixed) - Math.min(...fixed)).toBeLessThan(0.01);
    expect(fixed[0]).toBeCloseTo(8, 3);
    // Et sans irrégularité du tout (ni décalage, ni torsion, ni rotation), la dispersion des orientations tombe à 0°.
    expect(orientationSpreadDeg(generateTown(850, { jitter: 0, swirl: 0, blockTurnDeg: 0 }).buildings)).toBeLessThan(0.01);
  });

  it("îlots tournés, une place vide (deux îlots), maisons dans leur îlot sans se chevaucher", () => {
    const town = generateTown(850);
    expect(town.blocks.filter((b) => Math.abs(b.turn) > (2 * Math.PI) / 180).length).toBeGreaterThan(town.blocks.length / 2);
    const plaza = town.blocks.filter((b) => b.plaza);
    expect(plaza).toHaveLength(2);
    expect(plaza.map((b) => b.id)).toEqual(town.plaza.blocks);
    expect(town.buildings.some((b) => plaza.some((p) => p.id === b.block))).toBe(false);
    for (const b of town.buildings) {
      const fp = footprint(b);
      const block = town.blocks[b.block];
      expect(block && fp.every((p) => insideConvex(block.inner, p, 0.06)), `maison ${b.id} hors de son îlot`).toBe(true);
    }
    for (let i = 0; i < town.buildings.length; i++) {
      for (let j = i + 1; j < town.buildings.length; j++) {
        const a = town.buildings[i];
        const b = town.buildings[j];
        if (a && b && a.block === b.block) expect(overlaps(footprint(a), footprint(b)), `maisons ${a.id} et ${b.id}`).toBe(false);
      }
    }
  });

  it("3 types de toits, fenêtres, cheminées ; hauteurs de la carte « ville » (8–20 m, ± 3 m de toit)", () => {
    for (const seed of [1, 2, 3]) {
      const t = generateTown(seed);
      expect(t.buildings.length).toBeGreaterThan(100);
      for (const k of ROOF_KINDS) expect(t.buildings.filter((b) => b.roof === k).length, `${k}, graine ${seed}`).toBeGreaterThan(15);
      expect(t.buildings.every((b) => b.bays >= 1 && b.sideBays >= 1)).toBe(true);
      expect(t.buildings.filter((b) => b.chimneys.length > 0).length).toBeGreaterThan(t.buildings.length / 2);
      const h = t.buildings.map(buildingHeight);
      expect(Math.min(...h)).toBeGreaterThanOrEqual(6.5);
      expect(Math.max(...h)).toBeLessThanOrEqual(23.5);
    }
  });

  it("même graine, même ville ; autre graine, autre ville", () => {
    expect(generateTown(7)).toEqual(generateTown(7));
    const a = generateTown(7);
    const b = generateTown(8);
    expect(a.buildings.length === b.buildings.length && a.buildings[0]?.x === b.buildings[0]?.x).toBe(false);
  });
});
