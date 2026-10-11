import { describe, expect, it } from "vitest";
import { FLARE_COLORS, FLARE_LIFE_S, FLARE_RISE_S, FLARE_TOP_M, flarePuffs } from "../../../src/render/tactical3d/battle/flares";
import { createBattle, stepBattle } from "../../../src/sim/tactical/battle";
import { companySetup } from "../../../src/sim/tactical/setup";
import { w854 } from "../../sim/legacy-cases";

/** Fusées de signal en 3D (03 §7, dette n° 70) : traînée de fumée qui monte, dérive et s'efface ; les trois couleurs du code. */
describe("fusées de signal en 3D (03 §7)", () => {
  const s = { t: 10, x: 50, y: 80 };
  it("rien avant le tir ni après la durée de vie ; montée jusqu'à 42 m environ, tête lumineuse pendant la montée", () => {
    expect(flarePuffs(s, 9.9)).toEqual([]);
    expect(flarePuffs(s, 10 + FLARE_LIFE_S + 0.01)).toEqual([]);
    const early = flarePuffs(s, 10.3);
    const risen = flarePuffs(s, 10 + FLARE_RISE_S + 0.5);
    const top = (l: ReturnType<typeof flarePuffs>): number => Math.max(...l.map((p) => p.z));
    expect(top(early)).toBeLessThan(top(risen));
    expect(early.some((p) => p.head)).toBe(true);
    expect(risen.some((p) => p.head)).toBe(false);
    expect(top(risen)).toBeGreaterThan(FLARE_TOP_M * 0.95);
    expect(top(risen)).toBeLessThanOrEqual(FLARE_TOP_M + 1.6 + 1e-9);
    // La fumée part du tireur et s'élargit avec l'âge puis s'efface.
    expect(Math.min(...risen.map((p) => p.z))).toBeCloseTo(1.6, 6);
    const r = (time: number): number => Math.max(...flarePuffs(s, time).map((p) => p.r));
    expect(r(14)).toBeGreaterThan(r(11.7));
    expect(r(19.9)).toBeLessThan(r(14) * 0.2);
  });
  it("mouvements réduits : traînée entière d'emblée, sans tête ni dérive", () => {
    const l = flarePuffs(s, 10.2, true);
    expect(l.some((p) => p.head)).toBe(false);
    expect(l.every((p) => p.x === s.x && p.y === s.y)).toBe(true);
    expect(Math.max(...l.map((p) => p.z))).toBeCloseTo(FLARE_TOP_M + 1.6, 6);
  });
  it("les fusées de la simulation ont une teinte : rouge, noire, verte ; une bataille de compagnie en lance", () => {
    expect(Object.keys(FLARE_COLORS).sort()).toEqual(["noir", "rouge", "vert"]);
    const setup = companySetup(w854, {
      map: "tmap_ville",
      seed: 4,
      soldiers: 60,
      allied: [{ kind: "fusilier", count: 40 }],
      enemy: [{ kind: "fusilier", count: 60 }],
      titans: [{ type: "ttype_grand_errant", count: 2 }, { type: "ttype_moyen_errant", count: 2 }],
    });
    const bt = createBattle(w854, setup);
    for (let k = 0; k < 1200 && !bt.state.ended; k++) stepBattle(bt, []);
    expect(bt.state.signals.length).toBeGreaterThan(0);
    for (const sg of bt.state.signals) expect(FLARE_COLORS[sg.color]).toBeDefined();
  });
});
