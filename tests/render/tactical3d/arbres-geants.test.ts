import { describe, expect, it } from "vitest";
import { buttressGeometry, treeParts, trunkGeometry } from "../../../src/render/tactical3d/battle/trees";
import { seeded } from "../../../src/render/tactical3d/rng";

/** Arbres de la bataille 3D (03 §2, Forêt des Arbres Géants) : fût au rayon de la simulation au pied, pièces des arbres géants. */
describe("arbres de la bataille 3D", () => {
  it("fût unitaire : rayon 1 au pied sur les deux axes, jamais au-delà ; effilé vers le haut ; côtes plus sombres", () => {
    const g = trunkGeometry();
    const pos = g.getAttribute("position");
    let maxR = 0;
    let maxX = 0;
    let maxZ = 0;
    let topR = 0;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      maxR = Math.max(maxR, r);
      maxX = Math.max(maxX, Math.abs(pos.getX(i)));
      maxZ = Math.max(maxZ, Math.abs(pos.getZ(i)));
      if (pos.getY(i) > 0.999) topR = Math.max(topR, r);
    }
    expect(maxR).toBeLessThanOrEqual(1 + 1e-6);
    expect(maxX).toBeCloseTo(1, 6);
    expect(maxZ).toBeCloseTo(1, 6);
    expect(topR).toBeLessThan(0.65);
    const col = g.getAttribute("color");
    const shades = new Set(Array.from({ length: col.count }, (_, i) => col.getX(i).toFixed(2)));
    expect(shades.size).toBeGreaterThan(5);
    expect(buttressGeometry().getAttribute("position").count).toBe(24);
  });

  it("arbre géant : 6 contreforts autour du fût, 5 à 7 branches dans le haut, houppier en 4 ou 5 masses ; arbre ordinaire : un houppier", () => {
    const r = seeded(7);
    const g = treeParts(100, 50, 6, 80, true, r);
    expect(g.roots).toHaveLength(6);
    expect(g.branches.length).toBeGreaterThanOrEqual(5);
    expect(g.branches.length).toBeLessThanOrEqual(7);
    expect(g.crowns.length).toBeGreaterThanOrEqual(4);
    expect(g.crowns.length).toBeLessThanOrEqual(5);
    const y = (m: (typeof g.roots)[number]): number => m.elements[13] as number;
    for (const b of g.branches) {
      expect(y(b)).toBeGreaterThan(80 * 0.5);
      expect(y(b)).toBeLessThan(80 * 0.85);
    }
    for (const c of g.crowns) expect(y(c.m)).toBeGreaterThan(80 * 0.65);
    // Contreforts au pied, près du fût (à moins de 1,5 r du centre).
    for (const m of g.roots) {
      expect(y(m)).toBe(0);
      expect(Math.hypot((m.elements[12] as number) - 100, (m.elements[14] as number) - 50)).toBeLessThan(6 * 1.5);
    }
    const small = treeParts(10, 10, 0.9, 14, false, r);
    expect(small.crowns).toHaveLength(1);
    expect(small.roots).toHaveLength(0);
    expect(small.branches).toHaveLength(0);
  });
});
