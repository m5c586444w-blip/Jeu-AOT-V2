import { describe, expect, it } from "vitest";
import { generateEnvironment } from "../../../src/render/tactical3d/environment";
import { FOLLOW_BAND, clearanceKeep, followCorrection } from "../../../src/render/tactical3d/followFraming";
import { PRESETS, smoky } from "../../../src/render/tactical3d/lighting";
import { ramifiedBranchAt } from "../../../src/render/tactical3d/meshTrees";
import { trailProfile, TRAIL_STYLE } from "../../../src/render/tactical3d/odm";
import { hexToRgb, profile, rgbToLab } from "../../../src/render/tactical3d/styles";

/**
 * Correctifs de R1d (consigne R1e §6, points 1 à 7 ; le point 8 est couvert par `tests/render/framing.test.ts`).
 * Les captures avant/après sont dans `docs/screenshots/r1e-correctifs-<n>.png`.
 */
describe("R1e §6 — correctifs de R1d", () => {
  it("1. ville-usine (E21) : fumée, suie, teinte plus sombre et plus rouge ; Orvud (E07) garde son ciel clair", () => {
    const e21 = profile("E21");
    expect(e21.atmosphere?.fumee).toBeGreaterThanOrEqual(0.7);
    expect(e21.atmosphere?.suie).toBeGreaterThan(0.5);
    expect(profile("E07").atmosphere).toBeUndefined();
    const lab = rgbToLab(...hexToRgb(e21.palette.facade));
    const old = rgbToLab(...hexToRgb("#8A5A44"));
    expect(lab[0]).toBeLessThan(old[0]);
    expect(lab[1] / Math.max(1, lab[2])).toBeGreaterThan(old[1] / Math.max(1, old[2]));
    const day = PRESETS.jour;
    const smoke = smoky(day, 0.8);
    expect(smoke.physical).toBeUndefined();
    expect(smoke.sunIntensity).toBeLessThan(day.sunIntensity * 0.7);
    expect(smoke.fogDensity).toBeGreaterThan(day.fogDensity * 2.5);
    expect(smoky(day, 0)).toBe(day);
  });

  it("2. villes générées : îlots de tailles variées, cinq couvertures au moins, placettes, ruelles, cours plantées, enduits variés", () => {
    const env = generateEnvironment("E02", 850, null);
    const covers = new Set(env.buildings.map((b) => b.cover));
    expect(covers.size).toBeGreaterThanOrEqual(5);
    expect(env.paving.filter((p) => p.kind === "pave" && p.y === 0.15).length).toBeGreaterThan(0);
    expect(env.paving.filter((p) => p.kind === "pave" && p.y === 0.155).length).toBeGreaterThan(0);
    expect(env.paving.filter((p) => p.kind === "terre" && p.y === 0.14).length).toBeGreaterThan(10);
    const tints = new Set(env.buildings.filter((b) => b.material === "enduit").map((b) => b.wallHex));
    expect(tints.size).toBeGreaterThan(20);
    const areas = (env.terrain?.trees ?? []).length;
    expect(areas).toBeGreaterThan(50);
  });

  it("4. suivi : le feuillage entre l'objectif et l'escouade, ou à moins de 7 m, est effacé ; ailleurs il reste", () => {
    const eye = [0, 6, 0] as const;
    const target = [14, 1, 0] as const;
    expect(clearanceKeep([7, 3.5, 0], eye, target, 3.4, 7)).toBe(0);
    expect(clearanceKeep([1, 6, 2], eye, target, 3.4, 7)).toBe(0);
    expect(clearanceKeep([7, 3.5, 8], eye, target, 3.4, 7)).toBe(1);
    expect(clearanceKeep([30, 4, 0], eye, target, 3.4, 7)).toBe(1);
  });

  it("5. traînées de gaz : filet fin et effilé (≤ 0,2 m au lanceur, ≤ 0,03 m en queue), pâlissant", () => {
    expect(trailProfile(0).width).toBeLessThanOrEqual(0.2);
    expect(trailProfile(27).width).toBeLessThanOrEqual(0.031);
    expect(trailProfile(27).alpha).toBeLessThan(0.01);
    for (let k = 1; k < 28; k++) {
      expect(trailProfile(k).width).toBeLessThanOrEqual(trailProfile(k - 1).width);
      expect(trailProfile(k).alpha).toBeLessThanOrEqual(trailProfile(k - 1).alpha);
    }
    expect(TRAIL_STYLE.drift).toBeGreaterThan(0.5);
  });

  it("6. forêt : branches courbes et ramifiées (pas de cylindre droit), brouillard plus mince", () => {
    const b = ramifiedBranchAt([0, 30, 0], [1, 0, 0], 20, 3.6, 1);
    expect(b.positions.length).toBeGreaterThanOrEqual(3);
    expect(b.tips.length).toBe(3);
    // Axe courbe : au milieu de la branche maîtresse, le bois est plus haut que la corde droite (départ → bout).
    const p = b.positions[0] as Float32Array;
    let yMid = -Infinity;
    for (let i = 0; i < p.length; i += 3) if (Math.abs((p[i] as number) - 10) < 2) yMid = Math.max(yMid, p[i + 1] as number);
    expect(yMid).toBeGreaterThan(30);
    for (const tip of b.tips) expect(tip[1]).toBeGreaterThan(30.5);
    // Ramification : les deux branches secondaires partent de part et d'autre (z de signes opposés).
    const z = b.tips.slice(1).map((t) => t[2]);
    expect((z[0] as number) * (z[1] as number)).toBeLessThan(0);
    const env = generateEnvironment("E14", 850, null);
    expect(env.mist.density).toBeLessThanOrEqual(0.35);
  });

  it("7. suivi : soldats entiers dans la bande (correction vers le haut, recul si l'escouade déborde)", () => {
    expect(followCorrection([{ x: 0, y: -0.9 }, { x: 0, y: 0.1 }]).shift).toBeGreaterThan(0);
    expect(followCorrection([{ x: 0, y: -0.2 }, { x: 0, y: 0.9 }]).shift).toBeLessThan(0);
    expect(followCorrection([{ x: -0.95, y: 0 }, { x: 0.95, y: 0 }]).dolly).toBeGreaterThan(1);
    expect(followCorrection([{ x: 0, y: -0.95 }, { x: 0, y: 0.95 }]).dolly).toBeGreaterThan(1);
    expect(followCorrection([{ x: 0.2, y: -0.3 }, { x: -0.2, y: 0.4 }])).toEqual({ shift: 0, dolly: 1 });
    expect(FOLLOW_BAND.low).toBeGreaterThan(-0.8);
  });
});
